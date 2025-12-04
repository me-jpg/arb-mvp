// tests/signals/arbSignalAdapter.test.js
// Tests for converting arbitrage results to Signal objects

const { convertArbResultsToSignals } = require('../../src/signals/arbSignalAdapter');
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

console.log('\n=== arbSignalAdapter.test.js ===\n');

// Reset validator warning counts before tests
resetWarningCounts();

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Simple arb result → one Signal
// ─────────────────────────────────────────────────────────────────────────────
{
  const arbResult = {
    opportunities: [
      {
        type: 'arb',
        edge: 0.024, // 2.4%
        edgePercent: 2.4,
        totalImplied: 0.976,
        gameKey: 'game_123',
        marketKey: 'moneyline::null',
        eventId: '2025-12-04_Dallas_Cowboys_vs_Detroit_Lions',
        sport: 'nfl',
        marketType: 'moneyline',
        line: null,
        totalStake: 1000,
        profitAmount: 24,
        guaranteedReturn: 1024,
        selections: [
          { outcome: 'home', book: 'draftkings', price: -110, impliedProbability: 0.524, stake: 520.25 },
          { outcome: 'away', book: 'betmgm', price: 120, impliedProbability: 0.455, stake: 479.75 }
        ],
        timestamp: '2025-12-04T21:33:20.000Z',
        cycleId: 'hf-1733340000000'
      }
    ],
    stats: {}
  };

  const signals = convertArbResultsToSignals(arbResult, {
    defaultConfidence: 0.9,
    maxEdgeCap: 0.10
  });

  assert(signals.length === 1, `Expected 1 signal, got ${signals.length}`);
  
  const sig = signals[0];
  assert(sig.type === 'pure_arb', `Expected type pure_arb, got ${sig.type}`);
  assert(sig.eventId === '2025-12-04_Dallas_Cowboys_vs_Detroit_Lions', `Wrong eventId`);
  assert(sig.marketType === 'moneyline', `Wrong marketType`);
  assert(sig.side === 'home', `Expected side home, got ${sig.side}`);
  assert(sig.primaryBook === 'draftkings', `Wrong primaryBook`);
  assert(sig.referenceBook === 'betmgm', `Wrong referenceBook`);
  assert(sig.price === -110, `Wrong price`);
  assertApproxEqual(sig.edgeEstimate, 0.024, 0.001, 'edgeEstimate');
  assert(sig.confidence >= 0.9, `Confidence should be >= 0.9`);
  
  // Check metadata
  assert(sig.metadata.totalStake === 1000, 'metadata.totalStake');
  assertApproxEqual(sig.metadata.guaranteedProfit, 24, 0.1, 'metadata.guaranteedProfit');
  assert(sig.metadata.comboBooks.includes('draftkings'), 'metadata.comboBooks should include draftkings');
  assert(sig.metadata.comboBooks.includes('betmgm'), 'metadata.comboBooks should include betmgm');
  
  console.log('✓ Test 1: Simple arb result → one Signal');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: No opportunities → empty array
// ─────────────────────────────────────────────────────────────────────────────
{
  const signals1 = convertArbResultsToSignals({ opportunities: [], stats: {} });
  assert(signals1.length === 0, 'Empty opportunities → empty signals');

  const signals2 = convertArbResultsToSignals(null);
  assert(signals2.length === 0, 'null arbResult → empty signals');

  const signals3 = convertArbResultsToSignals(undefined);
  assert(signals3.length === 0, 'undefined arbResult → empty signals');

  const signals4 = convertArbResultsToSignals({});
  assert(signals4.length === 0, 'Empty object → empty signals');

  console.log('✓ Test 2: No opportunities → empty array');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Edge is capped at maxEdgeCap
// ─────────────────────────────────────────────────────────────────────────────
{
  const arbResult = {
    opportunities: [
      {
        edge: 0.25, // 25% - way above cap
        eventId: 'EVT1',
        marketType: 'spread',
        selections: [
          { outcome: 'home', book: 'dk', price: -110, stake: 500 },
          { outcome: 'away', book: 'mgm', price: 110, stake: 500 }
        ]
      }
    ]
  };

  const signals = convertArbResultsToSignals(arbResult, { maxEdgeCap: 0.10 });

  assert(signals.length === 1, 'Should produce 1 signal');
  assert(signals[0].edgeEstimate === 0.10, `Edge should be capped at 0.10, got ${signals[0].edgeEstimate}`);

  console.log('✓ Test 3: Edge is capped at maxEdgeCap');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: NaN/Infinity/negative edge → sanitized to 0
// ─────────────────────────────────────────────────────────────────────────────
{
  const arbResult = {
    opportunities: [
      {
        edge: NaN,
        eventId: 'EVT1',
        marketType: 'moneyline',
        selections: [
          { outcome: 'home', book: 'dk', price: -110, stake: 500 },
          { outcome: 'away', book: 'mgm', price: 110, stake: 500 }
        ]
      },
      {
        edge: Infinity,
        eventId: 'EVT2',
        marketType: 'moneyline',
        selections: [
          { outcome: 'home', book: 'dk', price: -110, stake: 500 },
          { outcome: 'away', book: 'mgm', price: 110, stake: 500 }
        ]
      },
      {
        edge: -0.05,
        eventId: 'EVT3',
        marketType: 'moneyline',
        selections: [
          { outcome: 'home', book: 'dk', price: -110, stake: 500 },
          { outcome: 'away', book: 'mgm', price: 110, stake: 500 }
        ]
      }
    ]
  };

  const signals = convertArbResultsToSignals(arbResult);

  for (const sig of signals) {
    assert(Number.isFinite(sig.edgeEstimate), `edgeEstimate should be finite`);
    assert(!Number.isNaN(sig.edgeEstimate), `edgeEstimate should not be NaN`);
    assert(sig.edgeEstimate >= 0, `edgeEstimate should be >= 0`);
  }

  console.log('✓ Test 4: NaN/Infinity/negative edge → sanitized');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Missing selections → skipped
// ─────────────────────────────────────────────────────────────────────────────
{
  const arbResult = {
    opportunities: [
      {
        edge: 0.02,
        eventId: 'EVT1',
        marketType: 'moneyline',
        selections: [] // Empty selections - not a valid 2-way arb
      },
      {
        edge: 0.02,
        eventId: 'EVT2',
        marketType: 'moneyline',
        selections: [{ outcome: 'home', book: 'dk', price: -110 }] // Only 1 selection
      },
      {
        edge: 0.02,
        eventId: 'EVT3',
        marketType: 'moneyline'
        // No selections at all
      }
    ]
  };

  const signals = convertArbResultsToSignals(arbResult);
  assert(signals.length === 0, `Expected 0 signals from invalid arbs, got ${signals.length}`);

  console.log('✓ Test 5: Missing selections → skipped');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Multiple arb opportunities → multiple Signals
// ─────────────────────────────────────────────────────────────────────────────
{
  const arbResult = {
    opportunities: [
      {
        edge: 0.02,
        eventId: 'EVT1',
        marketType: 'moneyline',
        selections: [
          { outcome: 'home', book: 'dk', price: -110, stake: 500 },
          { outcome: 'away', book: 'mgm', price: 110, stake: 500 }
        ]
      },
      {
        edge: 0.03,
        eventId: 'EVT2',
        marketType: 'spread',
        selections: [
          { outcome: 'home', book: 'espn', price: -105, stake: 520 },
          { outcome: 'away', book: 'dk', price: 105, stake: 480 }
        ]
      }
    ]
  };

  const signals = convertArbResultsToSignals(arbResult);
  assert(signals.length === 2, `Expected 2 signals, got ${signals.length}`);
  
  // Check they have different eventIds
  const eventIds = signals.map(s => s.eventId);
  assert(eventIds.includes('EVT1'), 'Should include EVT1');
  assert(eventIds.includes('EVT2'), 'Should include EVT2');

  console.log('✓ Test 6: Multiple arb opportunities → multiple Signals');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: Confidence increases with edge
// ─────────────────────────────────────────────────────────────────────────────
{
  const arbResult = {
    opportunities: [
      {
        edge: 0.01, // 1% - small
        eventId: 'EVT1',
        marketType: 'moneyline',
        selections: [
          { outcome: 'home', book: 'dk', price: -110, stake: 500 },
          { outcome: 'away', book: 'mgm', price: 110, stake: 500 }
        ]
      },
      {
        edge: 0.06, // 6% - larger
        eventId: 'EVT2',
        marketType: 'moneyline',
        selections: [
          { outcome: 'home', book: 'dk', price: -110, stake: 500 },
          { outcome: 'away', book: 'mgm', price: 110, stake: 500 }
        ]
      }
    ]
  };

  const signals = convertArbResultsToSignals(arbResult, { defaultConfidence: 0.9 });
  
  const smallEdgeSig = signals.find(s => s.eventId === 'EVT1');
  const largeEdgeSig = signals.find(s => s.eventId === 'EVT2');
  
  assert(largeEdgeSig.confidence > smallEdgeSig.confidence, 
    `Larger edge should have higher confidence (${largeEdgeSig.confidence} > ${smallEdgeSig.confidence})`);

  console.log('✓ Test 7: Confidence increases with edge');
}

console.log('\n=== All arbSignalAdapter tests passed! ===\n');

