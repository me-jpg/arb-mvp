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

/**
 * Run one high-frequency cycle
 * Scrapes subset of games, detects changes, finds arbitrage, persists to DB
 */
async function runHighFrequencyCycle({ scrapers, db, logger }) {
  const cycleStart = Date.now();
  const allOddsRecords = [];
  const bookResults = {};

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

  // Aggregate results
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
  });

  // ✅ NEW: Find arbitrage opportunities using the new engine
  // Uses HF-specific threshold (separate from Phase 1 minProfitMargin)
  const hfMinEdgePercent = config.highFrequency.arbitrageMinEdgePercent ?? 0;
  const arbResult = findArbitrageOpportunities(allOddsRecords, {
    cycleId: `hf-${Date.now()}`,
    minEdge: hfMinEdgePercent / 100  // Convert percentage to decimal (0.5% → 0.005)
  });
  
  const arbitrageOpportunities = arbResult.opportunities || [];
  const arbStats = arbResult.stats || {};
  
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
      }
    } catch (error) {
      console.error('   ❌ Failed to persist data:', error.message);
    }
  }

  const cycleDuration = Date.now() - cycleStart;

  return {
    cycleTime: cycleDuration,
    oddsChecked: allOddsRecords.length,
    changesDetected: changes.length,
    arbitrageFound: arbitrageOpportunities.length,
    cacheSize: oddsCache.size(),
    bookResults,
    topArbitrage: arbitrageOpportunities[0] || null
  };
}

module.exports = { runHighFrequencyCycle };