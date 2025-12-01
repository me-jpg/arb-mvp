// tests/soak-test.js
// Continuous monitoring and data collection (no real money)
// Runs indefinitely, logs all market data for analysis

const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');
const BetMGMScraper = require('../src/scrapers/betmgm');
const ESPNBetScraper = require('../src/scrapers/espnbet');
const { matchEvents } = require('../src/core/normalizer');
const { americanToDecimal } = require('../src/core/detector');
const fs = require('fs');
const path = require('path');

// Configuration
const SOAK_CONFIG = {
  cycleInterval: 60000,        // 60 seconds between cycles
  logDirectory: './soak-logs', // Directory for log files
  maxCycles: null,             // null = run indefinitely, number = stop after N cycles
  enableConsoleOutput: true,   // Show progress in console
};

// Ensure log directory exists
if (!fs.existsSync(SOAK_CONFIG.logDirectory)) {
  fs.mkdirSync(SOAK_CONFIG.logDirectory, { recursive: true });
}

// Global counters
let cycleCount = 0;
let startTime = Date.now();

/**
 * Log cycle summary to JSONL file
 */
function logCycleSummary(summary) {
  const logFile = path.join(SOAK_CONFIG.logDirectory, 'cycle-summary.jsonl');
  fs.appendFileSync(logFile, JSON.stringify(summary) + '\n');
}

/**
 * Log market edges to JSONL file
 */
function logMarketEdges(edges) {
  const logFile = path.join(SOAK_CONFIG.logDirectory, 'market-edges.jsonl');
  edges.forEach(edge => {
    fs.appendFileSync(logFile, JSON.stringify(edge) + '\n');
  });
}

/**
 * Log scraper performance to JSONL file
 */
function logScraperPerformance(performance) {
  const logFile = path.join(SOAK_CONFIG.logDirectory, 'scraper-performance.jsonl');
  fs.appendFileSync(logFile, JSON.stringify(performance) + '\n');
}

/**
 * Calculate implied probability sum for a market
 */
function calculateMargin(odds) {
  const impliedProbs = odds.map(o => 1 / americanToDecimal(o));
  const sum = impliedProbs.reduce((a, b) => a + b, 0);
  return (sum - 1) * 100; // Return as percentage
}

/**
 * Run a single scraping cycle
 */
async function runCycle() {
  cycleCount++;
  const cycleStartTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log('\n' + '='.repeat(80));
  console.log(`CYCLE #${cycleCount} - ${timestamp}`);
  console.log('='.repeat(80));
  
  const scrapers = {
    draftkings: new DraftKingsScraper(),
    fanduel: new FanDuelScraper(),
    betmgm: new BetMGMScraper(),
    espnbet: new ESPNBetScraper()
  };
  
  const scraperResults = {};
  const scraperPerformance = {
    timestamp,
    cycle: cycleCount,
    books: {}
  };
  
  // Scrape all books
  for (const [book, scraper] of Object.entries(scrapers)) {
    const bookStartTime = Date.now();
    
    try {
      console.log(`\n📊 Scraping ${book}...`);
      let data = await scraper.scrape();
      let elapsed = Date.now() - bookStartTime;
      
      // Check for 0 games - likely a scraper failure
      if (data.length === 0) {
        console.log(`  ⚠️  ${book} returned 0 games - retrying once...`);
        const retryStartTime = Date.now();
        data = await scraper.scrape();
        elapsed = Date.now() - retryStartTime;
        
        if (data.length === 0) {
          console.log(`  ❌ ${book} still returned 0 games after retry - marking as FAILED`);
          scraperResults[book] = [];
          scraperPerformance.books[book] = {
            status: 'failed',
            reason: 'Returned 0 games after retry',
            games: 0,
            markets: 0,
            duration: elapsed
          };
          continue;
        } else {
          console.log(`  ✅ Retry successful - got ${data.length} games`);
        }
      }
      
      scraperResults[book] = data;
      scraperPerformance.books[book] = {
        status: 'success',
        games: data.length,
        markets: data.reduce((sum, g) => {
          let count = 0;
          if (g.markets?.moneyline) count++;
          if (g.markets?.spread) count++;
          if (g.markets?.total) count++;
          return sum + count;
        }, 0),
        duration: elapsed
      };
      
      console.log(`  ✅ ${book}: ${data.length} games, ${scraperPerformance.books[book].markets} markets (${(elapsed/1000).toFixed(1)}s)`);
      
    } catch (error) {
      console.error(`  ❌ ${book} failed: ${error.message}`);
      scraperResults[book] = [];
      scraperPerformance.books[book] = {
        status: 'failed',
        error: error.message,
        games: 0,
        markets: 0,
        duration: Date.now() - bookStartTime
      };
    }
  }
  
  // Match events
  console.log('\n🔍 Matching events across books...');
  const matched = matchEvents(
    scraperResults.draftkings || [],
    scraperResults.fanduel || [],
    scraperResults.betmgm || [],
    scraperResults.espnbet || []
  );
  
  console.log(`  ✅ Matched ${matched.length} events`);
  
  // Analyze markets and find edges
  console.log('\n📈 Analyzing markets...');
  const marketEdges = [];
  const edgeDistribution = {
    '>=2.0%': 0,
    '>=1.5%': 0,
    '>=1.0%': 0,
    '>=0.5%': 0,
    '>=0.0%': 0,
    '<0.0%': 0
  };
  
  matched.forEach(event => {
    Object.entries(event.markets).forEach(([marketKey, market]) => {
      const books = Object.keys(market.books);
      
      if (books.length < 2) return;
      
      // Analyze based on market type
      if (market.marketType === 'moneyline') {
        // Find best odds for each side
        let bestAway = null;
        let bestHome = null;
        
        books.forEach(book => {
          const data = market.books[book];
          if (!bestAway || data.awayOdds > bestAway.odds) {
            bestAway = { book, odds: data.awayOdds, decimal: americanToDecimal(data.awayOdds) };
          }
          if (!bestHome || data.homeOdds > bestHome.odds) {
            bestHome = { book, odds: data.homeOdds, decimal: americanToDecimal(data.homeOdds) };
          }
        });
        
        if (bestAway && bestHome) {
          const margin = calculateMargin([bestAway.odds, bestHome.odds]);
          
          // Categorize edge
          if (margin >= 2.0) edgeDistribution['>=2.0%']++;
          else if (margin >= 1.5) edgeDistribution['>=1.5%']++;
          else if (margin >= 1.0) edgeDistribution['>=1.0%']++;
          else if (margin >= 0.5) edgeDistribution['>=0.5%']++;
          else if (margin >= 0.0) edgeDistribution['>=0.0%']++;
          else edgeDistribution['<0.0%']++;
          
          marketEdges.push({
            timestamp,
            cycle: cycleCount,
            eventId: event.eventId,
            sport: 'nfl',
            league: 'nfl',
            marketType: 'moneyline',
            teams: `${event.awayTeam} @ ${event.homeTeam}`,
            booksInvolved: books.join(','),
            bestAwayBook: bestAway.book,
            bestAwayOdds: bestAway.odds,
            bestHomeBook: bestHome.book,
            bestHomeOdds: bestHome.odds,
            margin: parseFloat(margin.toFixed(4)),
            isArbitrage: margin < 0
          });
        }
      }
      
      else if (market.marketType === 'spread') {
        let bestAway = null;
        let bestHome = null;
        
        books.forEach(book => {
          const data = market.books[book];
          if (!bestAway || data.awayOdds > bestAway.odds) {
            bestAway = { 
              book, 
              odds: data.awayOdds, 
              line: data.awayLine,
              decimal: americanToDecimal(data.awayOdds) 
            };
          }
          if (!bestHome || data.homeOdds > bestHome.odds) {
            bestHome = { 
              book, 
              odds: data.homeOdds, 
              line: data.homeLine,
              decimal: americanToDecimal(data.homeOdds) 
            };
          }
        });
        
        if (bestAway && bestHome) {
          const margin = calculateMargin([bestAway.odds, bestHome.odds]);
          
          if (margin >= 2.0) edgeDistribution['>=2.0%']++;
          else if (margin >= 1.5) edgeDistribution['>=1.5%']++;
          else if (margin >= 1.0) edgeDistribution['>=1.0%']++;
          else if (margin >= 0.5) edgeDistribution['>=0.5%']++;
          else if (margin >= 0.0) edgeDistribution['>=0.0%']++;
          else edgeDistribution['<0.0%']++;
          
          marketEdges.push({
            timestamp,
            cycle: cycleCount,
            eventId: event.eventId,
            sport: 'nfl',
            league: 'nfl',
            marketType: 'spread',
            spreadLine: marketKey.split('_')[1],
            teams: `${event.awayTeam} @ ${event.homeTeam}`,
            booksInvolved: books.join(','),
            bestAwayBook: bestAway.book,
            bestAwayOdds: bestAway.odds,
            bestAwayLine: bestAway.line,
            bestHomeBook: bestHome.book,
            bestHomeOdds: bestHome.odds,
            bestHomeLine: bestHome.line,
            margin: parseFloat(margin.toFixed(4)),
            isArbitrage: margin < 0
          });
        }
      }
      
      else if (market.marketType === 'total') {
        let bestOver = null;
        let bestUnder = null;
        
        books.forEach(book => {
          const data = market.books[book];
          if (!bestOver || data.overOdds > bestOver.odds) {
            bestOver = { 
              book, 
              odds: data.overOdds, 
              line: data.line,
              decimal: americanToDecimal(data.overOdds) 
            };
          }
          if (!bestUnder || data.underOdds > bestUnder.odds) {
            bestUnder = { 
              book, 
              odds: data.underOdds, 
              line: data.line,
              decimal: americanToDecimal(data.underOdds) 
            };
          }
        });
        
        if (bestOver && bestUnder) {
          const margin = calculateMargin([bestOver.odds, bestUnder.odds]);
          
          if (margin >= 2.0) edgeDistribution['>=2.0%']++;
          else if (margin >= 1.5) edgeDistribution['>=1.5%']++;
          else if (margin >= 1.0) edgeDistribution['>=1.0%']++;
          else if (margin >= 0.5) edgeDistribution['>=0.5%']++;
          else if (margin >= 0.0) edgeDistribution['>=0.0%']++;
          else edgeDistribution['<0.0%']++;
          
          marketEdges.push({
            timestamp,
            cycle: cycleCount,
            eventId: event.eventId,
            sport: 'nfl',
            league: 'nfl',
            marketType: 'total',
            totalLine: marketKey.split('_')[1],
            teams: `${event.awayTeam} @ ${event.homeTeam}`,
            booksInvolved: books.join(','),
            bestOverBook: bestOver.book,
            bestOverOdds: bestOver.odds,
            bestUnderBook: bestUnder.book,
            bestUnderOdds: bestUnder.odds,
            margin: parseFloat(margin.toFixed(4)),
            isArbitrage: margin < 0
          });
        }
      }
    });
  });
  
  // Log all market edges
  if (marketEdges.length > 0) {
    logMarketEdges(marketEdges);
  }
  
  // Log scraper performance
  logScraperPerformance(scraperPerformance);
  
  // Create cycle summary
  const totalGames = Object.values(scraperPerformance.books)
    .reduce((sum, b) => sum + b.games, 0);
  const totalMarkets = Object.values(scraperPerformance.books)
    .reduce((sum, b) => sum + b.markets, 0);
  const successfulBooks = Object.values(scraperPerformance.books)
    .filter(b => b.status === 'success').length;
  
  const cycleSummary = {
    timestamp,
    cycle: cycleCount,
    cycleDuration: Date.now() - cycleStartTime,
    totalGamesScraped: totalGames,
    totalMarketsScraped: totalMarkets,
    matchedEvents: matched.length,
    marketsCompared: marketEdges.length,
    successfulBooks,
    failedBooks: 4 - successfulBooks,
    edgeDistribution,
    arbitragesFound: marketEdges.filter(e => e.isArbitrage).length
  };
  
  logCycleSummary(cycleSummary);
  
  // Console output
  const cycleElapsed = (Date.now() - cycleStartTime) / 1000;
  const totalElapsed = (Date.now() - startTime) / 1000;
  
  console.log('\n📊 CYCLE SUMMARY:');
  console.log(`  Duration: ${cycleElapsed.toFixed(1)}s`);
  console.log(`  Games Scraped: ${totalGames}`);
  console.log(`  Markets Scraped: ${totalMarkets}`);
  console.log(`  Events Matched: ${matched.length}`);
  console.log(`  Markets Compared: ${marketEdges.length}`);
  
  console.log('\n📚 BOOK HEALTH:');
  Object.entries(scraperPerformance.books).forEach(([book, stats]) => {
    const status = stats.status === 'success' ? '✅ OK' : '❌ FAIL';
    const reason = stats.reason || stats.error || '';
    const detail = stats.status === 'success' 
      ? `${stats.games} games, ${stats.markets} markets`
      : reason;
    console.log(`  ${book}: ${status} (${detail})`);
  });
  console.log(`  Summary: ${successfulBooks}/4 books operational`);
  
  console.log('\n📈 EDGE DISTRIBUTION:');
  console.log(`  >= 2.0%: ${edgeDistribution['>=2.0%']}`);
  console.log(`  >= 1.5%: ${edgeDistribution['>=1.5%']}`);
  console.log(`  >= 1.0%: ${edgeDistribution['>=1.0%']}`);
  console.log(`  >= 0.5%: ${edgeDistribution['>=0.5%']}`);
  console.log(`  >= 0.0%: ${edgeDistribution['>=0.0%']}`);
  console.log(`  <  0.0% (ARBS): ${edgeDistribution['<0.0%']}`);
  
  if (cycleSummary.arbitragesFound > 0) {
    console.log(`\n🎯 ARBITRAGES FOUND: ${cycleSummary.arbitragesFound}`);
    const arbs = marketEdges.filter(e => e.isArbitrage);
    arbs.forEach(arb => {
      console.log(`  • ${arb.teams} (${arb.marketType}): ${arb.margin.toFixed(3)}%`);
    });
  }
  
  console.log(`\n⏱  Total Runtime: ${(totalElapsed/60).toFixed(1)} minutes`);
  console.log(`💾 Logs: ${SOAK_CONFIG.logDirectory}/`);
  
  return cycleSummary;
}

/**
 * Main soak test loop
 */
async function runSoakTest() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           SOAK TEST - CONTINUOUS MONITORING MODE              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nConfiguration:`);
  console.log(`  Cycle Interval: ${SOAK_CONFIG.cycleInterval/1000}s`);
  console.log(`  Max Cycles: ${SOAK_CONFIG.maxCycles || 'Unlimited'}`);
  console.log(`  Log Directory: ${SOAK_CONFIG.logDirectory}`);
  console.log(`  Start Time: ${new Date().toISOString()}`);
  console.log(`\nPress Ctrl+C to stop\n`);
  
  while (true) {
    try {
      await runCycle();
      
      // Check if we should stop
      if (SOAK_CONFIG.maxCycles && cycleCount >= SOAK_CONFIG.maxCycles) {
        console.log(`\n✅ Reached max cycles (${SOAK_CONFIG.maxCycles}). Stopping.`);
        break;
      }
      
      // Wait for next cycle
      console.log(`\n⏳ Waiting ${SOAK_CONFIG.cycleInterval/1000}s until next cycle...`);
      await new Promise(resolve => setTimeout(resolve, SOAK_CONFIG.cycleInterval));
      
    } catch (error) {
      console.error('\n❌ Cycle failed:', error.message);
      console.error(error.stack);
      
      // Wait before retrying
      console.log(`\n⏳ Waiting ${SOAK_CONFIG.cycleInterval/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, SOAK_CONFIG.cycleInterval));
    }
  }
  
  // Generate final report
  console.log('\n' + '='.repeat(80));
  console.log('SOAK TEST COMPLETE - GENERATING REPORT');
  console.log('='.repeat(80));
  
  const totalRuntime = (Date.now() - startTime) / 1000 / 60;
  console.log(`\nTotal Runtime: ${totalRuntime.toFixed(1)} minutes`);
  console.log(`Total Cycles: ${cycleCount}`);
  console.log(`\nLogs saved to: ${SOAK_CONFIG.logDirectory}/`);
  console.log(`  - cycle-summary.jsonl`);
  console.log(`  - market-edges.jsonl`);
  console.log(`  - scraper-performance.jsonl`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received SIGINT. Shutting down gracefully...');
  console.log(`Total cycles completed: ${cycleCount}`);
  console.log(`Logs saved to: ${SOAK_CONFIG.logDirectory}/`);
  process.exit(0);
});

// Start the soak test
runSoakTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});