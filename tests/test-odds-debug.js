// tests/test-odds-debug.js
// Debug test to see what odds are being extracted

require('dotenv').config();
const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');

async function test() {
  console.log('🔍 ODDS EXTRACTION DIAGNOSTIC\n');
  
  try {
    // Test DraftKings
    console.log('=== DRAFTKINGS ===');
    const dkScraper = new DraftKingsScraper();
    const dkOdds = await dkScraper.scrape();
    
    console.log('\nFirst 3 games from DraftKings:');
    dkOdds.slice(0, 3).forEach((game, i) => {
      console.log(`\nGame ${i + 1}:`);
      console.log(`  ${game.awayTeam} @ ${game.homeTeam}`);
      console.log(`  Away odds: ${game.awayOdds}`);
      console.log(`  Home odds: ${game.homeOdds}`);
    });
    
    // Test FanDuel
    console.log('\n\n=== FANDUEL ===');
    const fdScraper = new FanDuelScraper();
    const fdOdds = await fdScraper.scrape();
    
    console.log('\nFirst 3 games from FanDuel:');
    fdOdds.slice(0, 3).forEach((game, i) => {
      console.log(`\nGame ${i + 1}:`);
      console.log(`  ${game.awayTeam} @ ${game.homeTeam}`);
      console.log(`  Away odds: ${game.awayOdds}`);
      console.log(`  Home odds: ${game.homeOdds}`);
    });
    
    // Find the MIN @ SEA game specifically
    console.log('\n\n=== MINNESOTA @ SEATTLE ===');
    const dkMinSea = dkOdds.find(g => 
      g.awayTeam.includes('MIN') && g.homeTeam.includes('SEA') ||
      g.awayTeam.includes('Vikings') && g.homeTeam.includes('Seahawks')
    );
    const fdMinSea = fdOdds.find(g => 
      g.awayTeam.includes('MIN') && g.homeTeam.includes('SEA') ||
      g.awayTeam.includes('Vikings') && g.homeTeam.includes('Seahawks')
    );
    
    if (dkMinSea) {
      console.log('\nDraftKings:');
      console.log(`  ${dkMinSea.awayTeam} @ ${dkMinSea.homeTeam}`);
      console.log(`  Away odds: ${dkMinSea.awayOdds}`);
      console.log(`  Home odds: ${dkMinSea.homeOdds}`);
    }
    
    if (fdMinSea) {
      console.log('\nFanDuel:');
      console.log(`  ${fdMinSea.awayTeam} @ ${fdMinSea.homeTeam}`);
      console.log(`  Away odds: ${fdMinSea.awayOdds}`);
      console.log(`  Home odds: ${fdMinSea.homeOdds}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

test();