// tests/analyze-soak-data.js
// Analyze soak test results and generate reports

const fs = require('fs');
const path = require('path');

const LOG_DIR = './soak-logs';

/**
 * Read JSONL file and parse lines
 */
function readJSONL(filename) {
  const filepath = path.join(LOG_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    console.warn(`⚠️  File not found: ${filepath}`);
    return [];
  }
  
  const content = fs.readFileSync(filepath, 'utf8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

/**
 * Analyze cycle summaries
 */
function analyzeCycleSummaries() {
  const summaries = readJSONL('cycle-summary.jsonl');
  
  if (summaries.length === 0) {
    console.log('❌ No cycle data found');
    return null;
  }
  
  const totalCycles = summaries.length;
  const successfulCycles = summaries.filter(s => s.successfulBooks >= 3).length;
  const totalArbitrages = summaries.reduce((sum, s) => sum + (s.arbitragesFound || 0), 0);
  
  // Calculate averages
  const avgGames = summaries.reduce((sum, s) => sum + s.totalGamesScraped, 0) / totalCycles;
  const avgMarkets = summaries.reduce((sum, s) => sum + s.totalMarketsScraped, 0) / totalCycles;
  const avgMatched = summaries.reduce((sum, s) => sum + s.matchedEvents, 0) / totalCycles;
  const avgCompared = summaries.reduce((sum, s) => sum + s.marketsCompared, 0) / totalCycles;
  const avgDuration = summaries.reduce((sum, s) => sum + s.cycleDuration, 0) / totalCycles;
  
  // Aggregate edge distribution
  const totalEdges = {
    '>=2.0%': 0,
    '>=1.5%': 0,
    '>=1.0%': 0,
    '>=0.5%': 0,
    '>=0.0%': 0,
    '<0.0%': 0
  };
  
  summaries.forEach(s => {
    if (s.edgeDistribution) {
      Object.keys(totalEdges).forEach(key => {
        totalEdges[key] += s.edgeDistribution[key] || 0;
      });
    }
  });
  
  // Calculate time range
  const startTime = new Date(summaries[0].timestamp);
  const endTime = new Date(summaries[summaries.length - 1].timestamp);
  const durationHours = (endTime - startTime) / (1000 * 60 * 60);
  
  return {
    totalCycles,
    successfulCycles,
    successRate: (successfulCycles / totalCycles * 100).toFixed(1),
    totalArbitrages,
    arbsPerCycle: (totalArbitrages / totalCycles).toFixed(2),
    avgGames: avgGames.toFixed(1),
    avgMarkets: avgMarkets.toFixed(1),
    avgMatched: avgMatched.toFixed(1),
    avgCompared: avgCompared.toFixed(1),
    avgDuration: (avgDuration / 1000).toFixed(1),
    totalEdges,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationHours: durationHours.toFixed(1)
  };
}

/**
 * Analyze market edges
 */
function analyzeMarketEdges() {
  const edges = readJSONL('market-edges.jsonl');
  
  if (edges.length === 0) {
    console.log('❌ No edge data found');
    return null;
  }
  
  const arbitrages = edges.filter(e => e.isArbitrage);
  
  // Analyze by market type
  const byMarketType = {};
  edges.forEach(e => {
    if (!byMarketType[e.marketType]) {
      byMarketType[e.marketType] = {
        total: 0,
        arbitrages: 0,
        margins: []
      };
    }
    byMarketType[e.marketType].total++;
    if (e.isArbitrage) byMarketType[e.marketType].arbitrages++;
    byMarketType[e.marketType].margins.push(e.margin);
  });
  
  // Calculate statistics for each market type
  Object.keys(byMarketType).forEach(type => {
    const margins = byMarketType[type].margins.sort((a, b) => a - b);
    byMarketType[type].avgMargin = (margins.reduce((a, b) => a + b, 0) / margins.length).toFixed(3);
    byMarketType[type].minMargin = margins[0].toFixed(3);
    byMarketType[type].maxMargin = margins[margins.length - 1].toFixed(3);
    byMarketType[type].medianMargin = margins[Math.floor(margins.length / 2)].toFixed(3);
    delete byMarketType[type].margins; // Remove raw data
  });
  
  // Find best opportunities
  const bestOpportunities = edges
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 10)
    .map(e => ({
      timestamp: e.timestamp,
      teams: e.teams,
      marketType: e.marketType,
      margin: e.margin.toFixed(3) + '%',
      isArbitrage: e.isArbitrage
    }));
  
  // Analyze by book combination
  const bookCombinations = {};
  edges.forEach(e => {
    let bookPair;
    if (e.marketType === 'moneyline') {
      bookPair = [e.bestAwayBook, e.bestHomeBook].sort().join('-');
    } else if (e.marketType === 'spread') {
      bookPair = [e.bestAwayBook, e.bestHomeBook].sort().join('-');
    } else if (e.marketType === 'total') {
      bookPair = [e.bestOverBook, e.bestUnderBook].sort().join('-');
    }
    
    if (bookPair) {
      if (!bookCombinations[bookPair]) {
        bookCombinations[bookPair] = {
          count: 0,
          arbitrages: 0,
          avgMargin: 0,
          margins: []
        };
      }
      bookCombinations[bookPair].count++;
      if (e.isArbitrage) bookCombinations[bookPair].arbitrages++;
      bookCombinations[bookPair].margins.push(e.margin);
    }
  });
  
  // Calculate average margins for book combinations
  Object.keys(bookCombinations).forEach(pair => {
    const margins = bookCombinations[pair].margins;
    bookCombinations[pair].avgMargin = (margins.reduce((a, b) => a + b, 0) / margins.length).toFixed(3);
    delete bookCombinations[pair].margins;
  });
  
  return {
    totalEdges: edges.length,
    totalArbitrages: arbitrages.length,
    arbPercentage: (arbitrages.length / edges.length * 100).toFixed(2),
    byMarketType,
    bestOpportunities,
    bookCombinations
  };
}

/**
 * Analyze scraper performance
 */
function analyzeScraperPerformance() {
  const performance = readJSONL('scraper-performance.jsonl');
  
  if (performance.length === 0) {
    console.log('❌ No performance data found');
    return null;
  }
  
  const bookStats = {};
  
  performance.forEach(cycle => {
    Object.entries(cycle.books).forEach(([book, stats]) => {
      if (!bookStats[book]) {
        bookStats[book] = {
          totalCycles: 0,
          successfulCycles: 0,
          failedCycles: 0,
          totalGames: 0,
          totalMarkets: 0,
          totalDuration: 0,
          errors: []
        };
      }
      
      bookStats[book].totalCycles++;
      
      if (stats.status === 'success') {
        bookStats[book].successfulCycles++;
        bookStats[book].totalGames += stats.games;
        bookStats[book].totalMarkets += stats.markets;
      } else {
        bookStats[book].failedCycles++;
        if (stats.error) bookStats[book].errors.push(stats.error);
      }
      
      bookStats[book].totalDuration += stats.duration;
    });
  });
  
  // Calculate averages
  Object.keys(bookStats).forEach(book => {
    const stats = bookStats[book];
    stats.successRate = (stats.successfulCycles / stats.totalCycles * 100).toFixed(1);
    stats.avgGames = (stats.totalGames / stats.successfulCycles).toFixed(1);
    stats.avgMarkets = (stats.totalMarkets / stats.successfulCycles).toFixed(1);
    stats.avgDuration = (stats.totalDuration / stats.totalCycles / 1000).toFixed(1);
    stats.uniqueErrors = [...new Set(stats.errors)];
    delete stats.errors;
  });
  
  return bookStats;
}

/**
 * Generate comprehensive report
 */
function generateReport() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              SOAK TEST ANALYTICS REPORT                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Cycle Summary Analysis
  console.log('📊 CYCLE SUMMARY ANALYSIS');
  console.log('─'.repeat(80));
  const cycleSummary = analyzeCycleSummaries();
  
  if (cycleSummary) {
    console.log(`Total Cycles: ${cycleSummary.totalCycles}`);
    console.log(`Successful Cycles: ${cycleSummary.successfulCycles} (${cycleSummary.successRate}%)`);
    console.log(`Duration: ${cycleSummary.durationHours} hours`);
    console.log(`Period: ${cycleSummary.startTime} to ${cycleSummary.endTime}`);
    console.log(`\nAverages per Cycle:`);
    console.log(`  Games Scraped: ${cycleSummary.avgGames}`);
    console.log(`  Markets Scraped: ${cycleSummary.avgMarkets}`);
    console.log(`  Events Matched: ${cycleSummary.avgMatched}`);
    console.log(`  Markets Compared: ${cycleSummary.avgCompared}`);
    console.log(`  Cycle Duration: ${cycleSummary.avgDuration}s`);
    console.log(`\nArbitrage Detection:`);
    console.log(`  Total Arbitrages Found: ${cycleSummary.totalArbitrages}`);
    console.log(`  Arbitrages per Cycle: ${cycleSummary.arbsPerCycle}`);
    console.log(`\nEdge Distribution (Total):`);
    Object.entries(cycleSummary.totalEdges).forEach(([range, count]) => {
      console.log(`  ${range}: ${count}`);
    });
  }
  
  // Market Edge Analysis
  console.log('\n\n📈 MARKET EDGE ANALYSIS');
  console.log('─'.repeat(80));
  const edgeAnalysis = analyzeMarketEdges();
  
  if (edgeAnalysis) {
    console.log(`Total Edges Analyzed: ${edgeAnalysis.totalEdges}`);
    console.log(`Total Arbitrages: ${edgeAnalysis.totalArbitrages} (${edgeAnalysis.arbPercentage}%)`);
    
    console.log(`\nBy Market Type:`);
    Object.entries(edgeAnalysis.byMarketType).forEach(([type, stats]) => {
      console.log(`  ${type.toUpperCase()}:`);
      console.log(`    Total: ${stats.total}`);
      console.log(`    Arbitrages: ${stats.arbitrages}`);
      console.log(`    Avg Margin: ${stats.avgMargin}%`);
      console.log(`    Min Margin: ${stats.minMargin}%`);
      console.log(`    Max Margin: ${stats.maxMargin}%`);
      console.log(`    Median Margin: ${stats.medianMargin}%`);
    });
    
    console.log(`\nTop 10 Best Opportunities:`);
    edgeAnalysis.bestOpportunities.forEach((opp, i) => {
      const indicator = opp.isArbitrage ? '🎯' : '📊';
      console.log(`  ${i + 1}. ${indicator} ${opp.teams} (${opp.marketType}): ${opp.margin}`);
    });
    
    console.log(`\nMost Common Book Combinations:`);
    const sortedCombinations = Object.entries(edgeAnalysis.bookCombinations)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    
    sortedCombinations.forEach(([pair, stats]) => {
      console.log(`  ${pair}: ${stats.count} opportunities (${stats.arbitrages} arbs, avg: ${stats.avgMargin}%)`);
    });
  }
  
  // Scraper Performance Analysis
  console.log('\n\n⚙️  SCRAPER PERFORMANCE ANALYSIS');
  console.log('─'.repeat(80));
  const scraperPerf = analyzeScraperPerformance();
  
  if (scraperPerf) {
    Object.entries(scraperPerf).forEach(([book, stats]) => {
      console.log(`${book.toUpperCase()}:`);
      console.log(`  Success Rate: ${stats.successRate}% (${stats.successfulCycles}/${stats.totalCycles})`);
      console.log(`  Avg Games: ${stats.avgGames}`);
      console.log(`  Avg Markets: ${stats.avgMarkets}`);
      console.log(`  Avg Duration: ${stats.avgDuration}s`);
      if (stats.uniqueErrors.length > 0) {
        console.log(`  Errors: ${stats.uniqueErrors.length} unique`);
        stats.uniqueErrors.slice(0, 3).forEach(err => {
          console.log(`    - ${err}`);
        });
      }
      console.log();
    });
  }
  
  // Save report to file
  const report = {
    generatedAt: new Date().toISOString(),
    cycleSummary,
    edgeAnalysis,
    scraperPerformance: scraperPerf
  };
  
  const reportPath = path.join(LOG_DIR, 'analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);
  
  console.log('\n' + '='.repeat(80));
}

// Run analysis
if (!fs.existsSync(LOG_DIR)) {
  console.error(`❌ Log directory not found: ${LOG_DIR}`);
  console.error('Run soak-test.js first to generate data.');
  process.exit(1);
}

generateReport();