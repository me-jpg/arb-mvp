// tests/test-betmgm-scraper.js
// Test BetMGM scraper

require('dotenv').config();
const BetMGMScraper = require('../src/scrapers/betmgm');

async function test() {
  console.log('🧪 Testing BetMGM Scraper\n');
  
  try {
    const scraper = new BetMGMScraper();
    console.log('Scraping BetMGM...\n');
    
    const odds = await scraper.scrape();
    
    console.log(`\n✅ Successfully scraped ${odds.length} games\n`);
    
    if (odds.length === 0) {
      console.log('⚠️  WARNING: 0 games extracted!');
      console.log('This likely means the selectors/pattern is wrong.');
      console.log('Run test-betmgm-inspect.js to find correct selectors.\n');
      return;
    }
    
    console.log('First 3 games:');
    odds.slice(0, 3).forEach((game, i) => {
      console.log(`\nGame ${i + 1}:`);
      console.log(`  ${game.awayTeam} @ ${game.homeTeam}`);
      console.log(`  Away: ${game.awayOdds > 0 ? '+' : ''}${game.awayOdds}`);
      console.log(`  Home: ${game.homeOdds > 0 ? '+' : ''}${game.homeOdds}`);
    });
    
    console.log('\n✅ BetMGM scraper is working!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

test();