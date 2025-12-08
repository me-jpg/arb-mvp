/**
 * tests/hf/marketStateEngine.test.js
 */

const assert = require('assert');
const { buildMarketState } = require('../../src/hf/marketStateEngine');

console.log('=== marketStateEngine.test.js ===\n');

// Helper for approximate float comparison
function approxEqual(a, b, epsilon = 0.01) {
    return Math.abs(a - b) < epsilon;
}

// Mock Features
const mockFeatures = [
    // M1: e1_moneyline_k1
    // Move 1: Book A, delta 5, timeSincePrev 100
    { eventId: 'e1', marketType: 'moneyline', marketKey: 'k1', book: 'A', delta: 5, absDelta: 5, timeSincePrevMs: 100, timestamp: 1000 },
    // Move 2: Book B, delta 5, timeSincePrev 10 (Reacted fast)
    { eventId: 'e1', marketType: 'moneyline', marketKey: 'k1', book: 'B', delta: 5, absDelta: 5, timeSincePrevMs: 10, timestamp: 1010 },
    // Move 3: Book A, delta 2, timeSincePrev 200
    { eventId: 'e1', marketType: 'moneyline', marketKey: 'k1', book: 'A', delta: 2, absDelta: 2, timeSincePrevMs: 200, timestamp: 1210 },

    // M2: e2_spread_k2 (Single move)
    { eventId: 'e2', marketType: 'spread', marketKey: 'k2', book: 'C', delta: 1, absDelta: 1, timeSincePrevMs: null, timestamp: 5000 }
];

// Test 1: Basic State Build
{
    const states = buildMarketState(mockFeatures, { windowMs: 60000 });
    const keys = Object.keys(states);
    assert.strictEqual(keys.length, 2, 'Should find 2 markets');

    // Check M1
    const m1 = states['e1_moneyline_k1'];
    assert.ok(m1, 'M1 found');
    assert.strictEqual(m1.totalMoves, 3);

    // avgDelta = (5 + 5 + 2) / 3 = 4  (raw delta, not abs)
    assert.ok(approxEqual(m1.avgDelta, 4), `avgDelta should be 4, got ${m1.avgDelta}`);

    // avgAbsDelta = (5 + 5 + 2) / 3 = 4
    assert.ok(approxEqual(m1.avgAbsDelta, 4), `avgAbsDelta should be 4, got ${m1.avgAbsDelta}`);

    // stdDelta = sqrt(Var(5, 5, 2))
    // Mean = 4, diffs = [1, 1, -2], sq = [1, 1, 4], Var = 6/3 = 2, Std = sqrt(2) ≈ 1.414
    assert.ok(approxEqual(m1.stdDelta, 1.414, 0.01), `stdDelta should be ~1.414, got ${m1.stdDelta}`);

    // booksFastestReactors (renamed from booksLeading)
    // Book B avgLag = 10
    // Book A avgLag = (100+200)/2 = 150
    // Sorted: B, A
    assert.strictEqual(m1.booksFastestReactors[0], 'B', 'Book B should be fastest');
    assert.strictEqual(m1.booksFastestReactors[1], 'A', 'Book A next');

    console.log('✓ Test 1: Aggregation, StdDev & Ranking Logic');
}

// Test 2: Volatility & Last Move
{
    const states = buildMarketState(mockFeatures, { windowMs: 60000 });
    const m2 = states['e2_spread_k2'];

    // Global max ts = 5000
    // M2 max ts = 5000 -> lastMoveMsAgo = 0
    assert.strictEqual(m2.lastMoveMsAgo, 0);

    const m1 = states['e1_moneyline_k1'];
    // M1 max ts = 1210 -> lastMoveMsAgo = 5000 - 1210 = 3790
    assert.strictEqual(m1.lastMoveMsAgo, 3790);

    console.log('✓ Test 2: Last Move Calculation');
}

// Test 3: StdDev edge case - all same delta
{
    const sameDeltas = [
        { eventId: 'e', marketType: 'm', marketKey: 'k', book: 'A', delta: 5, absDelta: 5, timeSincePrevMs: 10, timestamp: 100 },
        { eventId: 'e', marketType: 'm', marketKey: 'k', book: 'B', delta: 5, absDelta: 5, timeSincePrevMs: 20, timestamp: 200 },
        { eventId: 'e', marketType: 'm', marketKey: 'k', book: 'C', delta: 5, absDelta: 5, timeSincePrevMs: 30, timestamp: 300 }
    ];
    const states = buildMarketState(sameDeltas);
    const m = states['e_m_k'];

    assert.strictEqual(m.avgDelta, 5, 'avgDelta should be 5');
    assert.strictEqual(m.stdDelta, 0, 'stdDelta should be 0 when all deltas are equal');

    console.log('✓ Test 3: StdDev zero for uniform deltas');
}

// Test 4: Empty features
{
    const states = buildMarketState([]);
    assert.deepStrictEqual(states, {}, 'Empty features -> empty states');
    console.log('✓ Test 4: Empty features handling');
}

console.log('\n=== All market state tests passed ===\n');
