const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');
const Normalizer = require('../src/core/normalizer');

async function test() {
  console.log('Testing normalizer...\n');
  
  // Scrape both books
  console.log('📡 Scraping DraftKings...');
  const dk = new DraftKingsScraper();
  const dkOdds = await dk.scrape();
  console.log(`✅ ${dkOdds.length} games\n`);
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('📡 Scraping FanDuel...');
  const fd = new FanDuelScraper();
  const fdOdds = await fd.scrape();
  console.log(`✅ ${fdOdds.length} games\n`);
  
  // Normalize and match
  console.log('🔄 Matching events...');
  const normalizer = new Normalizer();
  const matched = normalizer.matchEvents(dkOdds, fdOdds);
  
  console.log(`\n✅ Matched ${matched.length} events\n`);
  
  // Show first matched event
  if (matched.length > 0) {
    console.log('=== SAMPLE MATCHED EVENT ===');
    const event = matched[0];
    console.log(`Event: ${event.awayTeam} @ ${event.homeTeam}`);
    console.log(`\nDraftKings:`);
    console.log(`  Away ML: ${event.odds.draftkings.awayOdds} (Decimal: ${event.odds.draftkings.awayOddsDecimal.toFixed(2)})`);
    console.log(`  Home ML: ${event.odds.draftkings.homeOdds} (Decimal: ${event.odds.draftkings.homeOddsDecimal.toFixed(2)})`);
    console.log(`\nFanDuel:`);
    console.log(`  Away ML: ${event.odds.fanduel.awayOdds} (Decimal: ${event.odds.fanduel.awayOddsDecimal.toFixed(2)})`);
    console.log(`  Home ML: ${event.odds.fanduel.homeOdds} (Decimal: ${event.odds.fanduel.homeOddsDecimal.toFixed(2)})`);
  }
}

test();