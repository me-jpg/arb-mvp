/**
 * tests/metrics/latencyHealthClassifier.test.js
 * 
 * Unit tests for latency health classifier.
 */

const assert = require('assert');
const { classifyLatency } = require('../../src/metrics/latencyHealthClassifier');
const { getLatencyHealthConfig } = require('../../config');

console.log('=== Latency Health Classifier Tests ===\\n');

/**
 * Test: All OK
 */
{
    const latencySummary = {
        perBook: [
            { book: 'draftkings', sampleCount: 50, avgLagMs: 50, p95LagMs: 100, maxLagMs: 150 },
            { book: 'fanduel', sampleCount: 45, avgLagMs: 60, p95LagMs: 120, maxLagMs: 180 }
        ],
        global: { windowMinutes: 15, totalEvents: 100, booksConsidered: ['draftkings', 'fanduel'] }
    };

    const thresholds = {
        perBook: { degradedAvgLagMs: 150, degradedP95LagMs: 300, severeAvgLagMs: 300, severeP95LagMs: 600, minSamples: 20 },
        global: { degradedFractionSlowBooks: 0.3, severeFractionSlowBooks: 0.6 }
    };

    const result = classifyLatency(latencySummary, thresholds);

    assert.strictEqual(result.level, 'ok');
    assert.strictEqual(result.perBookStates.draftkings.level, 'ok');
    assert.strictEqual(result.perBookStates.fanduel.level, 'ok');
    assert.strictEqual(result.global.slowBookCount, 0);
    console.log('✓ All OK: no degraded books');
}

/**
 * Test: Single degraded book
 */
{
    const latencySummary = {
        perBook: [
            { book: 'draftkings', sampleCount: 50, avgLagMs: 50, p95LagMs: 100, maxLagMs: 150 },
            { book: 'fanduel', sampleCount: 45, avgLagMs: 180, p95LagMs: 320, maxLagMs: 400 }  // degraded
        ],
        global: { windowMinutes: 15, totalEvents: 100, booksConsidered: ['draftkings', 'fanduel'] }
    };

    const thresholds = {
        perBook: { degradedAvgLagMs: 150, degradedP95LagMs: 300, severeAvgLagMs: 300, severeP95LagMs: 600, minSamples: 20 },
        global: { degradedFractionSlowBooks: 0.3, severeFractionSlowBooks: 0.6 }
    };

    const result = classifyLatency(latencySummary, thresholds);

    assert.strictEqual(result.perBookStates.fanduel.level, 'degraded');
    assert.strictEqual(result.global.slowBookCount, 1);
    assert.strictEqual(result.global.slowBookFraction, 0.5);  // 1/2 = 50%
    assert.strictEqual(result.level, 'degraded');  // 50% >= 30% threshold
    assert.ok(result.reasons.length > 0);
    console.log('✓ Single degraded book: classified correctly');
}

/**
 * Test: Severe book
 */
{
    const latencySummary = {
        perBook: [
            { book: 'draftkings', sampleCount: 50, avgLagMs: 350, p95LagMs: 700, maxLagMs: 900 }  // severe
        ],
        global: { windowMinutes: 15, totalEvents: 50, booksConsidered: ['draftkings'] }
    };

    const thresholds = {
        perBook: { degradedAvgLagMs: 150, degradedP95LagMs: 300, severeAvgLagMs: 300, severeP95LagMs: 600, minSamples: 20 },
        global: { degradedFractionSlowBooks: 0.3, severeFractionSlowBooks: 0.6 }
    };

    const result = classifyLatency(latencySummary, thresholds);

    assert.strictEqual(result.perBookStates.draftkings.level, 'severe');
    assert.strictEqual(result.global.slowBookCount, 1);
    assert.strictEqual(result.level, 'severe');  // 100% >= 60% severe threshold
    assert.ok(result.reasons.some(r => r.includes('severe')));
    console.log('✓ Severe book: classified correctly');
}

/**
 * Test: Global severe due to many slow books
 */
{
    const latencySummary = {
        perBook: [
            { book: 'book1', sampleCount: 30, avgLagMs: 180, p95LagMs: 320, maxLagMs: 400 },  // degraded
            { book: 'book2', sampleCount: 30, avgLagMs: 190, p95LagMs: 330, maxLagMs: 410 },  // degraded
            { book: 'book3', sampleCount: 30, avgLagMs: 350, p95LagMs: 700, maxLagMs: 900 },  // severe
            { book: 'book4', sampleCount: 30, avgLagMs: 50, p95LagMs: 100, maxLagMs: 150 }    // ok
        ],
        global: { windowMinutes: 15, totalEvents: 120, booksConsidered: ['book1', 'book2', 'book3', 'book4'] }
    };

    const thresholds = {
        perBook: { degradedAvgLagMs: 150, degradedP95LagMs: 300, severeAvgLagMs: 300, severeP95LagMs: 600, minSamples: 20 },
        global: { degradedFractionSlowBooks: 0.3, severeFractionSlowBooks: 0.6 }
    };

    const result = classifyLatency(latencySummary, thresholds);

    assert.strictEqual(result.global.slowBookCount, 3);  // 3 out of 4 slow
    assert.strictEqual(result.global.slowBookFraction, 0.75);  // 75%
    assert.strictEqual(result.level, 'severe');  // 75% >= 60% severe threshold
    console.log('✓ Global severe: many slow books');
}

/**
 * Test: Insufficient samples
 */
{
    const latencySummary = {
        perBook: [
            { book: 'draftkings', sampleCount: 5, avgLagMs: 500, p95LagMs: 800, maxLagMs: 1000 }  // Low samples
        ],
        global: { windowMinutes: 15, totalEvents: 5, booksConsidered: ['draftkings'] }
    };

    const thresholds = {
        perBook: { degradedAvgLagMs: 150, degradedP95LagMs: 300, severeAvgLagMs: 300, severeP95LagMs: 600, minSamples: 20 },
        global: { degradedFractionSlowBooks: 0.3, severeFractionSlowBooks: 0.6 }
    };

    const result = classifyLatency(latencySummary, thresholds);

    assert.strictEqual(result.perBookStates.draftkings.level, 'ok');  // Insufficient samples = ok
    assert.strictEqual(result.global.slowBookCount, 0);
    assert.strictEqual(result.level, 'ok');
    console.log('✓ Insufficient samples: classified as ok');
}

/**
 * Test: Empty / missing data
 */
{
    const result1 = classifyLatency({}, {});
    assert.strictEqual(result1.level, 'ok');
    assert.deepStrictEqual(result1.perBookStates, {});
    assert.strictEqual(result1.global.slowBookCount, 0);

    const result2 = classifyLatency(null, {});
    assert.strictEqual(result2.level, 'ok');

    const result3 = classifyLatency({ perBook: [] }, {});
    assert.strictEqual(result3.level, 'ok');

    console.log('✓ Empty / missing data: no crash, safe defaults');
}

/**
 * Test: Config helper
 */
{
    const config1 = getLatencyHealthConfig({
        latencyHealth: {
            perBook: { degradedAvgLagMs: 200, minSamples: 30 },
            global: { degradedFractionSlowBooks: 0.4 }
        }
    });

    assert.strictEqual(config1.perBook.degradedAvgLagMs, 200);
    assert.strictEqual(config1.perBook.minSamples, 30);
    assert.strictEqual(config1.global.degradedFractionSlowBooks, 0.4);

    // Test clamping
    const config2 = getLatencyHealthConfig({
        latencyHealth: {
            perBook: { degradedAvgLagMs: 10000, minSamples: -5 },  // Out of range
            global: { degradedFractionSlowBooks: 1.5 }             // Over 1.0
        }
    });

    assert.strictEqual(config2.perBook.degradedAvgLagMs, 5000);  // Clamped to max
    assert.strictEqual(config2.perBook.minSamples, 1);            // Clamped to min
    assert.strictEqual(config2.global.degradedFractionSlowBooks, 1);  // Clamped to max

    // Test defaults
    const config3 = getLatencyHealthConfig({});
    assert.strictEqual(config3.perBook.degradedAvgLagMs, 150);
    assert.strictEqual(config3.perBook.degradedP95LagMs, 300);

    console.log('✓ getLatencyHealthConfig: defaults and clamping');
}

console.log('\\n=== All latency health classifier tests passed ===\\n');
