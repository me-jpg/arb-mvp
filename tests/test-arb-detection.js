// tests/test-arb-detection.js
const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');
const BetMGMScraper = require('../src/scrapers/betmgm');
const ESPNBetScraper = require('../src/scrapers/espnbet');
const { matchEvents } = require('../src/core/normalizer');
const { detectArbitrages } = require('../src/core/detector');

async function testArbDetection() {
  console.log('============================================================');
  console.log('🎯 ARB DETECTION SYSTEM TEST');
  console.log('============================================================\n');

  try {
    // Step 1: Scrape all books
    console.log('📊 STEP 1: Scraping all sportsbooks...\n');
    
    const scrapers = {
      draftkings: new DraftKingsScraper(),
      fanduel: new FanDuelScraper(),
      betmgm: new BetMGMScraper(),
      espnbet: new ESPNBetScraper()
    };
    
    const data = {};
    
    for (const [book, scraper] of Object.entries(scrapers)) {
      console.log(`  Scraping ${book}...`);
      const startTime = Date.now();
      data[book] = await scraper.scrape();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ✅ ${book}: ${data[book].length} games in ${elapsed}s`);
    }
    
    // Step 2: Normalize and match events
    console.log('\n📊 STEP 2: Normalizing and matching events...\n');
    
    const matched = matchEvents(
      data.draftkings,
      data.fanduel,
      data.betmgm,
      data.espnbet
    );
    
    console.log(`\n✅ Matched ${matched.length} events across books`);
    
    // Step 3: Detect arbitrages
    console.log('\n📊 STEP 3: Detecting arbitrage opportunities...\n');
    
    const arbitrages = detectArbitrages(matched);
    
    console.log(`\n✅ Found ${arbitrages.length} arbitrage opportunities!\n`);
    
    // Step 4: Display results
    if (arbitrages.length === 0) {
      console.log('💡 No arbitrages found. This is normal - arbs are rare!');
      console.log('   Try adjusting config.minProfitMargin in config.js for more results.');
    } else {
      console.log('============================================================');
      console.log('💰 ARBITRAGE OPPORTUNITIES');
      console.log('============================================================\n');
      
      // Sort by profit margin (highest first)
      arbitrages.sort((a, b) => b.profitMargin - a.profitMargin);
      
      arbitrages.slice(0, 10).forEach((arb, i) => {
        console.log(`${i + 1}. ${arb.event} - ${arb.marketType.toUpperCase()}`);
        console.log(`   💰 Profit: ${arb.profitMargin.toFixed(2)}% ($${arb.profitAmount.toFixed(2)})`);
        console.log(`   📘 ${arb.book1}: ${arb.selection1} @ ${arb.americanOdds1} (stake: $${arb.stake1.toFixed(2)})`);
        console.log(`   📕 ${arb.book2}: ${arb.selection2} @ ${arb.americanOdds2} (stake: $${arb.stake2.toFixed(2)})`);
        console.log();
      });
      
      if (arbitrages.length > 10) {
        console.log(`... and ${arbitrages.length - 10} more opportunities\n`);
      }
    }
    
    // Summary statistics
    console.log('============================================================');
    console.log('📊 SUMMARY STATISTICS');
    console.log('============================================================');
    console.log(`Total Games Scraped: ${Object.values(data).reduce((sum, arr) => sum + arr.length, 0)}`);
    console.log(`Matched Events: ${matched.length}`);
    console.log(`Total Arbitrages: ${arbitrages.length}`);
    
    if (arbitrages.length > 0) {
      const byMarket = {};
      arbitrages.forEach(arb => {
        byMarket[arb.marketType] = (byMarket[arb.marketType] || 0) + 1;
      });
      
      console.log('\nBy Market Type:');
      Object.entries(byMarket).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
      
      const avgProfit = arbitrages.reduce((sum, arb) => sum + arb.profitMargin, 0) / arbitrages.length;
      const maxProfit = Math.max(...arbitrages.map(arb => arb.profitMargin));
      
      console.log(`\nProfit Statistics:`);
      console.log(`  Average: ${avgProfit.toFixed(2)}%`);
      console.log(`  Maximum: ${maxProfit.toFixed(2)}%`);
    }
    
    console.log('============================================================\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testArbDetection();