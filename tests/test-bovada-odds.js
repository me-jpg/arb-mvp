// tests/test-bovada-odds.js
require('dotenv').config();
const BovadaScraper = require('../src/scrapers/bovada');

async function test() {
  console.log('🔍 Testing Bovada Scraper\n');
  
  const scraper = new BovadaScraper();
  const odds = await scraper.scrape();
  
  console.log(`Total games: ${odds.length}\n`);
  
  console.log('All Bovada games:');
  odds.forEach((game, i) => {
    console.log(`${i+1}. ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`   Away: ${game.awayOdds > 0 ? '+' : ''}${game.awayOdds}`);
    console.log(`   Home: ${game.homeOdds > 0 ? '+' : ''}${game.homeOdds}`);
  });
}

test();