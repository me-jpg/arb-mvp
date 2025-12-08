/**
 * tests/metrics/latencyHistoryBuffer.test.js
 * 
 * Unit tests for latency history buffer.
 */

const assert = require('assert');
const {
    createLatencyHistoryBuffer,
    addLatencySnapshot,
    getLatencyHistory
} = require('../../src/metrics/latencyHistoryBuffer');
const { getLatencyHistoryConfig } = require('../../config');

console.log('=== Latency History Buffer Tests ===\\n');

/**
 * Test: Initial add
 */
{
    const buffer = createLatencyHistoryBuffer({ maxPoints: 3, minIntervalMs: 10000 });

    const summary1 = {
        perBook: [{ book: 'BookA', avgLagMs: 100, p95LagMs: 200, maxLagMs: 300, sampleCount: 50 }],
        global: { windowMinutes: 15, totalEvents: 50, booksConsidered: ['BookA'] }
    };

    addLatencySnapshot(buffer, summary1, 100000);

    const history = getLatencyHistory(buffer, 100000);

    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].timestampMs, 100000);
    assert.strictEqual(history[0].latencySummary.perBook[0].book, 'BookA');
    console.log('✓ Initial add: single entry added');
}

/**
 * Test: Throttling
 */
{
    const buffer = createLatencyHistoryBuffer({ maxPoints: 5, minIntervalMs: 10000 });

    const summary = {
        perBook: [{ book: 'BookA', avgLagMs: 100, p95LagMs: 200, maxLagMs: 300, sampleCount: 50 }],
        global: { windowMinutes: 15, totalEvents: 50, booksConsidered: ['BookA'] }
    };

    addLatencySnapshot(buffer, summary, 100000);
    addLatencySnapshot(buffer, summary, 100500); // < 10 seconds later

    let history = getLatencyHistory(buffer, 100500);
    assert.strictEqual(history.length, 1); // Still only one entry

    addLatencySnapshot(buffer, summary, 111000); // > 10 seconds later

    history = getLatencyHistory(buffer, 111000);
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].timestampMs, 100000);
    assert.strictEqual(history[1].timestampMs, 111000);
    console.log('✓ Throttling: respects minIntervalMs');
}

/**
 * Test: Max points trimming
 */
{
    const buffer = createLatencyHistoryBuffer({ maxPoints: 2, minIntervalMs: 1000 });

    const summary = {
        perBook: [{ book: 'BookA', avgLagMs: 100, p95LagMs: 200, maxLagMs: 300, sampleCount: 50 }],
        global: { windowMinutes: 15, totalEvents: 50, booksConsidered: ['BookA'] }
    };

    addLatencySnapshot(buffer, summary, 100000);
    addLatencySnapshot(buffer, summary, 102000);
    addLatencySnapshot(buffer, summary, 104000);

    const history = getLatencyHistory(buffer, 104000);

    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].timestampMs, 102000); // Oldest (100000) dropped
    assert.strictEqual(history[1].timestampMs, 104000);
    console.log('✓ Max points trimming: keeps only maxPoints entries');
}

/**
 * Test: Skipping empty summary
 */
{
    const buffer = createLatencyHistoryBuffer({ maxPoints: 5, minIntervalMs: 1000 });

    const emptySummary1 = {
        perBook: [],
        global: { windowMinutes: 15, totalEvents: 0, booksConsidered: [] }
    };

    const emptySummary2 = {
        perBook: [{ book: 'BookA', avgLagMs: 100, p95LagMs: 200, maxLagMs: 300, sampleCount: 50 }],
        global: { windowMinutes: 15, totalEvents: 0, booksConsidered: [] } // totalEvents = 0
    };

    addLatencySnapshot(buffer, emptySummary1, 100000);
    addLatencySnapshot(buffer, emptySummary2, 102000);

    const history = getLatencyHistory(buffer, 102000);

    assert.strictEqual(history.length, 0); // No entries added
    console.log('✓ Skipping empty summary: no entries for empty data');
}

/**
 * Test: Immutability
 */
{
    const buffer = createLatencyHistoryBuffer({ maxPoints: 5, minIntervalMs: 1000 });

    const summary = {
        perBook: [{ book: 'BookA', avgLagMs: 100, p95LagMs: 200, maxLagMs: 300, sampleCount: 50 }],
        global: { windowMinutes: 15, totalEvents: 50, booksConsidered: ['BookA'] }
    };

    addLatencySnapshot(buffer, summary, 100000);

    // Mutate original
    summary.perBook[0].book = 'BookB';
    summary.global.totalEvents = 999;

    const history = getLatencyHistory(buffer, 100000);

    // Stored copy should be unchanged
    assert.strictEqual(history[0].latencySummary.perBook[0].book, 'BookA');
    assert.strictEqual(history[0].latencySummary.global.totalEvents, 50);
    console.log('✓ Immutability: stored summary unaffected by mutation');
}

/**
 * Test: Config helper
 */
{
    const config1 = getLatencyHistoryConfig({
        latencyHistory: {
            maxPoints: 100,
            minIntervalSeconds: 60
        }
    });

    assert.strictEqual(config1.maxPoints, 100);
    assert.strictEqual(config1.minIntervalSeconds, 60);
    assert.strictEqual(config1.minIntervalMs, 60000);

    // Test clamping
    const config2 = getLatencyHistoryConfig({
        latencyHistory: {
            maxPoints: 1000,  // Over max (500)
            minIntervalSeconds: 5000  // Over max (3600)
        }
    });

    assert.strictEqual(config2.maxPoints, 500);
    assert.strictEqual(config2.minIntervalSeconds, 3600);

    // Test defaults
    const config3 = getLatencyHistoryConfig({});
    assert.strictEqual(config3.maxPoints, 60);
    assert.strictEqual(config3.minIntervalSeconds, 30);

    console.log('✓ getLatencyHistoryConfig: defaults and clamping');
}

console.log('\\n=== All latency history buffer tests passed ===\\n');
