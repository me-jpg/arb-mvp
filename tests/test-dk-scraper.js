const DraftKingsScraper = require('../src/scrapers/draftkings');

async function test() {
  console.log('Testing DraftKings scraper...\n');
  
  const scraper = new DraftKingsScraper();
  const odds = await scraper.scrape();
  
  console.log('\n📊 RESULTS:');
  console.log(`Total games: ${odds.length}\n`);
  
  odds.forEach((game, i) => {
    console.log(`Game ${i + 1}:`);
    console.log(`  ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`  Away ML: ${game.awayOdds}`);
    console.log(`  Home ML: ${game.homeOdds}`);
    console.log('');
  });
}

test();