// tests/test-dk-multimarket.js
// Test DraftKings multi-market scraping (ML + Spread + Total)

const DraftKingsScraper = require('../src/scrapers/draftkings');

async function testDraftKings() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING: DraftKings Multi-Market Scraper');
  console.log('='.repeat(60));
  
  try {
    const scraper = new DraftKingsScraper();
    console.log('\n⏳ Scraping DraftKings...');
    
    const startTime = Date.now();
    const results = await scraper.scrape();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Scrape completed in ${duration}s`);
    console.log(`📊 Total games: ${results.length}`);
    
    // Count total markets
    let totalMarkets = 0;
    let mlCount = 0;
    let spreadCount = 0;
    let totalCount = 0;
    
    results.forEach(game => {
      if (game.markets) {
        if (game.markets.moneyline) {
          mlCount++;
          totalMarkets++;
        }
        if (game.markets.spread) {
          spreadCount++;
          totalMarkets++;
        }
        if (game.markets.total) {
          totalCount++;
          totalMarkets++;
        }
      }
    });
    
    console.log(`📊 Total markets: ${totalMarkets}`);
    console.log(`   - Moneyline: ${mlCount}`);
    console.log(`   - Spread: ${spreadCount}`);
    console.log(`   - Total: ${totalCount}`);
    
    // Show first 3 games in detail
    console.log('\n📋 Sample Games:');
    results.slice(0, 3).forEach((game, idx) => {
      console.log(`\n${idx + 1}. ${game.awayTeam} @ ${game.homeTeam}`);
      
      if (game.markets.moneyline) {
        console.log(`   ✅ Moneyline: away=${game.markets.moneyline.awayOdds}, home=${game.markets.moneyline.homeOdds}`);
      } else {
        console.log(`   ❌ Moneyline: missing`);
      }
      
      if (game.markets.spread) {
        console.log(`   ✅ Spread: ${game.markets.spread.awayLine} (${game.markets.spread.awayOdds}) / ${game.markets.spread.homeLine} (${game.markets.spread.homeOdds})`);
      } else {
        console.log(`   ⚠️  Spread: missing`);
      }
      
      if (game.markets.total) {
        console.log(`   ✅ Total: ${game.markets.total.line} (o:${game.markets.total.overOdds}, u:${game.markets.total.underOdds})`);
      } else {
        console.log(`   ⚠️  Total: missing`);
      }
    });
    
    // Validation checks
    console.log('\n🔍 Validation Checks:');
    
    const checks = {
      gamesFound: results.length > 0,
      hasMoneylines: mlCount > 0,
      hasSpreads: spreadCount > 0,
      hasTotals: totalCount > 0,
      expectedGames: results.length >= 20, // Should have at least 20 NFL games
      avgMarketsPerGame: totalMarkets / results.length >= 2 // Average 2+ markets per game
    };
    
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}: ${passed}`);
    });
    
    const allPassed = Object.values(checks).every(v => v === true);
    
    if (allPassed) {
      console.log('\n✅ ALL TESTS PASSED');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED - Review output above');
    }
    
    // Calculate expected vs actual
    const expectedMarkets = results.length * 3; // 3 markets per game
    const coveragePercent = (totalMarkets / expectedMarkets * 100).toFixed(1);
    
    console.log(`\n📊 Market Coverage: ${totalMarkets}/${expectedMarkets} (${coveragePercent}%)`);
    
    if (coveragePercent >= 80) {
      console.log('✅ Good coverage!');
    } else if (coveragePercent >= 50) {
      console.log('⚠️  Moderate coverage - may need scraper refinement');
    } else {
      console.log('❌ Low coverage - scraper needs work');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
}

testDraftKings().then(() => {
  console.log('✅ Test completed\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});