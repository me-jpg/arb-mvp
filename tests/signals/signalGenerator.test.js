// tests/signals/signalGenerator.test.js
// Tests for signal generation from stale lines and latency metrics

const { generateSignalsFromLatency } = require('../../src/signals/signalGenerator');
const { resetWarningCounts } = require('../../src/utils/shapeValidator');

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

console.log('\n=== signalGenerator.test.js ===\n');

// Reset validator warning counts before tests
resetWarningCounts();

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Basic stale → signal generation
// ─────────────────────────────────────────────────────────────────────────────
{
  const staleLines = [
    {
      eventId: 'EVT1_DAL_vs_DET',
      marketType: 'moneyline',
      side: 'home',
      staleBook: 'betmgm',
      referenceBook: 'draftkings',
      staleDurationMs: 8000,
      staleStartedAt: '2025-12-04T18:40:00.000Z',
      staleDetectedAt: '2025-12-04T18:40:08.000Z'
    }
  ];

  const signals = generateSignalsFromLatency([], staleLines, {
    minStaleDurationMs: 3000,
    minSpeedScore: -999, // Disable speed filtering for this test
    staleThresholdMs: 60000
  });

  assert(signals.length === 1, `Expected 1 signal, got ${signals.length}`);
  assert(signals[0].type === 'stale_vs_book', `Expected type stale_vs_book, got ${signals[0].type}`);
  assert(signals[0].primaryBook === 'draftkings', `Expected primaryBook draftkings, got ${signals[0].primaryBook}`);
  assert(signals[0].referenceBook === 'betmgm', `Expected referenceBook betmgm, got ${signals[0].referenceBook}`);
  assert(signals[0].eventId === 'EVT1_DAL_vs_DET', `Expected eventId EVT1_DAL_vs_DET`);
  assert(signals[0].marketType === 'moneyline', `Expected marketType moneyline`);
  
  // edgeEstimate = 8000 / 60000 = 0.1333, capped at 0.10
  assertApproxEqual(signals[0].edgeEstimate, 0.10, 0.001, 'Edge should be capped at 10%');
  
  console.log('✓ Test 1: Basic stale → signal generation');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Below-threshold stale durations are ignored
// ─────────────────────────────────────────────────────────────────────────────
{
  const staleLines = [
    {
      eventId: 'EVT1',
      marketType: 'moneyline',
      side: 'home',
      staleBook: 'betmgm',
      referenceBook: 'draftkings',
      staleDurationMs: 2000 // Below threshold
    }
  ];

  const signals = generateSignalsFromLatency([], staleLines, {
    minStaleDurationMs: 3000
  });

  assert(signals.length === 0, `Expected 0 signals for below-threshold stale, got ${signals.length}`);
  console.log('✓ Test 2: Below-threshold stale durations are ignored');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Signals filtered by speed score
// ─────────────────────────────────────────────────────────────────────────────
{
  const latencyMetrics = [
    { book: 'draftkings', fractionFirstToMove: 0.6, fractionLastToMove: 0.1 }, // speedScore = 0.5
    { book: 'betmgm', fractionFirstToMove: 0.05, fractionLastToMove: 0.6 },    // speedScore = -0.55 (slow)
    { book: 'espnbet', fractionFirstToMove: 0.2, fractionLastToMove: 0.3 }     // speedScore = -0.1
  ];

  const staleLines = [
    {
      eventId: 'EVT1',
      marketType: 'moneyline',
      side: 'home',
      staleBook: 'betmgm',
      referenceBook: 'draftkings', // Fast book, should pass
      staleDurationMs: 5000
    },
    {
      eventId: 'EVT2',
      marketType: 'spread',
      side: 'away',
      staleBook: 'draftkings',
      referenceBook: 'espnbet', // Slow book (speedScore = -0.1 < 0.1), should be filtered
      staleDurationMs: 5000
    }
  ];

  const signals = generateSignalsFromLatency(latencyMetrics, staleLines, {
    minStaleDurationMs: 3000,
    minSpeedScore: 0.1 // Require speed score >= 0.1
  });

  assert(signals.length === 1, `Expected 1 signal (ESPN filtered out), got ${signals.length}`);
  assert(signals[0].primaryBook === 'draftkings', `Expected draftkings to be primary book`);
  
  console.log('✓ Test 3: Signals filtered by speed score');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: EdgeEstimate is capped and finite
// ─────────────────────────────────────────────────────────────────────────────
{
  const staleLines = [
    {
      eventId: 'EVT1',
      marketType: 'moneyline',
      side: 'home',
      staleBook: 'betmgm',
      referenceBook: 'draftkings',
      staleDurationMs: 120000 // Way above threshold, should cap at 10%
    }
  ];

  const signals = generateSignalsFromLatency([], staleLines, {
    minStaleDurationMs: 1000,
    minSpeedScore: -999,
    staleThresholdMs: 60000
  });

  assert(signals.length === 1, `Expected 1 signal`);
  assert(signals[0].edgeEstimate === 0.10, `Edge should be capped at 0.10, got ${signals[0].edgeEstimate}`);
  assert(Number.isFinite(signals[0].edgeEstimate), `edgeEstimate should be finite`);
  assert(!Number.isNaN(signals[0].edgeEstimate), `edgeEstimate should not be NaN`);
  
  console.log('✓ Test 4: EdgeEstimate is capped and finite');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Empty inputs → empty output, no crash
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals1 = generateSignalsFromLatency([], [], {});
  assert(Array.isArray(signals1), 'Should return array');
  assert(signals1.length === 0, 'Should return empty array for empty inputs');

  const signals2 = generateSignalsFromLatency(null, null, {});
  assert(Array.isArray(signals2), 'Should handle null inputs');
  assert(signals2.length === 0, 'Should return empty array for null inputs');

  const signals3 = generateSignalsFromLatency(undefined, undefined);
  assert(Array.isArray(signals3), 'Should handle undefined inputs');
  assert(signals3.length === 0, 'Should return empty array for undefined inputs');
  
  console.log('✓ Test 5: Empty inputs → empty output, no crash');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Missing required fields are skipped
// ─────────────────────────────────────────────────────────────────────────────
{
  const staleLines = [
    { eventId: 'EVT1', marketType: 'ml', side: 'home', staleDurationMs: 5000 }, // Missing staleBook, referenceBook
    { staleBook: 'betmgm', referenceBook: 'dk', staleDurationMs: 5000 },        // Missing eventId, marketType
    { eventId: 'EVT3', marketType: 'ml', side: 'home', staleBook: 'mgm', referenceBook: 'dk', staleDurationMs: 5000 } // Valid
  ];

  const signals = generateSignalsFromLatency([], staleLines, {
    minStaleDurationMs: 1000,
    minSpeedScore: -999
  });

  // Only the last one should produce a signal (though it may fail validation for short book name)
  // The first two should be skipped due to missing primaryBook/staleBook
  assert(signals.length <= 1, `Expected at most 1 signal from partially valid data`);
  
  console.log('✓ Test 6: Missing required fields are skipped');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: Zero or negative staleDurationMs handled
// ─────────────────────────────────────────────────────────────────────────────
{
  const staleLines = [
    { eventId: 'EVT1', marketType: 'ml', side: 'home', staleBook: 'mgm', referenceBook: 'dk', staleDurationMs: 0 },
    { eventId: 'EVT2', marketType: 'ml', side: 'home', staleBook: 'mgm', referenceBook: 'dk', staleDurationMs: -1000 },
    { eventId: 'EVT3', marketType: 'ml', side: 'home', staleBook: 'mgm', referenceBook: 'dk' } // undefined
  ];

  const signals = generateSignalsFromLatency([], staleLines, {
    minStaleDurationMs: 1000
  });

  assert(signals.length === 0, `Expected 0 signals for zero/negative/missing staleDurationMs`);
  
  console.log('✓ Test 7: Zero or negative staleDurationMs handled');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: NaN staleDurationMs does not produce NaN edge
// ─────────────────────────────────────────────────────────────────────────────
{
  const staleLines = [
    { eventId: 'EVT1', marketType: 'ml', side: 'home', staleBook: 'mgm', referenceBook: 'dk', staleDurationMs: NaN }
  ];

  const signals = generateSignalsFromLatency([], staleLines, {
    minStaleDurationMs: 0, // Allow through the filter
    minSpeedScore: -999
  });

  // Should be filtered out or have safe edge
  for (const sig of signals) {
    assert(!Number.isNaN(sig.edgeEstimate), `edgeEstimate should not be NaN`);
  }
  
  console.log('✓ Test 8: NaN staleDurationMs does not produce NaN edge');
}

console.log('\n=== All signalGenerator tests passed! ===\n');

