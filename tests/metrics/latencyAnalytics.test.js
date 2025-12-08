/**
 * tests/metrics/latencyAnalytics.test.js
 * 
 * Unit tests for latency analytics module.
 */

const assert = require('assert');
const { computeCrossBookLatency, summarizeLatencyByBook } = require('../../src/metrics/latencyAnalytics');
const { getLatencyMetricsConfig } = require('../../config');

console.log('=== Latency Analytics Tests ===\\n');

/**
 * Test: computeCrossBookLatency basic aggregation
 */
{
    const events = [
        {
            eventId: 'evt1',
            marketType: 'moneyline',
            firstBook: 'draftkings',
            laggingBooks: { 'fanduel': 100, 'betmgm': 250 },
            timestampMs: 1000000
        },
        {
            eventId: 'evt2',
            marketType: 'spread',
            firstBook: 'draftkings',
            laggingBooks: { 'fanduel': 150, 'betmgm': 300 },
            timestampMs: 1001000
        },
        {
            eventId: 'evt3',
            marketType: 'total',
            firstBook: 'fanduel',
            laggingBooks: { 'draftkings': 50, 'betmgm': 200 },
            timestampMs: 1002000
        }
    ];

    const result = computeCrossBookLatency(events, {
        windowMinutes: 15,
        minEventsPerBook: 1,
        maxBooks: 20
    });

    assert.ok(result.books.fanduel);
    assert.ok(result.books.betmgm);
    assert.ok(result.books.draftkings);

    // fanduel: [100, 150] -> avg=125, draftkings: [50]
    assert.ok(result.books.fanduel.avgLagMs > 0);
    assert.ok(result.books.fanduel.sampleCount >= 2);
    assert.strictEqual(result.global.totalEvents, 3);
    console.log('✓ computeCrossBookLatency: basic aggregation');
}

/**
 * Test: minEventsPerBook filtering
 */
{
    const events = [
        {
            eventId: 'evt1',
            marketType: 'moneyline',
            firstBook: 'draftkings',
            laggingBooks: { 'fanduel': 100, 'betmgm': 250 },
            timestampMs: 1000000
        }
    ];

    const result = computeCrossBookLatency(events, {
        windowMinutes: 15,
        minEventsPerBook: 5,  // Require at least 5 samples
        maxBooks: 20
    });

    // With only 1 sample each, all books should be filtered out
    assert.strictEqual(Object.keys(result.books).length, 0);
    console.log('✓ minEventsPerBook filtering: books below threshold omitted');
}

/**
 * Test: summarizeLatencyByBook shape
 */
{
    const latencyStats = {
        books: {
            draftkings: { sampleCount: 10, avgLagMs: 50, p95LagMs: 100, maxLagMs: 150 },
            fanduel: { sampleCount: 15, avgLagMs: 120, p95LagMs: 250, maxLagMs: 300 },
            betmgm: { sampleCount: 12, avgLagMs: 200, p95LagMs: 350, maxLagMs: 400 }
        },
        global: {
            windowMinutes: 15,
            totalEvents: 25,
            booksConsidered: ['draftkings', 'fanduel', 'betmgm']
        }
    };

    const result = summarizeLatencyByBook(latencyStats);

    assert.ok(Array.isArray(result.perBook));
    assert.strictEqual(result.perBook.length, 3);
    assert.ok(result.global);

    // Should be sorted by worst latency first (p95 descending)
    assert.ok(result.perBook[0].p95LagMs >= result.perBook[1].p95LagMs);
    assert.ok(result.perBook[1].p95LagMs >= result.perBook[2].p95LagMs);

    // Each entry should have required fields
    for (const entry of result.perBook) {
        assert.ok(entry.book);
        assert.ok(typeof entry.sampleCount === 'number');
        assert.ok(typeof entry.avgLagMs === 'number');
        assert.ok(typeof entry.p95LagMs === 'number');
        assert.ok(typeof entry.maxLagMs === 'number');
    }

    console.log('✓ summarizeLatencyByBook: correct shape and sorting');
}

/**
 * Test: Config helper
 */
{
    const config1 = getLatencyMetricsConfig({
        latencyMetrics: {
            windowMinutes: 30,
            minEventsPerBook: 50,
            maxBooks: 10
        }
    });

    assert.strictEqual(config1.windowMinutes, 30);
    assert.strictEqual(config1.minEventsPerBook, 50);
    assert.strictEqual(config1.maxBooks, 10);

    // Test clamping
    const config2 = getLatencyMetricsConfig({
        latencyMetrics: {
            windowMinutes: 200,  // Over max (120)
            minEventsPerBook: 2000,  // Over max (1000)
            maxBooks: 200  // Over max (100)
        }
    });

    assert.strictEqual(config2.windowMinutes, 120);
    assert.strictEqual(config2.minEventsPerBook, 1000);
    assert.strictEqual(config2.maxBooks, 100);

    // Test defaults
    const config3 = getLatencyMetricsConfig({});
    assert.strictEqual(config3.windowMinutes, 15);
    assert.strictEqual(config3.minEventsPerBook, 20);
    assert.strictEqual(config3.maxBooks, 20);

    console.log('✓ getLatencyMetricsConfig: defaults and clamping');
}

console.log('\\n=== All latency analytics tests passed ===\\n');
