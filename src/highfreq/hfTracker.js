// src/highfreq/hfTracker.js
// ENHANCED: Arbitrage detection integrated with high-frequency tracking

const { lightweightScrape } = require('./lightweightScraper');
const { detectChanges } = require('./changeDetector');
const { 
  findArbitrageOpportunities, 
  logArbitrageSummary,
  formatForBroadcast 
} = require('./arbitrageEngine');
const oddsCache = require('./oddsCache');
const config = require('../../config');
const wsServer = require('../websocket/ws-server');
const { convertArbResultsToSignals } = require('../signals/arbSignalAdapter');
const { logSignals } = require('../signals/signalLogger');

// Timing helper
const DEBUG_TIMINGS = () => config.highFrequency.debugTimings;

function logTiming(label, data) {
  if (!DEBUG_TIMINGS()) return;
  if (typeof data === 'object') {
    console.log(`[HF_TIMING] ${label}:`);
    Object.entries(data).forEach(([k, v]) => {
      console.log(`   ${k}: ${v}ms`);
    });
  } else {
    console.log(`[HF_TIMING] ${label}: ${data}ms`);
  }
}

/**
 * Run one high-frequency cycle
 * Scrapes subset of games, detects changes, finds arbitrage, persists to DB
 * Returns timings object for performance monitoring
 */
async function runHighFrequencyCycle({ scrapers, db, logger }) {
  const cycleStart = Date.now();
  const allOddsRecords = [];
  const bookResults = {};
  const timings = { scrape: {}, normalize: 0, arbEngine: 0, dbLogging: 0, total: 0 };

  // Get enabled books
  const enabledBooks = config.highFrequency.books;
  const maxGames = config.highFrequency.maxEvents;

  // ✅ OPTIMIZATION: Scrape all books IN PARALLEL (not sequential)
  const scrapePromises = enabledBooks.map(async (bookName) => {
    const scraper = scrapers[bookName];
    if (!scraper) {
      console.warn(`   ⚠️  Scraper not available for ${bookName}`);
      return { bookName, records: [], success: false, durationMs: 0 };
    }

    const bookStart = Date.now();
    try {
      const records = await lightweightScrape(scraper, bookName, maxGames);
      const durationMs = Date.now() - bookStart;

      if (records.length === 0) {
        console.warn(`   ⚠️  ${bookName} returned 0 games`);
      }

      return {
        bookName,
        records,
        success: true,
        durationMs
      };
    } catch (error) {
      console.error(`❌ HF scrape error (${bookName}):`, error.message);
      logger.logError(`HF scrape (${bookName})`, error);
      return {
        bookName,
        records: [],
        success: false,
        durationMs: Date.now() - bookStart,
        error: error.message
      };
    }
  });

  // Wait for all scrapes to complete
  const results = await Promise.all(scrapePromises);
  const scrapeEndTime = Date.now();

  // Aggregate results and collect timings
  results.forEach(({ bookName, records, success, durationMs, error }) => {
    if (success) {
      allOddsRecords.push(...records);
    }
    
    bookResults[bookName] = {
      records: records.length,
      durationMs,
      success,
      error: error || null
    };
    
    // Track per-book scrape timing
    timings.scrape[bookName] = durationMs;
  });

  // Log scrape timings
  logTiming('scrape', timings.scrape);

  // ✅ Normalize/merge timing (minimal - just aggregation above)
  const normalizeStart = Date.now();
  timings.normalize = normalizeStart - scrapeEndTime;
  logTiming('normalize+merge', timings.normalize);

  // ✅ NEW: Find arbitrage opportunities using the new engine
  // Uses HF-specific threshold (separate from Phase 1 minProfitMargin)
  const arbStart = Date.now();
  const hfMinEdgePercent = config.highFrequency.arbitrageMinEdgePercent ?? 0;
  const arbResult = findArbitrageOpportunities(allOddsRecords, {
    cycleId: `hf-${Date.now()}`,
    minEdge: hfMinEdgePercent / 100  // Convert percentage to decimal (0.5% → 0.005)
  });
  
  const arbitrageOpportunities = arbResult.opportunities || [];
  const arbStats = arbResult.stats || {};
  timings.arbEngine = Date.now() - arbStart;
  logTiming('arbitrage engine', timings.arbEngine);
  
  // Log arbitrage summary (includes debug info when ARB_DEBUG=true)
  logArbitrageSummary(arbitrageOpportunities, arbStats);

  // Detect line changes
  const changes = detectChanges(allOddsRecords, oddsCache);

  // Broadcast arbitrage opportunities
  if (arbitrageOpportunities.length > 0) {
    arbitrageOpportunities.forEach(opp => {
      const broadcastMsg = formatForBroadcast(opp);
      wsServer.sendMessage('arbitrage_opportunity', broadcastMsg);
    });
  }

  // Broadcast line changes
  if (changes.length > 0) {
    changes.forEach(change => {
      wsServer.sendMessage('line_change', change);
    });
  }

  // Persist to database
  const dbStart = Date.now();
  if (db && db.connected) {
    try {
      // Insert line changes
      if (changes.length > 0) {
        await db.insertLineChanges(changes);
        
        // Also log to JSONL
        changes.forEach(change => {
          logger.logLineChange(change);
        });
      }

      // Insert arbitrage opportunities
      if (arbitrageOpportunities.length > 0) {
        await db.insertArbitrageOpportunities(arbitrageOpportunities);
        
        // Log to JSONL
        arbitrageOpportunities.forEach(opp => {
          logger.logArbitrage(opp);
        });

        // Convert arb results to Signals and persist to signals.jsonl
        const arbSignals = convertArbResultsToSignals(arbResult, {
          defaultConfidence: 0.9,
          maxEdgeCap: 0.10,
          cycleId: `hf-${cycleStart}`
        });
        if (arbSignals.length > 0) {
          logSignals(arbSignals);
          console.log(`   💾 Arb signals persisted: ${arbSignals.length}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Failed to persist data:', error.message);
    }
  }
  timings.dbLogging = Date.now() - dbStart;
  logTiming('db+logging', timings.dbLogging);

  const cycleDuration = Date.now() - cycleStart;
  timings.total = cycleDuration;

  // Log total timing summary
  if (DEBUG_TIMINGS()) {
    const intervalMs = config.highFrequency.intervalMs;
    const utilization = ((cycleDuration / intervalMs) * 100).toFixed(1);
    console.log(`[HF_TIMING] total: ${cycleDuration}ms (interval=${intervalMs}ms, utilization=${utilization}%)`);
  }

  return {
    cycleTime: cycleDuration,
    oddsChecked: allOddsRecords.length,
    changesDetected: changes.length,
    arbitrageFound: arbitrageOpportunities.length,
    cacheSize: oddsCache.size(),
    bookResults,
    topArbitrage: arbitrageOpportunities[0] || null,
    timings // Include detailed timings for health monitoring
  };
}

module.exports = { runHighFrequencyCycle };