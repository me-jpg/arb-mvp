// tests/test-arbitrage-engine.js
// Standalone test harness for the arbitrage engine
// Run with: node tests/test-arbitrage-engine.js

const { findArbitrageOpportunities } = require('../src/highfreq/arbitrageEngine');

console.log('='.repeat(60));
console.log('🧪 ARBITRAGE ENGINE TEST');
console.log('='.repeat(60));

// Build synthetic odds array with a CLEAR arbitrage opportunity
// 
// For moneyline arbitrage, we need:
//   Best home price + Best away price → sum of implied probs < 1
//
// American odds to implied probability:
//   Positive odds: 100 / (odds + 100)
//   Negative odds: |odds| / (|odds| + 100)
//
// Example calculation:
//   Best home: +115 → 100/215 = 0.4651 (46.51%)
//   Best away: +120 → 100/220 = 0.4545 (45.45%)
//   Total: 0.9196 (91.96%) < 100% → ARBITRAGE!
//   Edge: 1 - 0.9196 = 8.04%

const syntheticOdds = [
  // Book A (draftkings): home -110, away +120
  {
    eventId: 'TEST_Event_2024-12-04',
    book: 'draftkings',
    marketType: 'moneyline',
    side: 'home',
    line: null,
    price: -110,
    timestamp: Date.now()
  },
  {
    eventId: 'TEST_Event_2024-12-04',
    book: 'draftkings',
    marketType: 'moneyline',
    side: 'away',
    line: null,
    price: +120,  // Best away price!
    timestamp: Date.now()
  },

  // Book B (betmgm): home +115, away -105
  {
    eventId: 'TEST_Event_2024-12-04',
    book: 'betmgm',
    marketType: 'moneyline',
    side: 'home',
    line: null,
    price: +115,  // Best home price!
    timestamp: Date.now()
  },
  {
    eventId: 'TEST_Event_2024-12-04',
    book: 'betmgm',
    marketType: 'moneyline',
    side: 'away',
    line: null,
    price: -105,
    timestamp: Date.now()
  },

  // Book C (espnbet): home -108, away +118
  {
    eventId: 'TEST_Event_2024-12-04',
    book: 'espnbet',
    marketType: 'moneyline',
    side: 'home',
    line: null,
    price: -108,
    timestamp: Date.now()
  },
  {
    eventId: 'TEST_Event_2024-12-04',
    book: 'espnbet',
    marketType: 'moneyline',
    side: 'away',
    line: null,
    price: +118,
    timestamp: Date.now()
  }
];

console.log('\n📊 INPUT: Synthetic odds array');
console.log(`   Total records: ${syntheticOdds.length}`);
console.log('   Books: draftkings, betmgm, espnbet');
console.log('   Market: moneyline');
console.log('\n   Odds by book:');
console.log('   ┌────────────┬──────────┬──────────┐');
console.log('   │ Book       │ Home     │ Away     │');
console.log('   ├────────────┼──────────┼──────────┤');
console.log('   │ draftkings │ -110     │ +120 ⭐  │');
console.log('   │ betmgm     │ +115 ⭐  │ -105     │');
console.log('   │ espnbet    │ -108     │ +118     │');
console.log('   └────────────┴──────────┴──────────┘');
console.log('   ⭐ = Best price for that side\n');

console.log('📐 EXPECTED ARBITRAGE:');
console.log('   Best home: +115 (betmgm) → implied = 100/215 = 46.51%');
console.log('   Best away: +120 (draftkings) → implied = 100/220 = 45.45%');
console.log('   Total implied: 91.96%');
console.log('   Edge: 8.04%\n');

// Run the arbitrage engine with minEdge = 0 to catch ANY positive edge
console.log('🔍 Running arbitrage engine...\n');

const result = findArbitrageOpportunities(syntheticOdds, {
  cycleId: 'test-cycle',
  minEdge: 0  // Catch any positive edge
});

const opportunities = result.opportunities || [];
const stats = result.stats || {};

console.log('='.repeat(60));
console.log('📊 RESULTS');
console.log('='.repeat(60));

console.log(`\n📈 Stats:`);
console.log(`   Events inspected: ${stats.eventsInspected}`);
console.log(`   Markets inspected: ${stats.marketsInspected}`);
console.log(`   Opportunities found: ${stats.opportunitiesFound}`);

if (opportunities.length === 0) {
  console.log('\n❌ NO ARBITRAGE FOUND - This indicates a bug in the engine!');
  console.log('   The synthetic data should produce a clear 8% arbitrage.\n');
  process.exit(1);
}

console.log(`\n✅ ARBITRAGE OPPORTUNITIES FOUND: ${opportunities.length}\n`);

opportunities.forEach((opp, idx) => {
  console.log(`─── Opportunity ${idx + 1} ───`);
  console.log(`   Event ID: ${opp.eventId}`);
  console.log(`   Market: ${opp.marketType}`);
  console.log(`   Edge: ${opp.edgePercent?.toFixed(3)}%`);
  console.log(`   Books: ${opp.bookA} vs ${opp.bookB}`);
  console.log(`   `);
  console.log(`   Leg A: ${opp.sideA} @ ${opp.priceA > 0 ? '+' : ''}${opp.priceA} (${opp.bookA})`);
  console.log(`   Leg B: ${opp.sideB} @ ${opp.priceB > 0 ? '+' : ''}${opp.priceB} (${opp.bookB})`);
  console.log(`   `);
  console.log(`   Stakes ($1000 total):`);
  console.log(`     ${opp.bookA}: $${opp.stakeA?.toFixed(2)}`);
  console.log(`     ${opp.bookB}: $${opp.stakeB?.toFixed(2)}`);
  console.log(`   Expected profit: $${opp.profitAmount?.toFixed(2)}`);
  console.log('');
});

// Validate the math
const bestOpp = opportunities[0];
if (bestOpp && bestOpp.edgePercent > 7 && bestOpp.edgePercent < 9) {
  console.log('✅ TEST PASSED: Edge is approximately 8% as expected');
} else if (bestOpp) {
  console.log(`⚠️  Edge (${bestOpp.edgePercent?.toFixed(2)}%) differs from expected ~8%`);
}

console.log('\n' + '='.repeat(60));
console.log('🏁 TEST COMPLETE');
console.log('='.repeat(60) + '\n');

