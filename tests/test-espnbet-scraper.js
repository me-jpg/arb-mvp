// tests/test-espnbet-scraper.js
// Test ESPN Bet scraper

require('dotenv').config();
const ESPNBetScraper = require('../src/scrapers/espnbet');

async function test() {
  console.log('🧪 Testing ESPN Bet Scraper\n');
  
  try {
    const scraper = new ESPNBetScraper();
    console.log('Scraping ESPN Bet...\n');
    
    const odds = await scraper.scrape();
    
    console.log(`\n✅ Successfully scraped ${odds.length} games\n`);
    
    if (odds.length === 0) {
      console.log('⚠️  WARNING: 0 games extracted!');
      console.log('The scraper needs adjustment for ESPN Bet structure.\n');
      return;
    }
    
    console.log('First 3 games:');
    odds.slice(0, 3).forEach((game, i) => {
      console.log(`\nGame ${i + 1}:`);
      console.log(`  ${game.awayTeam} @ ${game.homeTeam}`);
      console.log(`  Away: ${game.awayOdds > 0 ? '+' : ''}${game.awayOdds}`);
      console.log(`  Home: ${game.homeOdds > 0 ? '+' : ''}${game.homeOdds}`);
    });
    
    console.log('\n✅ ESPN Bet scraper is working!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

test();