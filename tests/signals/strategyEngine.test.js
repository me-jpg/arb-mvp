// tests/signals/strategyEngine.test.js
// Tests for the strategy engine

const { applyStrategy, defaultStrategyConfig } = require('../../src/signals/strategyEngine');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function assertApproxEqual(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`FAIL: ${message} (expected ~${expected}, got ${actual})`);
  }
}

console.log('\n=== strategyEngine.test.js ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Basic filtering by minEdge/maxEdge
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { id: '1', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'dk', edgeEstimate: 0.01 }, // Below minEdge
    { id: '2', type: 'pure_arb', eventId: 'EVT2', primaryBook: 'dk', edgeEstimate: 0.03 }, // Valid
    { id: '3', type: 'pure_arb', eventId: 'EVT3', primaryBook: 'dk', edgeEstimate: 0.05 }, // Valid
    { id: '4', type: 'pure_arb', eventId: 'EVT4', primaryBook: 'dk', edgeEstimate: 0.15 }, // Above maxEdge
  ];

  const result = applyStrategy(signals, { minEdge: 0.02, maxEdge: 0.10 });

  assert(result.selectedSignals.length === 2, `Expected 2 selected signals, got ${result.selectedSignals.length}`);
  assert(result.rejectedSignalsCount === 2, `Expected 2 rejected, got ${result.rejectedSignalsCount}`);
  
  const selectedIds = result.selectedSignals.map(s => s.id);
  assert(selectedIds.includes('2'), 'Signal 2 should be selected');
  assert(selectedIds.includes('3'), 'Signal 3 should be selected');

  console.log('✓ Test 1: Basic filtering by minEdge/maxEdge');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: maxSignalsPerEvent enforced
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { id: '1', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'dk', edgeEstimate: 0.03 },
    { id: '2', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'mgm', edgeEstimate: 0.05 }, // Higher edge
    { id: '3', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'espn', edgeEstimate: 0.04 },
  ];

  const result = applyStrategy(signals, { 
    minEdge: 0.02, 
    maxSignalsPerEvent: 2 
  });

  assert(result.selectedSignals.length === 2, `Expected 2 selected (max per event), got ${result.selectedSignals.length}`);
  
  // Should keep highest edges: 0.05 and 0.04
  const selectedIds = result.selectedSignals.map(s => s.id);
  assert(selectedIds.includes('2'), 'Signal 2 (0.05 edge) should be selected');
  assert(selectedIds.includes('3'), 'Signal 3 (0.04 edge) should be selected');
  assert(!selectedIds.includes('1'), 'Signal 1 (0.03 edge) should be rejected');

  console.log('✓ Test 2: maxSignalsPerEvent enforced');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: maxTotalStakePerBook enforced
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { id: '1', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'dk', edgeEstimate: 0.03 },
    { id: '2', type: 'pure_arb', eventId: 'EVT2', primaryBook: 'dk', edgeEstimate: 0.03 },
    { id: '3', type: 'pure_arb', eventId: 'EVT3', primaryBook: 'dk', edgeEstimate: 0.03 },
    { id: '4', type: 'pure_arb', eventId: 'EVT4', primaryBook: 'dk', edgeEstimate: 0.03 },
  ];

  const result = applyStrategy(signals, { 
    minEdge: 0.02, 
    flatStake: 50,
    maxTotalStakePerBook: 100 // Only allows 2 signals at $50 each
  });

  assert(result.selectedSignals.length === 2, `Expected 2 selected (book cap), got ${result.selectedSignals.length}`);
  assert(result.totalStake === 100, `Expected totalStake 100, got ${result.totalStake}`);
  assert(result.exposureByBook['dk'].totalStake === 100, 'dk exposure should be 100');

  console.log('✓ Test 3: maxTotalStakePerBook enforced');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: stakeMode flat vs edge_scaled
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { id: '1', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'dk', edgeEstimate: 0.02 },
    { id: '2', type: 'pure_arb', eventId: 'EVT2', primaryBook: 'mgm', edgeEstimate: 0.04 }, // 2x minEdge
  ];

  // Flat mode
  const flatResult = applyStrategy(signals, { 
    minEdge: 0.02, 
    flatStake: 50,
    stakeMode: 'flat'
  });
  
  assert(flatResult.selectedSignals[0].strategyStake === 50, 'Flat mode: all stakes should be 50');
  assert(flatResult.selectedSignals[1].strategyStake === 50, 'Flat mode: all stakes should be 50');
  assert(flatResult.totalStake === 100, 'Flat mode: total should be 100');

  // Edge scaled mode
  const scaledResult = applyStrategy(signals, { 
    minEdge: 0.02, 
    flatStake: 50,
    stakeMode: 'edge_scaled',
    maxStakePerSignal: 200
  });
  
  // Signal 1: edge 0.02 = minEdge, so stake = 50
  // Signal 2: edge 0.04 = 2x minEdge, so stake = 100
  const sig1 = scaledResult.selectedSignals.find(s => s.id === '1');
  const sig2 = scaledResult.selectedSignals.find(s => s.id === '2');
  
  assert(sig1.strategyStake === 50, `Scaled mode: 0.02 edge should get $50, got ${sig1.strategyStake}`);
  assert(sig2.strategyStake === 100, `Scaled mode: 0.04 edge should get $100, got ${sig2.strategyStake}`);
  assert(scaledResult.totalStake === 150, `Scaled mode: total should be 150, got ${scaledResult.totalStake}`);

  console.log('✓ Test 4: stakeMode flat vs edge_scaled');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: excludedBooks filters correctly
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { id: '1', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'dk', edgeEstimate: 0.03 },
    { id: '2', type: 'pure_arb', eventId: 'EVT2', primaryBook: 'espnbet', edgeEstimate: 0.03 },
    { id: '3', type: 'pure_arb', eventId: 'EVT3', primaryBook: 'mgm', edgeEstimate: 0.03 },
  ];

  const result = applyStrategy(signals, { 
    minEdge: 0.02, 
    excludedBooks: ['espnbet']
  });

  assert(result.selectedSignals.length === 2, `Expected 2 selected, got ${result.selectedSignals.length}`);
  assert(!result.selectedSignals.find(s => s.primaryBook === 'espnbet'), 'espnbet should be excluded');

  console.log('✓ Test 5: excludedBooks filters correctly');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Empty/null inputs handled
// ─────────────────────────────────────────────────────────────────────────────
{
  const result1 = applyStrategy([], {});
  assert(result1.selectedSignals.length === 0, 'Empty array → 0 selected');
  assert(result1.totalStake === 0, 'Empty array → 0 stake');
  assert(result1.expectedValue === 0, 'Empty array → 0 EV');

  const result2 = applyStrategy(null, {});
  assert(result2.selectedSignals.length === 0, 'null → 0 selected');

  const result3 = applyStrategy(undefined, {});
  assert(result3.selectedSignals.length === 0, 'undefined → 0 selected');

  console.log('✓ Test 6: Empty/null inputs handled');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: Invalid edge values filtered
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { id: '1', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'dk', edgeEstimate: NaN },
    { id: '2', type: 'pure_arb', eventId: 'EVT2', primaryBook: 'dk', edgeEstimate: Infinity },
    { id: '3', type: 'pure_arb', eventId: 'EVT3', primaryBook: 'dk', edgeEstimate: undefined },
    { id: '4', type: 'pure_arb', eventId: 'EVT4', primaryBook: 'dk', edgeEstimate: 'bad' },
    { id: '5', type: 'pure_arb', eventId: 'EVT5', primaryBook: 'dk', edgeEstimate: 0.03 }, // Valid
  ];

  const result = applyStrategy(signals, { minEdge: 0.02 });

  assert(result.selectedSignals.length === 1, `Expected 1 valid signal, got ${result.selectedSignals.length}`);
  assert(result.selectedSignals[0].id === '5', 'Only signal 5 should pass');

  console.log('✓ Test 7: Invalid edge values filtered');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: EV calculation correct
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { id: '1', type: 'pure_arb', eventId: 'EVT1', primaryBook: 'dk', edgeEstimate: 0.02 },
    { id: '2', type: 'pure_arb', eventId: 'EVT2', primaryBook: 'mgm', edgeEstimate: 0.04 },
  ];

  const result = applyStrategy(signals, { 
    minEdge: 0.02, 
    flatStake: 100,
    stakeMode: 'flat'
  });

  // avgEdge = (0.02 + 0.04) / 2 = 0.03
  assertApproxEqual(result.avgEdgeEstimate, 0.03, 0.0001, 'avgEdgeEstimate');
  
  // totalStake = 200
  assert(result.totalStake === 200, `totalStake should be 200, got ${result.totalStake}`);
  
  // EV = 200 * 0.03 = 6
  assertApproxEqual(result.expectedValue, 6, 0.01, 'expectedValue');

  console.log('✓ Test 8: EV calculation correct');
}

console.log('\n=== All strategyEngine tests passed! ===\n');




