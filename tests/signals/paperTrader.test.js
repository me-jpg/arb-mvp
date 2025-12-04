// tests/signals/paperTrader.test.js
// Tests for paper trading simulation

const { simulateSignals, formatSimulationResults } = require('../../src/signals/paperTrader');

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

console.log('\n=== paperTrader.test.js ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Simple EV calculation with uniform edges
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { type: 'stale_vs_book', edgeEstimate: 0.05 },
    { type: 'stale_vs_book', edgeEstimate: 0.05 }
  ];

  const results = simulateSignals(signals, { stakePerSignal: 100 });

  assert(results.signalCount === 2, `Expected signalCount 2, got ${results.signalCount}`);
  assert(results.totalStake === 200, `Expected totalStake 200, got ${results.totalStake}`);
  assertApproxEqual(results.avgEdgeEstimate, 0.05, 0.0001, 'avgEdgeEstimate');
  assertApproxEqual(results.expectedValue, 10, 0.01, 'expectedValue = 200 * 0.05 = 10');
  
  console.log('✓ Test 1: Simple EV calculation with uniform edges');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Mixed edges
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { type: 'stale_vs_book', edgeEstimate: 0.02 },
    { type: 'stale_vs_book', edgeEstimate: 0.08 },
    { type: 'pure_arb', edgeEstimate: 0.05 }
  ];

  const results = simulateSignals(signals, { stakePerSignal: 50 });

  assert(results.signalCount === 3, `Expected signalCount 3`);
  assert(results.totalStake === 150, `Expected totalStake 150`);
  
  // avgEdge = (0.02 + 0.08 + 0.05) / 3 = 0.15 / 3 = 0.05
  assertApproxEqual(results.avgEdgeEstimate, 0.05, 0.0001, 'avgEdgeEstimate');
  
  // EV = 150 * 0.05 = 7.50
  assertApproxEqual(results.expectedValue, 7.50, 0.01, 'expectedValue');
  
  // Check byType breakdown
  assert(results.byType['stale_vs_book'].count === 2, 'stale_vs_book count');
  assert(results.byType['pure_arb'].count === 1, 'pure_arb count');
  
  console.log('✓ Test 2: Mixed edges');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Empty signals array
// ─────────────────────────────────────────────────────────────────────────────
{
  const results1 = simulateSignals([], { stakePerSignal: 100 });
  
  assert(results1.signalCount === 0, 'signalCount should be 0');
  assert(results1.totalStake === 0, 'totalStake should be 0');
  assert(results1.avgEdgeEstimate === 0, 'avgEdgeEstimate should be 0 for empty');
  assert(results1.expectedValue === 0, 'expectedValue should be 0');
  assert(!Number.isNaN(results1.avgEdgeEstimate), 'avgEdgeEstimate should not be NaN');

  const results2 = simulateSignals(null);
  assert(results2.signalCount === 0, 'null input should return 0 count');
  assert(!Number.isNaN(results2.avgEdgeEstimate), 'null input should not produce NaN');

  const results3 = simulateSignals(undefined);
  assert(results3.signalCount === 0, 'undefined input should return 0 count');
  
  console.log('✓ Test 3: Empty signals array');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Missing or non-numeric edgeEstimate
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { type: 'stale_vs_book', edgeEstimate: 0.10 },
    { type: 'stale_vs_book', edgeEstimate: undefined },  // Missing
    { type: 'stale_vs_book', edgeEstimate: null },       // Null
    { type: 'stale_vs_book', edgeEstimate: 'bad' },      // String
    { type: 'stale_vs_book', edgeEstimate: NaN },        // NaN
    { type: 'stale_vs_book', edgeEstimate: 0.10 }
  ];

  const results = simulateSignals(signals, { stakePerSignal: 50 });

  assert(results.signalCount === 6, `signalCount should be 6`);
  assert(!Number.isNaN(results.avgEdgeEstimate), 'avgEdgeEstimate should not be NaN');
  assert(!Number.isNaN(results.expectedValue), 'expectedValue should not be NaN');
  assert(Number.isFinite(results.expectedValue), 'expectedValue should be finite');
  
  // Only signals[0] and signals[5] have valid edges (0.10 each)
  // Bad edges should be treated as 0
  // totalEdge = 0.10 + 0 + 0 + 0 + 0 + 0.10 = 0.20
  // avgEdge = 0.20 / 6 = 0.0333...
  assertApproxEqual(results.avgEdgeEstimate, 0.0333, 0.01, 'avgEdgeEstimate with bad values');
  
  console.log('✓ Test 4: Missing or non-numeric edgeEstimate');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Infinity edge is sanitized
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { type: 'stale_vs_book', edgeEstimate: Infinity },
    { type: 'stale_vs_book', edgeEstimate: -Infinity },
    { type: 'stale_vs_book', edgeEstimate: 0.05 }
  ];

  const results = simulateSignals(signals, { stakePerSignal: 100 });

  assert(!Number.isNaN(results.avgEdgeEstimate), 'avgEdgeEstimate should not be NaN');
  assert(Number.isFinite(results.avgEdgeEstimate), 'avgEdgeEstimate should be finite');
  assert(Number.isFinite(results.expectedValue), 'expectedValue should be finite');
  
  console.log('✓ Test 5: Infinity edge is sanitized');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Negative edge is allowed (could represent expected loss)
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { type: 'stale_vs_book', edgeEstimate: -0.02 },
    { type: 'stale_vs_book', edgeEstimate: 0.08 }
  ];

  const results = simulateSignals(signals, { stakePerSignal: 100 });

  // avgEdge = (-0.02 + 0.08) / 2 = 0.03
  assertApproxEqual(results.avgEdgeEstimate, 0.03, 0.0001, 'avgEdgeEstimate with negative');
  assertApproxEqual(results.expectedValue, 6, 0.01, 'expectedValue = 200 * 0.03 = 6');
  
  console.log('✓ Test 6: Negative edge is allowed');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: formatSimulationResults doesn't crash
// ─────────────────────────────────────────────────────────────────────────────
{
  const results = simulateSignals([
    { type: 'stale_vs_book', edgeEstimate: 0.05 }
  ], { stakePerSignal: 100 });

  const formatted = formatSimulationResults(results);
  
  assert(typeof formatted === 'string', 'formatSimulationResults should return string');
  assert(formatted.includes('Signals generated: 1'), 'Should include signal count');
  assert(formatted.includes('$100'), 'Should include stake');
  
  console.log('✓ Test 7: formatSimulationResults works');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: Zero stake per signal
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals = [
    { type: 'stale_vs_book', edgeEstimate: 0.10 }
  ];

  const results = simulateSignals(signals, { stakePerSignal: 0 });

  assert(results.signalCount === 1, 'signalCount should be 1');
  assert(results.totalStake === 0, 'totalStake should be 0');
  assert(results.expectedValue === 0, 'expectedValue should be 0 with 0 stake');
  assert(!Number.isNaN(results.avgEdgeEstimate), 'avgEdgeEstimate should not be NaN');
  
  console.log('✓ Test 8: Zero stake per signal');
}

console.log('\n=== All paperTrader tests passed! ===\n');

