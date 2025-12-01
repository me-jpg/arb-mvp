// tests/test-mybookie-steelers.js
require('dotenv').config();
const MyBookieScraper = require('../src/scrapers/mybookie');

async function test() {
  console.log('🔍 Testing MyBookie - Steelers/Ravens game\n');
  
  const scraper = new MyBookieScraper();
  const odds = await scraper.scrape();
  
  const steelersGame = odds.find(g => 
    (g.awayTeam.includes('Steelers') || g.awayTeam.includes('Pittsburgh')) &&
    (g.homeTeam.includes('Ravens') || g.homeTeam.includes('Baltimore'))
  );
  
  if (steelersGame) {
    console.log('MyBookie Steelers @ Ravens:');
    console.log(`  ${steelersGame.awayTeam} @ ${steelersGame.homeTeam}`);
    console.log(`  Away: ${steelersGame.awayOdds > 0 ? '+' : ''}${steelersGame.awayOdds}`);
    console.log(`  Home: ${steelersGame.homeOdds > 0 ? '+' : ''}${steelersGame.homeOdds}`);
  } else {
    console.log('NOT FOUND');
  }
  
  console.log('\nAll MyBookie games:');
  odds.forEach((g, i) => {
    console.log(`${i+1}. ${g.awayTeam} @ ${g.homeTeam} (${g.awayOdds}/${g.homeOdds})`);
  });
}

test();