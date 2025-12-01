const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');

async function test() {
  console.log('Testing both scrapers...\n');
  
  console.log('=== DRAFTKINGS ===');
  const dk = new DraftKingsScraper();
  const dkOdds = await dk.scrape();
  console.log(`✅ ${dkOdds.length} games\n`);
  
  console.log('=== FANDUEL ===');
  const fd = new FanDuelScraper();
  const fdOdds = await fd.scrape();
  console.log(`✅ ${fdOdds.length} games\n`);
  
  console.log('=== SAMPLE COMPARISON ===');
  console.log('\nDraftKings Game 1:');
  console.log(`  ${dkOdds[0].awayTeam} @ ${dkOdds[0].homeTeam}`);
  
  console.log('\nFanDuel Game 1:');
  console.log(`  ${fdOdds[0].awayTeam} @ ${fdOdds[0].homeTeam}`);
  
  console.log('\n✅ Both scrapers working!');
}

test();