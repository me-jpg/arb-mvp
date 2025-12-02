// src/highfreq/run-hf-tracker.js
// ENHANCED: Better stats, parallel scraping, improved shutdown

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
const wsServer = require('../websocket/ws-server');

// Browser instances (shared across cycles)
const browsers = {
  draftkings: null,
  fanduel: null,
  betmgm: null,
  espnbet: null
};

// Scraper instances
const scrapers = {};

// Stats tracking
let cycleCount = 0;
let totalChanges = 0;
let totalOdds = 0;
let startTime = Date.now();
let isRunning = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
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
  console.log('\n🌐 Initializing browsers...');

  // Initialize browsers in parallel
  const browserPromises = [];

  if (config.highFrequency.books.includes('draftkings')) {
    browserPromises.push(
      puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }).then(browser => {
        browsers.draftkings = browser;
        scrapers.draftkings = new DraftKingsScraper(browser);
        console.log('  ✅ DraftKings browser ready');
      }).catch(err => {
        console.error('  ❌ DraftKings browser failed:', err.message);
      })
    );
  }

  if (config.highFrequency.books.includes('fanduel')) {
    browserPromises.push(
      puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }).then(browser => {
        browsers.fanduel = browser;
        scrapers.fanduel = new FanDuelScraper(browser);
        console.log('  ✅ FanDuel browser ready');
      }).catch(err => {
        console.error('  ❌ FanDuel browser failed:', err.message);
      })
    );
  }

  if (config.highFrequency.books.includes('betmgm')) {
    browserPromises.push(
      puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }).then(browser => {
        browsers.betmgm = browser;
        scrapers.betmgm = new BetMGMScraper(browser);
        console.log('  ✅ BetMGM browser ready');
      }).catch(err => {
        console.error('  ❌ BetMGM browser failed:', err.message);
      })
    );
  }

  if (config.highFrequency.books.includes('espnbet')) {
    browserPromises.push(
      puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }).then(browser => {
        browsers.espnbet = browser;
        scrapers.espnbet = new ESPNBetScraper(browser);
        console.log('  ✅ ESPN Bet browser ready');
      }).catch(err => {
        console.error('  ❌ ESPN Bet browser failed:', err.message);
      })
    );
  }

  // Wait for all browsers to initialize
  await Promise.all(browserPromises);

  // Connect to database
  if (config.database?.enabled) {
    await db.connect();
  } else {
    console.log('⚠️  Database disabled - changes will only log to file');
  }

  // Initialize WebSocket server for dashboard
  wsServer.initialize();

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

      // Update totals
      totalChanges += stats.changesDetected;
      totalOdds += stats.oddsChecked;

      // Print stats
      console.log(`📊 Odds checked: ${stats.oddsChecked}`);
      console.log(`🔄 Changes detected: ${stats.changesDetected}`);
      console.log(`💾 Cache size: ${stats.cacheSize}`);

      // Print book-specific results (sorted by duration)
      const sortedBooks = Object.entries(stats.bookResults)
        .sort(([, a], [, b]) => a.durationMs - b.durationMs);

      sortedBooks.forEach(([book, result]) => {
        const icon = result.success ? '✓' : '✗';
        const time = `${result.durationMs}ms`;
        console.log(`   ${icon} ${book}: ${result.records} records (${time})`);
      });

      // Print changes if any
      if (stats.changesDetected > 0) {
        console.log('\n🔈 CHANGES:');
        const changes = oddsCache.getRecentChanges(10); // Get last 10
        changes.forEach(change => {
          const line = change.line ? ` [${change.oldLine} → ${change.line}]` : '';
          const price = change.price ? `: ${change.oldPrice} → ${change.price}` : '';
          console.log(`   ${change.book} - ${change.marketType} ${change.side}${line}${price} (${change.changeType})`);
        });
        if (stats.changesDetected > 10) {
          console.log(`   ... and ${stats.changesDetected - 10} more changes`);
        }
      }

      const cycleDuration = Date.now() - cycleStart;
      console.log(`⏱️  Cycle time: ${cycleDuration}ms`);

      // Enhanced session stats
      const uptime = Date.now() - startTime;
      const avgChanges = (totalChanges / cycleCount).toFixed(1);
      const avgCycleTime = Math.round(uptime / cycleCount / 1000);
      console.log(`📊 Session: ${totalChanges} changes | ${totalOdds} odds | ${cycleCount} cycles | ${formatUptime(uptime)} uptime`);
      console.log(`📈 Averages: ${avgChanges} changes/cycle | ${avgCycleTime}s/cycle`);

      // Warn if cycle time exceeds interval
      if (cycleDuration > INTERVAL_MS) {
        console.log(`⚠️  Cycle took longer than interval (${cycleDuration}ms > ${INTERVAL_MS}ms)`);
      }

      // Warn if cycle time is very long
      if (cycleDuration > 30000) {
        console.log(`⚠️  WARNING: Cycle time exceeded 30s - consider reducing maxEvents or disabling slow books`);
      }

      // Wait for next cycle
      const elapsed = Date.now() - cycleStart;
      const delay = Math.max(0, INTERVAL_MS - elapsed);
      
      if (delay > 0) {
        await sleep(delay);
      }

    } catch (error) {
      console.error('❌ Cycle error:', error.message);
      logger.logError(error, 'HF Cycle');
      
      const elapsed = Date.now() - cycleStart;
      const delay = Math.max(0, INTERVAL_MS - elapsed);
      
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }
}

async function shutdown() {
  console.log('\n🛑 Shutting down gracefully...');
  isRunning = false;

  if (db.connected) {
    await db.close();
  }

  console.log('🌐 Closing browsers...');
  const closePromises = Object.values(browsers)
    .filter(browser => browser !== null)
    .map(browser => browser.close().catch(err => {
      console.error('Error closing browser:', err.message);
    }));

  await Promise.all(closePromises);

  console.log(`📊 Total cycles: ${cycleCount}`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

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