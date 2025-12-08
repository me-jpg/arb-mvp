/**
 * tests/hf/hfFeatureExtractor.test.js
 */

const assert = require('assert');
const { extractFeatures } = require('../../src/hf/hfFeatureExtractor');

console.log('=== hfFeatureExtractor.test.js ===\n');

// Mock Events
const events = [
    // T=0
    { timestamp: 1000, eventId: 'e1', book: 'b1', marketType: 'moneyline', marketKey: 'mk1', oldPrice: 100, newPrice: 110 },
    // T=10s
    { timestamp: 11000, eventId: 'e1', book: 'b2', marketType: 'moneyline', marketKey: 'mk1', oldPrice: 105, newPrice: 108 },
    // T=50s (Still in 60s window)
    { timestamp: 51000, eventId: 'e1', book: 'b1', marketType: 'moneyline', marketKey: 'mk1', oldPrice: 110, newPrice: 115 },
    // T=70s (Window slides past T=0)
    { timestamp: 71000, eventId: 'e1', book: 'b1', marketType: 'moneyline', marketKey: 'mk1', oldPrice: 115, newPrice: 120 }
];

// Test 1: Basic Extraction
{
    const features = extractFeatures(events, { windowMs: 60000 });
    assert.strictEqual(features.length, 4, 'Should produce 4 features');

    // First feature
    const f1 = features[0];
    assert.strictEqual(f1.delta, 10, 'First delta should be 110-100=10');
    assert.strictEqual(f1.timeSincePrevMs, null, 'First event has no history');
    assert.strictEqual(f1.windowRollup.count, 1, 'First window count 1');

    // Third feature (T=51s)
    // Window [T=0, T=10, T=51] -> Count 3
    const f3 = features[2];
    assert.strictEqual(f3.windowRollup.count, 3, 'Window count should be 3');
    // Deltas: 10, 3, 5 -> Avg Abs: (10+3+5)/3 = 6
    assert.strictEqual(f3.windowRollup.avgAbsDelta, 6, 'Avg abs delta check');

    // Fourth feature (T=71s)
    // Window [T=10 (11s), T=51, T=71] -> Count 3 (T=0 expired)
    const f4 = features[3];
    assert.strictEqual(f4.windowRollup.count, 3, 'Window count should drop T=0');

    console.log('✓ Test 1: Sequence and Window Logic');
}

// Test 2: Sorting robustness
{
    const unsorted = [
        { timestamp: 2000, newPrice: 10, oldPrice: 5, eventId: 'x', book: 'b', marketType: 'm', marketKey: 'k' },
        { timestamp: 1000, newPrice: 5, oldPrice: 0, eventId: 'x', book: 'b', marketType: 'm', marketKey: 'k' }
    ];
    const feats = extractFeatures(unsorted, { windowMs: 10000 });
    assert.strictEqual(feats[0].delta, 5, 'Should process T=1000 first (delta 5)');
    assert.strictEqual(feats[1].delta, 5, 'Then T=2000 (delta 5)');
    console.log('✓ Test 2: Auto-sorting');
}

// Test 3: Performance - O(N) check with 10k events
{
    const largeEvents = [];
    for (let i = 0; i < 10000; i++) {
        largeEvents.push({
            timestamp: 1000 + i * 10, // 10ms apart
            eventId: 'perf',
            book: `b${i % 5}`,
            marketType: 'spread',
            marketKey: 'k1',
            oldPrice: 100 + i,
            newPrice: 100 + i + 1
        });
    }

    const start = Date.now();
    const features = extractFeatures(largeEvents, { windowMs: 60000 });
    const elapsed = Date.now() - start;

    assert.strictEqual(features.length, 10000, 'Should process all 10k events');
    // O(N) should complete in < 500ms on modern hardware
    // O(N²) with shift() would take many seconds
    assert.ok(elapsed < 2000, `Should complete quickly (was ${elapsed}ms)`);

    console.log(`✓ Test 3: Performance - 10k events in ${elapsed}ms`);
}

// Test 4: Invalid timestamps are skipped
{
    const badEvents = [
        { timestamp: 1000, eventId: 'e', book: 'b', marketType: 'm', marketKey: 'k', oldPrice: 1, newPrice: 2 },
        { timestamp: undefined, eventId: 'e', book: 'b', marketType: 'm', marketKey: 'k', oldPrice: 1, newPrice: 2 },
        { timestamp: 'invalid', eventId: 'e', book: 'b', marketType: 'm', marketKey: 'k', oldPrice: 1, newPrice: 2 },
        { timestamp: 2000, eventId: 'e', book: 'b', marketType: 'm', marketKey: 'k', oldPrice: 2, newPrice: 3 }
    ];
    const feats = extractFeatures(badEvents, { windowMs: 10000 });
    assert.strictEqual(feats.length, 2, 'Should skip invalid timestamps');
    console.log('✓ Test 4: Invalid timestamp handling');
}

console.log('\n=== All HF feature tests passed ===\n');
