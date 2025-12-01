// src/highfreq/run-hf-tracker.js
// High-frequency line tracking runner

require('dotenv').config();
const puppeteer = require('puppeteer');
const DraftKingsScraper = require('../scrapers/draftkings');
const FanDuelScraper = require('../scrapers/fanduel');
const BetMGMScraper = require('../scrapers/betmgm');
const ESPNBetScraper = require('../scrapers/espnbet');
const { runHighFrequencyCycle } = require('./hfTracker');
const db = require('../utils/db');
const logger = require('../utils/logger');
const oddsCache = require('./oddsCache');
const config = require('../../config');

// Browser instances (shared across cycles)
const browsers = {
  draftkings: null,
  fanduel: null,
  betmgm: null,
  espnbet: null
};

// Scraper instances (shared across cycles)
const scrapers = {
  draftkings: null,
  fanduel: null,
  betmgm: null,
  espnbet: null
};

let cycleCount = 0;
let totalChanges = 0;
let isRunning = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initialize() {
  console.log('\n' + '='.repeat(60));
  console.log('⚡ HIGH-FREQUENCY LINE TRACKER');
  console.log('='.repeat(60));
  console.log(`📊 Interval: ${config.highFrequency.intervalMs}ms (${config.highFrequency.intervalMs / 1000}s)`);
  console.log(`🎯 Max Events: ${config.highFrequency.maxEvents}`);
  console.log(`📈 Markets: ${config.highFrequency.markets.join(', ')}`);
  console.log(`📚 Books: ${config.highFrequency.books.join(', ')}`);
  console.log('='.repeat(60));

  // Initialize browsers
  console.log('\n🌐 Initializing browsers...');
  const browserConfig = {
    headless: config.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  };

  const enabledBooks = config.highFrequency.books;

  if (enabledBooks.includes('draftkings')) {
    try {
      browsers.draftkings = await puppeteer.launch(browserConfig);
      scrapers.draftkings = new DraftKingsScraper(browsers.draftkings);
      console.log('  ✅ DraftKings browser ready');
    } catch (error) {
      console.error('  ❌ DraftKings failed:', error.message);
    }
  }

  if (enabledBooks.includes('fanduel')) {
    try {
      browsers.fanduel = await puppeteer.launch(browserConfig);
      scrapers.fanduel = new FanDuelScraper(browsers.fanduel);
      console.log('  ✅ FanDuel browser ready');
    } catch (error) {
      console.error('  ❌ FanDuel failed:', error.message);
    }
  }

  if (enabledBooks.includes('betmgm')) {
    try {
      browsers.betmgm = await puppeteer.launch(browserConfig);
      scrapers.betmgm = new BetMGMScraper(browsers.betmgm);
      console.log('  ✅ BetMGM browser ready');
    } catch (error) {
      console.error('  ❌ BetMGM failed:', error.message);
    }
  }

  if (enabledBooks.includes('espnbet')) {
    try {
      browsers.espnbet = await puppeteer.launch(browserConfig);
      scrapers.espnbet = new ESPNBetScraper(browsers.espnbet);
      console.log('  ✅ ESPN Bet browser ready');
    } catch (error) {
      console.error('  ❌ ESPN Bet failed:', error.message);
    }
  }

  // Connect to database
  if (config.database?.enabled) {
    await db.connect();
  } else {
    console.log('⚠️  Database disabled - changes will only log to file');
  }

  console.log('\n⚡ High-frequency tracking started...\n');
}

async function runLoop() {
  const INTERVAL_MS = config.highFrequency.intervalMs;

  while (isRunning) {
    cycleCount++;
    const cycleStart = Date.now();

    try {
      console.log(`\n⚡ HF CYCLE ${cycleCount} - ${new Date().toLocaleTimeString()}`);
      console.log('─'.repeat(60));

      const stats = await runHighFrequencyCycle({
        scrapers,
        db,
        logger
      });

      totalChanges += stats.changesDetected;

      // Display results
      console.log(`📊 Odds checked: ${stats.oddsRecords}`);
      console.log(`🔄 Changes detected: ${stats.changesDetected}`);
      console.log(`💾 Cache size: ${stats.cacheSize}`);
      
      // Book breakdown
      Object.entries(stats.bookResults).forEach(([book, result]) => {
        console.log(`   ${book}: ${result.records} records (${result.durationMs}ms)`);
      });

      // Show changes if any
      if (stats.changes.length > 0) {
        console.log('\n📈 CHANGES:');
        stats.changes.forEach(change => {
          const lineInfo = change.newLine ? ` [${change.oldLine} → ${change.newLine}]` : '';
          console.log(`   ${change.book} - ${change.marketType} ${change.side}${lineInfo}: ${change.oldPrice} → ${change.newPrice} (${change.changeType})`);
        });
      }

      console.log(`⏱️  Cycle time: ${stats.durationMs}ms`);
      console.log(`📊 Session: ${totalChanges} total changes | ${cycleCount} cycles`);

      // Prune old cache entries every 10 cycles
      if (cycleCount % 10 === 0) {
        const pruned = oddsCache.prune(3600000); // 1 hour
        if (pruned > 0) {
          console.log(`🧹 Pruned ${pruned} old cache entries`);
        }
      }

    } catch (error) {
      console.error('❌ Cycle error:', error.message);
    }

    // Calculate delay to maintain interval
    const elapsed = Date.now() - cycleStart;
    const delay = Math.max(0, INTERVAL_MS - elapsed);
    
    if (delay > 0) {
      await sleep(delay);
    }
  }
}

async function shutdown() {
  console.log('\n\n🛑 Shutting down gracefully...');
  
  isRunning = false;

  // Close browsers
  console.log('🌐 Closing browsers...');
  const closePromises = [];
  
  Object.entries(browsers).forEach(([name, browser]) => {
    if (browser) {
      closePromises.push(
        browser.close().catch(e => console.error(`Error closing ${name}:`, e.message))
      );
    }
  });
  
  await Promise.all(closePromises);
  console.log('✅ All browsers closed');

  // Close database
  if (db.connected) {
    await db.close();
  }

  console.log(`\n📊 Final Stats:`);
  console.log(`   Cycles: ${cycleCount}`);
  console.log(`   Total changes: ${totalChanges}`);
  console.log(`   Cache size: ${oddsCache.size()}`);
  
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Main execution
async function main() {
  try {
    await initialize();
    isRunning = true;
    await runLoop();
  } catch (error) {
    console.error('Fatal error:', error);
    await shutdown();
  }
}

main();