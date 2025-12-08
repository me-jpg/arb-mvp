
const { buildBookLatencyStats } = require('../../src/latency/bookLatencyModel');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`FAIL: ${message}`);
    }
}

console.log('=== bookLatencyModel.test.js ===\n');

// Test 1: Simple scenario - Book A moves first, B follows
{
    const events = [
        { eventId: 'E1', marketType: 'moneyline', book: 'BookA', timestamp: 1000 },
        { eventId: 'E1', marketType: 'moneyline', book: 'BookB', timestamp: 1050 } // +50ms
    ];

    const stats = buildBookLatencyStats(events);

    // BookA: 0ms (first), BookB: 50ms
    // Note: Implementation counts first mover as 0 lag if it is part of the cluster
    // Let's verify if implementation does that. 
    // Code says: "for (const event of cluster) ... lags.push(lag)"
    // So BookA has 1 sample (0ms), BookB has 1 sample (50ms).

    assert(stats.totalSamples === 2, `Expected 2 samples, got ${stats.totalSamples}`);

    const a = stats.byBook['BookA'];
    const b = stats.byBook['BookB'];

    assert(a && a.sampleCount === 1, 'BookA should have 1 sample');
    assert(a.avgLagMs === 0, `BookA avg lag should be 0, got ${a.avgLagMs}`);

    assert(b && b.sampleCount === 1, 'BookB should have 1 sample');
    assert(b.avgLagMs === 50, `BookB avg lag should be 50, got ${b.avgLagMs}`);

    console.log('✓ Test 1: Simple 2-book sequence');
}

// Test 2: Multiple updates from same book in one cluster (Reaction logic)
// BookA moves, BookB moves, BookB adjusts again quickly.
// Should take FIRST move of BookB in the cluster.
{
    const events = [
        { eventId: 'E1', marketType: 'spread', book: 'BookA', timestamp: 1000 },
        { eventId: 'E1', marketType: 'spread', book: 'BookB', timestamp: 1100 },
        { eventId: 'E1', marketType: 'spread', book: 'BookB', timestamp: 1120 } // ignored for latency
    ];

    const stats = buildBookLatencyStats(events);

    assert(stats.totalSamples === 2, `Expected 2 samples (unique books per cluster), got ${stats.totalSamples}`);
    const b = stats.byBook['BookB'];
    assert(b.avgLagMs === 100, `BookB lag should be 100 (first move), got ${b.avgLagMs}`);

    console.log('✓ Test 2: Multiple updates (dedup per cluster)');
}

// Test 3: Distinct markets (Moneyline vs Spread) don't mix
{
    const events = [
        { eventId: 'E1', marketType: 'moneyline', book: 'BookA', timestamp: 1000 },
        { eventId: 'E1', marketType: 'spread', book: 'BookB', timestamp: 1010 }
    ];
    // Different markets -> Groups of size 1 -> Filtered out (need >1 book to compare)

    const stats = buildBookLatencyStats(events);
    assert(stats.totalSamples === 0, `Expected 0 samples (no matching pairs), got ${stats.totalSamples}`);

    console.log('✓ Test 3: Distinct markets separation');
}

// Test 4: Time Clustering (Separate Waves)
// Wave 1: A leads (t=1000), B follows (t=1050)
// Wave 2: B leads (t=5000), A follows (t=5020)
// Gap > 60s (60000ms). Here gap is 4000ms. Default gap in code is 60000.
// Wait, if gap is SMALLER than threshold, they are ONE cluster.
// t=1050 to t=5000 is gap of 3950ms. < 60000.
// So this will be treated as ONE giant cluster [A(1000), B(1050), B(5000), A(5020)].
// First mover: A(1000).
// B(1050) -> lag 50.
// B(5000) -> ignored (second move).
// A(5020) -> ignored (second move).
// Result: A=0, B=50.
// To test separate waves, we need gap > 60000.
{
    const events = [
        // Wave 1
        { eventId: 'E1', marketType: 'total', book: 'BookA', timestamp: 1000 },
        { eventId: 'E1', marketType: 'total', book: 'BookB', timestamp: 1100 }, // +100

        // Wave 2 (t=70000, >60s later)
        { eventId: 'E1', marketType: 'total', book: 'BookB', timestamp: 70000 },
        { eventId: 'E1', marketType: 'total', book: 'BookA', timestamp: 70050 }  // +50 vs B
    ];

    const stats = buildBookLatencyStats(events);

    // Wave 1: A(0), B(100)
    // Wave 2: B(0), A(50)

    const a = stats.byBook['BookA'];
    const b = stats.byBook['BookB'];

    // A lags: [0, 50] -> Avg 25
    // B lags: [100, 0] -> Avg 50

    assert(a.sampleCount === 2, 'BookA should have 2 samples');
    assert(a.avgLagMs === 25, `BookA avg should be 25, got ${a.avgLagMs}`);

    assert(b.sampleCount === 2, 'BookB should have 2 samples');
    assert(b.avgLagMs === 50, `BookB avg should be 50, got ${b.avgLagMs}`);

    console.log('✓ Test 4: Time clustering (separate waves)');
}

console.log('\n=== All BookLatencyModel tests passed! ===\n');
