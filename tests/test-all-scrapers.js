// tests/test-all-scrapers.js
const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');
const BetMGMScraper = require('../src/scrapers/betmgm');
const ESPNBetScraper = require('../src/scrapers/espnbet');

async function testAllScrapers() {
  console.log('============================================================');
  console.log('🧪 TESTING ALL SCRAPERS');
  console.log('============================================================\n');

  const results = {
    draftkings: { success: false, games: 0, markets: 0, error: null },
    fanduel: { success: false, games: 0, markets: 0, error: null },
    betmgm: { success: false, games: 0, markets: 0, error: null },
    espnbet: { success: false, games: 0, markets: 0, error: null }
  };

  // Test DraftKings
  console.log('📊 Testing DraftKings...');
  try {
    const dkScraper = new DraftKingsScraper();
    const dkData = await dkScraper.scrape();
    const mlCount = dkData.filter(g => g.markets?.moneyline).length;
    const spreadCount = dkData.filter(g => g.markets?.spread).length;
    const totalCount = dkData.filter(g => g.markets?.total).length;
    
    results.draftkings = {
      success: true,
      games: dkData.length,
      markets: mlCount + spreadCount + totalCount,
      moneylines: mlCount,
      spreads: spreadCount,
      totals: totalCount
    };
    
    console.log(`✅ DraftKings: ${dkData.length} games, ${mlCount + spreadCount + totalCount} markets`);
    console.log(`   ML: ${mlCount}, Spread: ${spreadCount}, Total: ${totalCount}\n`);
  } catch (error) {
    results.draftkings.error = error.message;
    console.log(`❌ DraftKings failed: ${error.message}\n`);
  }

  // Test FanDuel
  console.log('📊 Testing FanDuel...');
  try {
    const fdScraper = new FanDuelScraper();
    const fdData = await fdScraper.scrape();
    const mlCount = fdData.filter(g => g.markets?.moneyline).length;
    const spreadCount = fdData.filter(g => g.markets?.spread).length;
    const totalCount = fdData.filter(g => g.markets?.total).length;
    
    results.fanduel = {
      success: true,
      games: fdData.length,
      markets: mlCount + spreadCount + totalCount,
      moneylines: mlCount,
      spreads: spreadCount,
      totals: totalCount
    };
    
    console.log(`✅ FanDuel: ${fdData.length} games, ${mlCount + spreadCount + totalCount} markets`);
    console.log(`   ML: ${mlCount}, Spread: ${spreadCount}, Total: ${totalCount}\n`);
  } catch (error) {
    results.fanduel.error = error.message;
    console.log(`❌ FanDuel failed: ${error.message}\n`);
  }

  // Test BetMGM
  console.log('📊 Testing BetMGM...');
  try {
    const mgmScraper = new BetMGMScraper();
    const mgmData = await mgmScraper.scrape();
    const mlCount = mgmData.filter(g => g.markets?.moneyline).length;
    const spreadCount = mgmData.filter(g => g.markets?.spread).length;
    const totalCount = mgmData.filter(g => g.markets?.total).length;
    
    results.betmgm = {
      success: true,
      games: mgmData.length,
      markets: mlCount + spreadCount + totalCount,
      moneylines: mlCount,
      spreads: spreadCount,
      totals: totalCount
    };
    
    console.log(`✅ BetMGM: ${mgmData.length} games, ${mlCount + spreadCount + totalCount} markets`);
    console.log(`   ML: ${mlCount}, Spread: ${spreadCount}, Total: ${totalCount}\n`);
  } catch (error) {
    results.betmgm.error = error.message;
    console.log(`❌ BetMGM failed: ${error.message}\n`);
  }

  // Test ESPN Bet
  console.log('📊 Testing ESPN Bet...');
  try {
    const espnScraper = new ESPNBetScraper();
    const espnData = await espnScraper.scrape();
    const mlCount = espnData.filter(g => g.markets?.moneyline).length;
    const spreadCount = espnData.filter(g => g.markets?.spread).length;
    const totalCount = espnData.filter(g => g.markets?.total).length;
    
    results.espnbet = {
      success: true,
      games: espnData.length,
      markets: mlCount + spreadCount + totalCount,
      moneylines: mlCount,
      spreads: spreadCount,
      totals: totalCount
    };
    
    console.log(`✅ ESPN Bet: ${espnData.length} games, ${mlCount + spreadCount + totalCount} markets`);
    console.log(`   ML: ${mlCount}, Spread: ${spreadCount}, Total: ${totalCount}\n`);
  } catch (error) {
    results.espnbet.error = error.message;
    console.log(`❌ ESPN Bet failed: ${error.message}\n`);
  }

  // Summary
  console.log('============================================================');
  console.log('📊 SUMMARY');
  console.log('============================================================');
  
  const totalGames = results.draftkings.games + results.fanduel.games + results.betmgm.games + results.espnbet.games;
  const totalMarkets = results.draftkings.markets + results.fanduel.markets + results.betmgm.markets + results.espnbet.markets;
  const successCount = [results.draftkings, results.fanduel, results.betmgm, results.espnbet].filter(r => r.success).length;
  
  console.log(`Total Games: ${totalGames}`);
  console.log(`Total Markets: ${totalMarkets}`);
  console.log(`Scrapers Working: ${successCount}/4\n`);
  
  Object.entries(results).forEach(([name, data]) => {
    const status = data.success ? '✅' : '❌';
    console.log(`${status} ${name.toUpperCase()}: ${data.games} games, ${data.markets} markets`);
    if (data.error) console.log(`   Error: ${data.error}`);
  });
  
  console.log('\n============================================================');
  
  if (successCount === 4) {
    console.log('✅ ALL SCRAPERS WORKING!');
  } else {
    console.log(`⚠️  ${4 - successCount} scraper(s) failed`);
  }
  console.log('============================================================');
}

testAllScrapers().catch(console.error);