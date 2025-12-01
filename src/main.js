// src/main.js
// PHASE 1 ENHANCED: Multi-market arbitrage detection with health monitoring

require('dotenv').config();
const puppeteer = require('puppeteer');
const DraftKingsScraper = require('./scrapers/draftkings');
const FanDuelScraper = require('./scrapers/fanduel');
const BetMGMScraper = require('./scrapers/betmgm');
const ESPNBetScraper = require('./scrapers/espnbet');
const { matchEvents } = require('./core/normalizer');
const { detectArbitrages } = require('./core/detector');
const discord = require('./output/discord');
const SheetsLogger = require('./output/sheets');
const HealthMonitor = require('./utils/healthMonitor');
const { runWithRetries } = require('./utils/helpers');
const logger = require('./utils/logger');
const db = require('./utils/db');
const config = require('../config');

// Initialize systems
const sheets = new SheetsLogger();
const healthMonitor = new HealthMonitor();

// Browser instances (reused across cycles)
let browsers = {
  draftkings: null,
  fanduel: null,
  betmgm: null,
  espnbet: null
};

// Scraper instances (reused across cycles)
let scrapers = {
  draftkings: null,
  fanduel: null,
  betmgm: null,
  espnbet: null
};

let cycleCount = 0;
let totalArbitragesFound = 0;
let isRunning = false;

// Statistics tracking
const stats = {
  totalMoneylineArbs: 0,
  totalSpreadArbs: 0,
  totalTotalArbs: 0,
  totalMarketOpportunities: 0,
  avgArbsPerCycle: 0
};

async function runCycle() {
  if (isRunning) {
    console.log('⏭️  Previous cycle still running, skipping...');
    return;
  }

  isRunning = true;
  cycleCount++;
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 CYCLE ${cycleCount} - ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(60));

  try {
    // === SCRAPING PHASE ===
    const results = {
      dk: [],
      fd: [],
      betmgm: [],
      espnbet: []
    };
    
    const bookPerformance = {
      draftkings: {},
      fanduel: {},
      betmgm: {},
      espnbet: {}
    };
    
    let totalGames = 0;
    let totalMarkets = 0;

    // DraftKings with retry
    const dkStartTime = Date.now();
    try {
      const { result, retryCount } = await runWithRetries(
        async () => await scrapers.draftkings.scrape(),
        3,
        2000,
        'DraftKings'
      );
      results.dk = result;
      const dkEndTime = Date.now();
      const marketCount = results.dk.reduce((sum, game) => 
        sum + Object.keys(game.markets || {}).length, 0);
      totalGames += results.dk.length;
      totalMarkets += marketCount;
      
      bookPerformance.draftkings = {
        games: results.dk.length,
        markets: marketCount,
        durationMs: dkEndTime - dkStartTime,
        success: true
      };
      
      healthMonitor.recordSuccess('draftkings', results.dk.length, marketCount);
      console.log(`✅ DraftKings: ${results.dk.length} games, ${marketCount} markets`);
      
      // Log scraper performance
      logger.logScraperPerformance({
        cycle: cycleCount,
        book: 'draftkings',
        startTime: new Date(dkStartTime).toISOString(),
        endTime: new Date(dkEndTime).toISOString(),
        durationMs: dkEndTime - dkStartTime,
        games: results.dk.length,
        markets: marketCount,
        success: true,
        retryCount
      });
    } catch (error) {
      const dkEndTime = Date.now();
      console.error(`❌ DraftKings failed after retries:`, error.message);
      
      bookPerformance.draftkings = {
        games: 0,
        markets: 0,
        durationMs: dkEndTime - dkStartTime,
        success: false
      };
      
      healthMonitor.recordFailure('draftkings', error);
      
      // Log error and scraper performance
      logger.logError({
        book: 'draftkings',
        cycle: cycleCount,
        message: error.message,
        stack: error.stack
      });
      
      logger.logScraperPerformance({
        cycle: cycleCount,
        book: 'draftkings',
        startTime: new Date(dkStartTime).toISOString(),
        endTime: new Date(dkEndTime).toISOString(),
        durationMs: dkEndTime - dkStartTime,
        games: 0,
        markets: 0,
        success: false,
        error: error.message
      });
    }

    // FanDuel with retry
    const fdStartTime = Date.now();
    try {
      const { result, retryCount } = await runWithRetries(
        async () => await scrapers.fanduel.scrape(),
        3,
        2000,
        'FanDuel'
      );
      results.fd = result;
      const fdEndTime = Date.now();
      const marketCount = results.fd.reduce((sum, game) => 
        sum + Object.keys(game.markets || {}).length, 0);
      totalGames += results.fd.length;
      totalMarkets += marketCount;
      
      bookPerformance.fanduel = {
        games: results.fd.length,
        markets: marketCount,
        durationMs: fdEndTime - fdStartTime,
        success: true
      };
      
      healthMonitor.recordSuccess('fanduel', results.fd.length, marketCount);
      console.log(`✅ FanDuel: ${results.fd.length} games, ${marketCount} markets`);
      
      logger.logScraperPerformance({
        cycle: cycleCount,
        book: 'fanduel',
        startTime: new Date(fdStartTime).toISOString(),
        endTime: new Date(fdEndTime).toISOString(),
        durationMs: fdEndTime - fdStartTime,
        games: results.fd.length,
        markets: marketCount,
        success: true,
        retryCount
      });
    } catch (error) {
      const fdEndTime = Date.now();
      console.error(`❌ FanDuel failed after retries:`, error.message);
      
      bookPerformance.fanduel = {
        games: 0,
        markets: 0,
        durationMs: fdEndTime - fdStartTime,
        success: false
      };
      
      healthMonitor.recordFailure('fanduel', error);
      
      logger.logError({
        book: 'fanduel',
        cycle: cycleCount,
        message: error.message,
        stack: error.stack
      });
      
      logger.logScraperPerformance({
        cycle: cycleCount,
        book: 'fanduel',
        startTime: new Date(fdStartTime).toISOString(),
        endTime: new Date(fdEndTime).toISOString(),
        durationMs: fdEndTime - fdStartTime,
        games: 0,
        markets: 0,
        success: false,
        error: error.message
      });
    }

    // BetMGM with retry
    const betmgmStartTime = Date.now();
    try {
      const { result, retryCount } = await runWithRetries(
        async () => await scrapers.betmgm.scrape(),
        3,
        2000,
        'BetMGM'
      );
      results.betmgm = result;
      const betmgmEndTime = Date.now();
      const marketCount = results.betmgm.reduce((sum, game) => 
        sum + Object.keys(game.markets || {}).length, 0);
      totalGames += results.betmgm.length;
      totalMarkets += marketCount;
      
      bookPerformance.betmgm = {
        games: results.betmgm.length,
        markets: marketCount,
        durationMs: betmgmEndTime - betmgmStartTime,
        success: true
      };
      
      healthMonitor.recordSuccess('betmgm', results.betmgm.length, marketCount);
      console.log(`✅ BetMGM: ${results.betmgm.length} games, ${marketCount} markets`);
      
      logger.logScraperPerformance({
        cycle: cycleCount,
        book: 'betmgm',
        startTime: new Date(betmgmStartTime).toISOString(),
        endTime: new Date(betmgmEndTime).toISOString(),
        durationMs: betmgmEndTime - betmgmStartTime,
        games: results.betmgm.length,
        markets: marketCount,
        success: true,
        retryCount
      });
    } catch (error) {
      const betmgmEndTime = Date.now();
      console.error(`❌ BetMGM failed after retries:`, error.message);
      
      bookPerformance.betmgm = {
        games: 0,
        markets: 0,
        durationMs: betmgmEndTime - betmgmStartTime,
        success: false
      };
      
      healthMonitor.recordFailure('betmgm', error);
      
      logger.logError({
        book: 'betmgm',
        cycle: cycleCount,
        message: error.message,
        stack: error.stack
      });
      
      logger.logScraperPerformance({
        cycle: cycleCount,
        book: 'betmgm',
        startTime: new Date(betmgmStartTime).toISOString(),
        endTime: new Date(betmgmEndTime).toISOString(),
        durationMs: betmgmEndTime - betmgmStartTime,
        games: 0,
        markets: 0,
        success: false,
        error: error.message
      });
    }

    // ESPN Bet with retry
    const espnStartTime = Date.now();
    try {
      const { result, retryCount } = await runWithRetries(
        async () => await scrapers.espnbet.scrape(),
        3,
        2000,
        'ESPN Bet'
      );
      results.espnbet = result;
      const espnEndTime = Date.now();
      const marketCount = results.espnbet.reduce((sum, game) => 
        sum + Object.keys(game.markets || {}).length, 0);
      totalGames += results.espnbet.length;
      totalMarkets += marketCount;
      
      bookPerformance.espnbet = {
        games: results.espnbet.length,
        markets: marketCount,
        durationMs: espnEndTime - espnStartTime,
        success: true
      };
      
      healthMonitor.recordSuccess('espnbet', results.espnbet.length, marketCount);
      console.log(`✅ ESPN Bet: ${results.espnbet.length} games, ${marketCount} markets`);
      
      logger.logScraperPerformance({
        cycle: cycleCount,
        book: 'espnbet',
        startTime: new Date(espnStartTime).toISOString(),
        endTime: new Date(espnEndTime).toISOString(),
        durationMs: espnEndTime - espnStartTime,
        games: results.espnbet.length,
        markets: marketCount,
        success: true,
        retryCount
      });
    } catch (error) {
      const espnEndTime = Date.now();
      console.error(`❌ ESPN Bet failed after retries:`, error.message);
      
      bookPerformance.espnbet = {
        games: 0,
        markets: 0,
        durationMs: espnEndTime - espnStartTime,
        success: false
      };
      
      healthMonitor.recordFailure('espnbet', error);
      
      logger.logError({
        book: 'espnbet',
        cycle: cycleCount,
        message: error.message,
        stack: error.stack
      });
      
      logger.logScraperPerformance({
        cycle: cycleCount,
        book: 'espnbet',
        startTime: new Date(espnStartTime).toISOString(),
        endTime: new Date(espnEndTime).toISOString(),
        durationMs: espnEndTime - espnStartTime,
        games: 0,
        markets: 0,
        success: false,
        error: error.message
      });
    }

    // === HEALTH CHECK ===
    const healthyBooks = healthMonitor.getHealthyBooks();
    console.log(`\n📊 Health: ${healthyBooks.length}/4 books operational`);
    if (healthyBooks.length < 2) {
      console.error('⚠️  Less than 2 books healthy - skipping arbitrage detection');
      isRunning = false;
      return;
    }

    // === MATCHING PHASE ===
    console.log(`\n🔗 Matching events across ${healthyBooks.join(', ')}...`);
    const matchedEvents = matchEvents(
      results.dk,
      results.fd,
      results.betmgm,
      results.espnbet,
      [], // bovada disabled
      []  // mybookie disabled
    );

    // Count total market opportunities
    const marketOpportunities = matchedEvents.reduce((sum, event) => 
      sum + Object.keys(event.markets || {}).length, 0);
    stats.totalMarketOpportunities += marketOpportunities;

    console.log(`✅ Matched: ${matchedEvents.length} events, ${marketOpportunities} markets`);

    // === DETECTION PHASE ===
    const arbitrages = detectArbitrages(matchedEvents);

    // === DATABASE PERSISTENCE ===
    if (db.connected) {
      try {
        // 1. Upsert events
        const eventsToUpsert = matchedEvents.map(event => ({
          eventId: event.eventId,
          sport: 'NFL',
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          startTime: event.gameTime || null
        }));
        
        await db.upsertEvents(eventsToUpsert);

        // 2. Insert odds snapshots for all markets
        const oddsSnapshots = [];
        
        matchedEvents.forEach(event => {
          Object.entries(event.markets).forEach(([marketKey, market]) => {
            const marketType = market.marketType;
            const line = marketKey.includes('_') ? parseFloat(marketKey.split('_')[1]) : null;
            
            Object.entries(market.books).forEach(([book, bookData]) => {
              // Moneyline
              if (marketType === 'moneyline' && bookData.awayOdds && bookData.homeOdds) {
                oddsSnapshots.push({
                  eventId: event.eventId,
                  book,
                  marketType: 'moneyline',
                  line: null,
                  side: 'away',
                  price: bookData.awayOdds
                });
                oddsSnapshots.push({
                  eventId: event.eventId,
                  book,
                  marketType: 'moneyline',
                  line: null,
                  side: 'home',
                  price: bookData.homeOdds
                });
              }
              
              // Spread
              if (marketType === 'spread' && bookData.awayOdds && bookData.homeOdds) {
                oddsSnapshots.push({
                  eventId: event.eventId,
                  book,
                  marketType: 'spread',
                  line,
                  side: 'away',
                  price: bookData.awayOdds
                });
                oddsSnapshots.push({
                  eventId: event.eventId,
                  book,
                  marketType: 'spread',
                  line,
                  side: 'home',
                  price: bookData.homeOdds
                });
              }
              
              // Total
              if (marketType === 'total' && bookData.overOdds && bookData.underOdds) {
                oddsSnapshots.push({
                  eventId: event.eventId,
                  book,
                  marketType: 'total',
                  line,
                  side: 'over',
                  price: bookData.overOdds
                });
                oddsSnapshots.push({
                  eventId: event.eventId,
                  book,
                  marketType: 'total',
                  line,
                  side: 'under',
                  price: bookData.underOdds
                });
              }
            });
          });
        });
        
        if (oddsSnapshots.length > 0) {
          await db.insertOddsSnapshots(oddsSnapshots);
        }

        // 3. Insert edges (arbitrages for now - would need all edges from detector)
        const edgesToInsert = arbitrages.map(arb => ({
          eventId: arb.eventId || `${arb.event}_${arb.gameDate}`,
          marketType: arb.marketType,
          line: arb.spreadValue || arb.totalValue || null,
          bookA: arb.book1,
          bookB: arb.book2,
          edgePercent: -arb.profitMargin, // Negative for arbitrage
          isArbitrage: true
        }));
        
        if (edgesToInsert.length > 0) {
          await db.insertEdges(edgesToInsert);
        }
        
        console.log(`💾 DB: ${eventsToUpsert.length} events, ${oddsSnapshots.length} odds, ${edgesToInsert.length} edges`);
      } catch (error) {
        console.error('❌ Database persistence failed:', error.message);
        logger.logError({
          book: 'DATABASE',
          cycle: cycleCount,
          message: error.message,
          stack: error.stack
        });
      }
    }

    // === ARBITRAGE PROCESSING ===
    if (arbitrages.length > 0) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚨 ${arbitrages.length} ARBITRAGE${arbitrages.length > 1 ? 'S' : ''} DETECTED!`);
      console.log('='.repeat(60));
      
      // Group by market type
      const byType = {
        moneyline: arbitrages.filter(a => a.marketType === 'moneyline'),
        spread: arbitrages.filter(a => a.marketType === 'spread'),
        total: arbitrages.filter(a => a.marketType === 'total')
      };

      stats.totalMoneylineArbs += byType.moneyline.length;
      stats.totalSpreadArbs += byType.spread.length;
      stats.totalTotalArbs += byType.total.length;

      console.log(`\n📊 Breakdown:`);
      console.log(`   Moneyline: ${byType.moneyline.length}`);
      console.log(`   Spread: ${byType.spread.length}`);
      console.log(`   Total: ${byType.total.length}`);
      
      for (const arb of arbitrages) {
        console.log(`\n💰 ${arb.marketType.toUpperCase()} - ${arb.event}`);
        console.log(`   Profit: ${arb.profitMargin.toFixed(2)}% ($${arb.profitAmount.toFixed(2)})`);
        console.log(`   ${arb.book1}: ${arb.selection1} @ ${arb.americanOdds1} → $${arb.stake1.toFixed(2)}`);
        console.log(`   ${arb.book2}: ${arb.selection2} @ ${arb.americanOdds2} → $${arb.stake2.toFixed(2)}`);

        // Send to Discord
        await discord.sendArbitrage(arb);

        // Transform for sheets
        const arbForSheets = {
          detectedAt: arb.detected,
          event: arb.event,
          gameTime: arb.gameTime,
          marketType: arb.marketType,
          profitMargin: arb.profitMargin.toFixed(2),
          leg1: {
            book: arb.book1,
            selection: arb.selection1,
            odds: arb.americanOdds1,
            stake: arb.stake1.toFixed(2),
            url: arb.url1
          },
          leg2: {
            book: arb.book2,
            selection: arb.selection2,
            odds: arb.americanOdds2,
            stake: arb.stake2.toFixed(2),
            url: arb.url2
          },
          profit: arb.profitAmount.toFixed(2)
        };

        // Log to Google Sheets
        await sheets.logArbitrage(arbForSheets);
      }

      totalArbitragesFound += arbitrages.length;
    } else {
      console.log(`\n✅ No arbitrages detected at ${config.minProfitMargin}% threshold`);
    }

    // === CYCLE SUMMARY ===
    const cycleDurationMs = Date.now() - startTime;
    const duration = (cycleDurationMs / 1000).toFixed(1);
    console.log(`\n⏱️  Cycle completed in ${duration}s`);
    console.log(`📈 Session totals: ${totalArbitragesFound} arbs | ${cycleCount} cycles`);

    // Update statistics
    stats.avgArbsPerCycle = totalArbitragesFound / cycleCount;
    
    // Calculate edge distribution (mock data for now - would need detector to return all edges)
    // For now, track arbitrages found as edges < 0
    const edgeDistribution = {
      ge_2_0: 0,   // Would need full edge data from detector
      ge_1_5: 0,
      ge_1_0: 0,
      ge_0_5: 0,
      ge_0_0: 0,
      lt_0_0: arbitrages.length  // True arbitrages
    };
    
    // Log structured cycle summary
    logger.logCycleSummary({
      cycle: cycleCount,
      timestamp: new Date(startTime).toISOString(),
      books: bookPerformance,
      matchedEvents: matchedEvents.length,
      marketsCompared: marketOpportunities,
      edges: edgeDistribution,
      arbitragesFound: arbitrages.length,
      cycleDurationMs
    });

    // === PERIODIC REPORTING ===
    if (cycleCount % 10 === 0) {
      // Health report every 10 cycles
      healthMonitor.printReport();

      // Discord summary
      const summary = healthMonitor.getSummary();
      const discordSummary = {
        cycle: cycleCount,
        matched: matchedEvents.length,
        markets: marketOpportunities,
        arbitragesThisCycle: arbitrages.length,
        totalArbitrages: totalArbitragesFound,
        uptime: formatUptime(cycleCount * config.scrapeInterval),
        healthyBooks: summary.healthyBooks,
        unhealthyBooks: summary.unhealthyBooks,
        ...summary.bookDetails
      };
      
      await discord.sendSummary(discordSummary);

      // Statistics summary
      console.log(`\n📊 SESSION STATISTICS:`);
      console.log(`   Total arbitrages: ${totalArbitragesFound}`);
      console.log(`   - Moneyline: ${stats.totalMoneylineArbs}`);
      console.log(`   - Spread: ${stats.totalSpreadArbs}`);
      console.log(`   - Total: ${stats.totalTotalArbs}`);
      console.log(`   Avg arbs/cycle: ${stats.avgArbsPerCycle.toFixed(2)}`);
      console.log(`   Market opportunities: ${stats.totalMarketOpportunities}`);
    }

  } catch (error) {
    console.error('\n❌ ERROR in cycle:', error.message);
    console.error(error.stack);
    
    // Log to structured error log
    logger.logError({
      book: 'SYSTEM',
      cycle: cycleCount,
      message: error.message,
      stack: error.stack
    });
  } finally {
    isRunning = false;
  }
}

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ARB MVP - PHASE 1 ENHANCED');
  console.log('='.repeat(60));
  console.log('📚 Books: DraftKings, FanDuel, BetMGM, ESPN Bet');
  console.log('📊 Markets: Moneyline, Spread, Total');
  console.log(`⚙️  Min Profit: ${config.minProfitMargin}% | Stake: $${config.totalStake}`);
  console.log(`⏱️  Interval: ${config.scrapeInterval}s | Stale line threshold: ${config.staleThreshold || 120}s`);
  console.log('='.repeat(60));

  // Initialize browsers (one per book, reused across cycles)
  console.log('\n🌐 Initializing browsers...');
  const browserConfig = {
    headless: config.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  };

  try {
    browsers.draftkings = await puppeteer.launch(browserConfig);
    console.log('  ✅ DraftKings browser ready');
  } catch (error) {
    console.error('  ❌ Failed to launch DraftKings browser:', error.message);
  }

  try {
    browsers.fanduel = await puppeteer.launch(browserConfig);
    console.log('  ✅ FanDuel browser ready');
  } catch (error) {
    console.error('  ❌ Failed to launch FanDuel browser:', error.message);
  }

  try {
    browsers.betmgm = await puppeteer.launch(browserConfig);
    console.log('  ✅ BetMGM browser ready');
  } catch (error) {
    console.error('  ❌ Failed to launch BetMGM browser:', error.message);
  }

  try {
    browsers.espnbet = await puppeteer.launch(browserConfig);
    console.log('  ✅ ESPN Bet browser ready');
  } catch (error) {
    console.error('  ❌ Failed to launch ESPN Bet browser:', error.message);
  }

  // Initialize scrapers with browsers
  scrapers.draftkings = new DraftKingsScraper(browsers.draftkings);
  scrapers.fanduel = new FanDuelScraper(browsers.fanduel);
  scrapers.betmgm = new BetMGMScraper(browsers.betmgm);
  scrapers.espnbet = new ESPNBetScraper(browsers.espnbet);

  console.log('✅ All browsers initialized\n');

  // Initialize Database
  if (config.database?.enabled) {
    try {
      await db.connect();
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.log('ℹ️  Continuing without database persistence');
    }
  } else {
    console.log('ℹ️  Database persistence disabled');
  }

  // Initialize Google Sheets
  if (config.sheets?.enabled) {
    try {
      await sheets.initialize();
      console.log('✅ Google Sheets connected');
    } catch (error) {
      console.error('❌ Sheets initialization failed:', error.message);
      console.log('ℹ️  Continuing without Sheets logging');
    }
  } else {
    console.log('ℹ️  Google Sheets logging disabled');
  }

  // Test Discord webhook
  try {
    await discord.sendStartup({
      phase: 'Phase 1 Enhanced',
      markets: ['Moneyline', 'Spread', 'Total'],
      minProfit: config.minProfitMargin,
      totalStake: config.totalStake,
      interval: config.scrapeInterval
    });
    console.log('✅ Discord connected');
  } catch (error) {
    console.error('❌ Discord failed:', error.message);
  }

  console.log('\n🎯 Monitoring started...\n');

  // Run first cycle immediately
  await runCycle();

  // Then run on interval
  setInterval(runCycle, config.scrapeInterval * 1000);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  
  // Close all browsers
  console.log('🌐 Closing browsers...');
  const closePromises = [];
  
  if (browsers.draftkings) {
    closePromises.push(browsers.draftkings.close().catch(e => console.error('Error closing DK browser:', e.message)));
  }
  if (browsers.fanduel) {
    closePromises.push(browsers.fanduel.close().catch(e => console.error('Error closing FD browser:', e.message)));
  }
  if (browsers.betmgm) {
    closePromises.push(browsers.betmgm.close().catch(e => console.error('Error closing BetMGM browser:', e.message)));
  }
  if (browsers.espnbet) {
    closePromises.push(browsers.espnbet.close().catch(e => console.error('Error closing ESPN browser:', e.message)));
  }
  
  await Promise.all(closePromises);
  console.log('✅ All browsers closed');
  
  // Close database connection
  if (db.connected) {
    await db.close();
  }
  
  // Final health report
  healthMonitor.printReport();
  
  console.log(`\n📊 Final Stats:`);
  console.log(`   Cycles completed: ${cycleCount}`);
  console.log(`   Total arbitrages: ${totalArbitragesFound}`);
  console.log(`   - Moneyline: ${stats.totalMoneylineArbs}`);
  console.log(`   - Spread: ${stats.totalSpreadArbs}`);
  console.log(`   - Total: ${stats.totalTotalArbs}`);
  console.log(`   Avg arbs/cycle: ${stats.avgArbsPerCycle.toFixed(2)}`);
  
  try {
    await discord.sendShutdown(cycleCount, totalArbitragesFound, stats);
  } catch (error) {
    console.error('Failed to send shutdown message:', error.message);
  }
  
  process.exit(0);
});

// Start the system
main().catch(error => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});