// src/highfreq/hfTracker.js
// High-frequency line tracking engine

const { lightweightScrape } = require('./lightweightScraper');
const { detectChanges } = require('./changeDetector');
const oddsCache = require('./oddsCache');
const config = require('../../config');

/**
 * Run one high-frequency cycle
 * Scrapes subset of games, detects changes, persists to DB
 */
async function runHighFrequencyCycle({ scrapers, db, logger }) {
  const cycleStart = Date.now();
  const allOddsRecords = [];
  const bookResults = {};

  // Scrape from each enabled book
  const enabledBooks = config.highFrequency.books;
  const maxGames = config.highFrequency.maxEvents;

  for (const bookName of enabledBooks) {
    const scraper = scrapers[bookName];
    if (!scraper) {
      console.warn(`Scraper not available for ${bookName}`);
      continue;
    }

    const bookStart = Date.now();
    const oddsRecords = await lightweightScrape(scraper, bookName, maxGames);
    const bookDuration = Date.now() - bookStart;

    allOddsRecords.push(...oddsRecords);
    bookResults[bookName] = {
      records: oddsRecords.length,
      durationMs: bookDuration
    };
  }

  // Detect changes
  const changes = detectChanges(allOddsRecords, oddsCache);

  // Persist changes to database
  if (changes.length > 0 && db.connected) {
    try {
      await db.insertLineChanges(changes);
      
      // Also log to JSONL
      changes.forEach(change => {
        logger.logLineChange(change);
      });
    } catch (error) {
      console.error('Failed to persist line changes:', error.message);
    }
  }

  const cycleDuration = Date.now() - cycleStart;

  // Return cycle stats
  return {
    oddsRecords: allOddsRecords.length,
    changesDetected: changes.length,
    cacheSize: oddsCache.size(),
    durationMs: cycleDuration,
    bookResults,
    changes
  };
}

module.exports = {
  runHighFrequencyCycle
};