/**
 * tests/latency/latencyAnomalyDetector.test.js
 */

const assert = require('assert');
const { buildLatencyBaselines, detectLatencyAnomalies } = require('../../src/latency/latencyAnomalyDetector');

console.log('===latencyAnomalyDetector.test.js ===\n');

// Helper to create mock events with specific lag patterns
function createMockEvents(book, avgLag, stdDev, count) {
    const events = [];
    const baseTime = 1000;

    for (let i = 0; i < count; i++) {
        // Create move cluster - first mover at baseTime + i*10000
        // This book reacts with avgLag ± stdDev
        const firstMoverTime = baseTime + i * 10000;
        const thisBookLag = avgLag + (Math.random() - 0.5) * 2 * stdDev;

        // First mover (different book)
        events.push({
            timestamp: firstMoverTime,
            eventId: `e${i}`,
            book: 'otherBook',
            marketType: 'moneyline',
            marketKey: 'k1',
            oldPrice: 100,
            newPrice: 105
        });

        // This book reacts
        events.push({
            timestamp: firstMoverTime + thisBookLag,
            eventId: `e${i}`,
            book,
            marketType: 'moneyline',
            marketKey: 'k1',
            oldPrice: 100,
            newPrice: 105
        });
    }

    return events;
}

// Test 1: Build baselines with known average
{
    const events = createMockEvents('bookA', 200, 50, 150); // 150 samples, avg=200ms, std~50ms

    const baselines = buildLatencyBaselines(events, { minSamples: 100 });

    assert.ok(baselines.byBook.bookA, 'bookA should have baseline');

    const baseline = baselines.byBook.bookA;
    assert.ok(Math.abs(baseline.avgLagMs - 200) < 30, `avgLagMs should be ~200, got ${baseline.avgLagMs}`);
    assert.ok(baseline.stdLagMs > 0, 'stdLagMs should be > 0');
    assert.strictEqual(baseline.sampleCount, 150, 'Should have 150 samples');

    console.log('✓ Test 1: Baseline building with known avg/std');
}

// Test 2: Insufficient samples - no baseline
{
    const events = createMockEvents('bookB', 200, 50, 50); // Only 50 samples

    const baselines = buildLatencyBaselines(events, { minSamples: 100 });

    assert.strictEqual(baselines.byBook.bookB, undefined, 'bookB should not have baseline (insufficient samples)');

    console.log('✓ Test 2: Insufficient samples - no baseline');
}

// Test 3: Anomaly detection - outlier detected
{
    // Build baseline: bookC normally at 200±50ms
    const baselineEvents = createMockEvents('bookC', 200, 50, 150);
    const baselines = buildLatencyBaselines(baselineEvents, { minSamples: 100 });

    // Test with outlier: bookC suddenly at 800ms (way outside 3σ)
    const testEvents = createMockEvents('bookC', 800, 10, 10);

    const anomalies = detectLatencyAnomalies(testEvents, baselines, { thresholdStdDevs: 3 });

    assert.ok(anomalies.length > 0, 'Should detect anomaly');
    const anom = anomalies.find(a => a.book === 'bookC');
    assert.ok(anom, 'bookC should have anomaly');
    assert.ok(anom.zScore > 3, `zScore should be > 3, got ${anom.zScore}`);
    assert.strictEqual(anom.severity, 'critical', 'Should be critical severity');

    console.log('✓ Test 3: Anomaly detection - outlier flagged');
}

// Test 4: No anomaly when within threshold
{
    // Baseline: bookD at 200±50ms
    const baselineEvents = createMockEvents('bookD', 200, 50, 150);
    const baselines = buildLatencyBaselines(baselineEvents, { minSamples: 100 });

    // Test: bookD still at 200±50ms (within normal range)
    const testEvents = createMockEvents('bookD', 220, 30, 10);

    const anomalies = detectLatencyAnomalies(testEvents, baselines, { thresholdStdDevs: 3 });

    const anom = anomalies.find(a => a.book === 'bookD');
    // Might be flagged or not depending on random samples, but if flagged, z-score should be low
    if (anom) {
        assert.ok(anom.zScore < 2, 'If flagged, z-score should be low');
    }

    console.log('✓ Test 4: No strong anomaly within threshold');
}

// Test 5: Zero std dev edge case
{
    // Create events where all lags are exactly the same
    const events = [];
    for (let i = 0; i < 120; i++) {
        const baseTime = 1000 + i * 10000;
        events.push({
            timestamp: baseTime,
            eventId: `e${i}`,
            book: 'otherBook',
            marketType: 'moneyline',
            marketKey: 'k1',
            oldPrice: 100,
            newPrice: 105
        });
        events.push({
            timestamp: baseTime + 100, // Always exactly 100ms lag
            eventId: `e${i}`,
            book: 'bookE',
            marketType: 'moneyline',
            marketKey: 'k1',
            oldPrice: 100,
            newPrice: 105
        });
    }

    const baselines = buildLatencyBaselines(events, { minSamples: 100 });
    assert.ok(baselines.byBook.bookE, 'bookE should have baseline');
    assert.strictEqual(baselines.byBook.bookE.stdLagMs, 0, 'Std should be 0 for constant lag');

    // Test with different lag - should be flagged as anomaly
    const testEvents = createMockEvents('bookE', 200, 10, 10);
    const anomalies = detectLatencyAnomalies(testEvents, baselines, { thresholdStdDevs: 3 });

    const anom = anomalies.find(a => a.book === 'bookE');
    if (anom) {
        assert.strictEqual(anom.zScore, Infinity, 'zScore should be Infinity when stdDev is 0');
        assert.strictEqual(anom.severity, 'critical', 'Should be critical');
    }

    console.log('✓ Test 5: Zero std dev edge case');
}

// Test 6: Empty events - no anomalies
{
    const baselines = buildLatencyBaselines([], { minSamples: 100 });
    assert.deepStrictEqual(baselines.byBook, {}, 'Empty events -> empty baselines');

    const anomalies = detectLatencyAnomalies([], baselines, { thresholdStdDevs: 3 });
    assert.strictEqual(anomalies.length, 0, 'Empty events -> no anomalies');

    console.log('✓ Test 6: Empty events handling');
}

console.log('\n=== All latency anomaly detector tests passed ===\n');
