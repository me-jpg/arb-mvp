// tests/test-multimarket-matching.js
// Test multi-market event matching across books

const { matchEvents } = require('../src/core/normalizer');

console.log('\n' + '='.repeat(60));
console.log('🧪 TESTING: Multi-Market Event Matching');
console.log('='.repeat(60));

// Mock DraftKings data
const mockDK = [
  {
    book: 'draftkings',
    awayTeam: 'LA Rams',
    homeTeam: 'CAR Panthers',
    gameTime: '',
    markets: {
      moneyline: { awayOdds: -145, homeOdds: +125 },
      spread: { awayLine: -3.5, awayOdds: -110, homeLine: 3.5, homeOdds: -110 },
      total: { line: 46.5, overOdds: -105, underOdds: -115 }
    },
    url: 'https://draftkings.com',
    timestamp: Date.now()
  },
  {
    book: 'draftkings',
    awayTeam: 'HOU Texans',
    homeTeam: 'IND Colts',
    gameTime: '',
    markets: {
      moneyline: { awayOdds: -150, homeOdds: +130 },
      spread: { awayLine: -2.5, awayOdds: -105, homeLine: 2.5, homeOdds: -115 }
    },
    url: 'https://draftkings.com',
    timestamp: Date.now()
  }
];

// Mock FanDuel data (same games, slightly different odds)
const mockFD = [
  {
    book: 'fanduel',
    awayTeam: 'Los Angeles Rams',
    homeTeam: 'Carolina Panthers',
    gameTime: '',
    markets: {
      moneyline: { awayOdds: -140, homeOdds: +120 },
      spread: { awayLine: -3.5, awayOdds: -112, homeLine: 3.5, homeOdds: -108 },
      total: { line: 46.5, overOdds: -110, underOdds: -110 }
    },
    url: 'https://fanduel.com',
    timestamp: Date.now()
  },
  {
    book: 'fanduel',
    awayTeam: 'Houston Texans',
    homeTeam: 'Indianapolis Colts',
    gameTime: '',
    markets: {
      moneyline: { awayOdds: -155, homeOdds: +135 },
      spread: { awayLine: -2.5, awayOdds: -110, homeLine: 2.5, homeOdds: -110 },
      total: { line: 47.5, overOdds: -105, underOdds: -115 }
    },
    url: 'https://fanduel.com',
    timestamp: Date.now()
  }
];

console.log('\n📊 Input Data:');
console.log(`   DraftKings: ${mockDK.length} games`);
console.log(`   FanDuel: ${mockFD.length} games`);

// Run matching
console.log('\n⏳ Running event matcher...');
const matched = matchEvents(mockDK, mockFD, [], [], [], []);

console.log(`\n✅ Matching complete`);
console.log(`   Total matched events: ${matched.length}`);

// Analyze results
console.log('\n📋 Matched Events Detail:');
matched.forEach((event, idx) => {
  console.log(`\n${idx + 1}. ${event.awayTeam} @ ${event.homeTeam}`);
  console.log(`   Event ID: ${event.eventId}`);
  console.log(`   Date: ${event.gameDate}`);
  
  const marketKeys = Object.keys(event.markets);
  console.log(`   Markets: ${marketKeys.join(', ')}`);
  
  marketKeys.forEach(marketKey => {
    const market = event.markets[marketKey];
    const books = Object.keys(market.books);
    console.log(`      ${marketKey}: ${books.join(', ')}`);
  });
});

// Validation checks
console.log('\n🔍 Validation Checks:');

const checks = {
  matchedEvents: matched.length === 2,
  bothEventsHaveMultipleBooks: matched.every(e => 
    Object.values(e.markets).some(m => Object.keys(m.books).length >= 2)
  ),
  moneylineMatched: matched.some(e => e.markets['moneyline']),
  spreadMatched: matched.some(e => e.markets['spread_-3.5'] || e.markets['spread_-2.5']),
  totalMatched: matched.some(e => e.markets['total_46.5'] || e.markets['total_47.5']),
  correctTeamNormalization: matched.every(e => 
    !e.awayTeam.includes('LA ') && !e.awayTeam.includes('HOU ')
  )
};

let passed = 0;
let failed = 0;

Object.entries(checks).forEach(([check, result]) => {
  if (result) {
    console.log(`   ✅ ${check}`);
    passed++;
  } else {
    console.log(`   ❌ ${check}`);
    failed++;
  }
});

// Check market cross-book availability
console.log('\n📊 Market Cross-Book Availability:');
matched.forEach(event => {
  const eventName = `${event.awayTeam} @ ${event.homeTeam}`;
  Object.entries(event.markets).forEach(([marketKey, market]) => {
    const books = Object.keys(market.books);
    const hasBothBooks = books.includes('draftkings') && books.includes('fanduel');
    console.log(`   ${hasBothBooks ? '✅' : '⚠️'} ${eventName} - ${marketKey}: ${books.join(', ')}`);
  });
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n✅ ALL TESTS PASSED!');
  console.log('Multi-market matching is working correctly.');
  console.log('='.repeat(60) + '\n');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED');
  console.log('Review output above for details.');
  console.log('='.repeat(60) + '\n');
  process.exit(1);
}