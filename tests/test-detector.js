// tests/test-detector.js
// Test the arbitrage detector with live odds

require('dotenv').config();
const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');
const { matchEvents } = require('../src/core/normalizer');
const { detectArbitrages } = require('../src/core/detector');

async function test() {
  console.log('Testing arbitrage detector...\n');
  
  try {
    // Scrape both books
    console.log('📡 Scraping books...');
    const dkScraper = new DraftKingsScraper();
    const fdScraper = new FanDuelScraper();
    
    const [dkOdds, fdOdds] = await Promise.all([
      dkScraper.scrape(),
      fdScraper.scrape()
    ]);
    
    console.log(`✅ DK: ${dkOdds.length} | FD: ${fdOdds.length}\n`);
    
    // Match events
    console.log('🔄 Matching events...');
    const matchedEvents = matchEvents(dkOdds, fdOdds);
    console.log(`✅ ${matchedEvents.length} matched\n`);
    
    // Detect arbitrages
    console.log('🔍 Detecting arbitrages...');
    const arbitrages = detectArbitrages(matchedEvents);
    console.log(`[Detector] Found ${arbitrages.length} arbitrage opportunities\n`);
    
    // Display results
    if (arbitrages.length > 0) {
      console.log(`🚨 FOUND ${arbitrages.length} ARBITRAGES!\n`);
      
      arbitrages.forEach((arb, i) => {
        console.log(`=== ARB ${i + 1} ===`);
        console.log(`Event: ${arb.event}`);
        console.log(`Profit: ${arb.profitMargin.toFixed(2)}% ($${arb.profitAmount.toFixed(2)})`);
        console.log(`Leg 1: ${arb.book1} - ${arb.selection1} @ ${arb.odds1} ($${arb.stake1.toFixed(2)})`);
        console.log(`Leg 2: ${arb.book2} - ${arb.selection2} @ ${arb.odds2} ($${arb.stake2.toFixed(2)})`);
        console.log(`URLs:`);
        console.log(`  ${arb.url1}`);
        console.log(`  ${arb.url2}`);
        console.log();
      });
    } else {
      console.log('🚨 FOUND 0 ARBITRAGES!');
      console.log('\nThis is normal - arbitrages are rare!');
      console.log('Options:');
      console.log('1. Wait a few minutes and run again (odds change constantly)');
      console.log('2. Lower threshold in config.js (currently 0.1%)');
      console.log('3. Proceed to build main.js for continuous monitoring');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

test();