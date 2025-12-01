// tests/test-market-normalization.js
// Test market normalization functions

const {
  normalizeMarketType,
  normalizeSpreadValue,
  normalizeTotalValue,
  createMarketKey,
  validateMarketData,
  linesMatch
} = require('../src/core/marketNormalizer');

console.log('\n' + '='.repeat(60));
console.log('🧪 TESTING: Market Normalization');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(description, actual, expected) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    console.log(`✅ ${description}`);
    console.log(`   Result: ${JSON.stringify(actual)}`);
    passed++;
  } else {
    console.log(`❌ ${description}`);
    console.log(`   Expected: ${JSON.stringify(expected)}`);
    console.log(`   Got:      ${JSON.stringify(actual)}`);
    failed++;
  }
}

// Test Market Type Normalization
console.log('\n📋 Market Type Normalization:');
test('moneyline', normalizeMarketType('moneyline'), 'moneyline');
test('ML', normalizeMarketType('ML'), 'moneyline');
test('money line', normalizeMarketType('money line'), 'moneyline');
test('spread', normalizeMarketType('spread'), 'spread');
test('point spread', normalizeMarketType('point spread'), 'spread');
test('total', normalizeMarketType('total'), 'total');
test('o/u', normalizeMarketType('o/u'), 'total');
test('over/under', normalizeMarketType('over/under'), 'total');

// Test Spread Value Normalization
console.log('\n📋 Spread Value Normalization:');
test('-3.5 string', normalizeSpreadValue('-3.5'), -3.5);
test('−3.5 unicode', normalizeSpreadValue('−3.5'), -3.5);
test('PK', normalizeSpreadValue('PK'), 0);
test('pick', normalizeSpreadValue('pick'), 0);
test('+7', normalizeSpreadValue('+7'), 7);
test('-7', normalizeSpreadValue('-7'), -7);
test('3.5 positive', normalizeSpreadValue('3.5'), 3.5);
test('-2 number', normalizeSpreadValue(-2), -2);

// Test Total Value Normalization
console.log('\n📋 Total Value Normalization:');
test('46.5', normalizeTotalValue('46.5'), 46.5);
test('o 46.5', normalizeTotalValue('o 46.5'), 46.5);
test('Over 46.5', normalizeTotalValue('Over 46.5'), 46.5);
test('u 46.5', normalizeTotalValue('u 46.5'), 46.5);
test('Under 46.5', normalizeTotalValue('Under 46.5'), 46.5);
test('47 number', normalizeTotalValue(47), 47);

// Test Market Key Generation
console.log('\n📋 Market Key Generation:');
test('moneyline key', createMarketKey('moneyline', null), 'moneyline');
test('spread -3.5 key', createMarketKey('spread', -3.5), 'spread_-3.5');
test('spread +7 key', createMarketKey('spread', 7), 'spread_7');
test('total 46.5 key', createMarketKey('total', 46.5), 'total_46.5');

// Test Market Data Validation
console.log('\n📋 Market Data Validation:');
test('valid moneyline', 
  validateMarketData({ awayOdds: -110, homeOdds: +120 }, 'moneyline'), 
  true
);
test('invalid moneyline (missing odds)', 
  validateMarketData({ awayOdds: -110 }, 'moneyline'), 
  false
);
test('valid spread', 
  validateMarketData({ 
    awayLine: -3.5, 
    homeLine: 3.5, 
    awayOdds: -110, 
    homeOdds: -110 
  }, 'spread'), 
  true
);
test('invalid spread (missing line)', 
  validateMarketData({ 
    awayLine: -3.5, 
    awayOdds: -110, 
    homeOdds: -110 
  }, 'spread'), 
  false
);
test('valid total', 
  validateMarketData({ 
    line: 46.5, 
    overOdds: -105, 
    underOdds: -115 
  }, 'total'), 
  true
);

// Test Lines Matching
console.log('\n📋 Lines Matching:');
test('exact match', linesMatch(46.5, 46.5), true);
test('within tolerance', linesMatch(46.5, 46.0, 0.5), true);
test('outside tolerance', linesMatch(46.5, 45.0, 0.5), false);
test('negative spreads match', linesMatch(-3.5, -3.5), true);
test('opposite spreads dont match', linesMatch(-3.5, 3.5), false);

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n✅ ALL TESTS PASSED!');
  console.log('='.repeat(60) + '\n');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED');
  console.log('='.repeat(60) + '\n');
  process.exit(1);
}