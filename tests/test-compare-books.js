// tests/test-compare-books.js
// Compare what different books are scraping

require('dotenv').config();
const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');

async function test() {
  console.log('🔍 Comparing DraftKings vs FanDuel\n');
  
  const dkScraper = new DraftKingsScraper();
  const fdScraper = new FanDuelScraper();
  
  const [dkOdds, fdOdds] = await Promise.all([
    dkScraper.scrape(),
    fdScraper.scrape()
  ]);
  
  console.log('📊 DraftKings Games:');
  dkOdds.forEach((game, i) => {
    console.log(`  ${i+1}. ${game.awayTeam} @ ${game.homeTeam}`);
  });
  
  console.log('\n📊 FanDuel Games:');
  fdOdds.forEach((game, i) => {
    console.log(`  ${i+1}. ${game.awayTeam} @ ${game.homeTeam}`);
  });
  
  // Find overlaps
  console.log('\n🔍 Looking for matches...');
  const dkTeams = new Set();
  dkOdds.forEach(game => {
    dkTeams.add(game.awayTeam.toLowerCase());
    dkTeams.add(game.homeTeam.toLowerCase());
  });
  
  const fdTeams = new Set();
  fdOdds.forEach(game => {
    fdTeams.add(game.awayTeam.toLowerCase());
    fdTeams.add(game.homeTeam.toLowerCase());
  });
  
  const overlap = [...dkTeams].filter(team => fdTeams.has(team));
  console.log(`\nTeams in both: ${overlap.join(', ')}`);
  console.log(`\nDK has ${dkOdds.length} games, FD has ${fdOdds.length} games`);
  console.log(`Overlap: ${overlap.length / 2} teams = ~${overlap.length / 4} potential games`);
}

test();