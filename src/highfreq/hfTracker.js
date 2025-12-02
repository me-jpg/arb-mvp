// src/highfreq/hfTracker.js
// OPTIMIZED: Parallel scraping for faster cycle times

const { lightweightScrape } = require('./lightweightScraper');
const { detectChanges } = require('./changeDetector');
const oddsCache = require('./oddsCache');
const config = require('../../config');
const wsServer = require('../websocket/ws-server');

/**
 * Run one high-frequency cycle
 * Scrapes subset of games, detects changes, persists to DB
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
      const records = await lightweightScrape(scraper, maxGames);
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
      logger.logError(error, `HF scrape (${bookName})`);
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

  // Detect changes
  const changes = detectChanges(allOddsRecords, oddsCache);

  // Broadcast line changes
  if (changes.length > 0) {
    changes.forEach(change => {
      wsServer.sendMessage('line_change', change);
    });
  }

  // Persist changes to database
  if (changes.length > 0 && db && db.connected) {
    try {
      await db.insertLineChanges(changes);
      
      // Also log to JSONL
      changes.forEach(change => {
        logger.logLineChange(change);
      });
    } catch (error) {
      console.error('   ❌ Failed to persist line changes:', error.message);
    }
  }

  const cycleDuration = Date.now() - cycleStart;

  return {
    cycleTime: cycleDuration,
    oddsChecked: allOddsRecords.length,
    changesDetected: changes.length,
    cacheSize: oddsCache.size(),
    bookResults
  };
}

module.exports = { runHighFrequencyCycle };