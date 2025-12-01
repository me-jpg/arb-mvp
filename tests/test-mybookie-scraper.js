// tests/test-mybookie-scraper.js
// Test MyBookie scraper

require('dotenv').config();
const MyBookieScraper = require('../src/scrapers/mybookie');

async function test() {
  console.log('🧪 Testing MyBookie Scraper\n');
  
  try {
    const scraper = new MyBookieScraper();
    console.log('Scraping MyBookie...\n');
    
    const odds = await scraper.scrape();
    
    console.log(`\n✅ Successfully scraped ${odds.length} games\n`);
    
    if (odds.length === 0) {
      console.log('⚠️  WARNING: 0 games extracted!');
      console.log('The scraper needs adjustment for MyBookie structure.\n');
      return;
    }
    
    console.log('First 3 games:');
    odds.slice(0, 3).forEach((game, i) => {
      console.log(`\nGame ${i + 1}:`);
      console.log(`  ${game.awayTeam} @ ${game.homeTeam}`);
      console.log(`  Away: ${game.awayOdds > 0 ? '+' : ''}${game.awayOdds}`);
      console.log(`  Home: ${game.homeOdds > 0 ? '+' : ''}${game.homeOdds}`);
    });
    
    console.log('\n✅ MyBookie scraper is working!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

test();