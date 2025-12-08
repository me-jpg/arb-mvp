/**
 * tests/metrics/arbResultsBuffer.test.js
 * 
 * Unit tests for arb results buffer.
 */

const assert = require('assert');
const { createArbResultsBuffer, addArbResult, getRecentArbResults } = require('../../src/metrics/arbResultsBuffer');
const { getArbResultsBufferConfig } = require('../../config');

console.log('=== Arb Results Buffer Tests ===\\n');

/**
 * Test: Basic append & retrieval
 */
{
    const buffer = createArbResultsBuffer({ maxSize: 10, windowMs: 60000 });
    const nowMs = Date.now();

    addArbResult(buffer, {
        eventId: 'evt1',
        books: ['draftkings', 'fanduel'],
        edge: 2.5,
        marketType: 'moneyline',
        createdAtMs: nowMs
    }, nowMs);

    addArbResult(buffer, {
        eventId: 'evt2',
        books: ['betmgm'],
        edge: 1.8,
        marketType: 'spread',
        createdAtMs: nowMs - 1000
    }, nowMs);

    const results = getRecentArbResults(buffer, nowMs);

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].eventId, 'evt1'); // Most recent first
    assert.strictEqual(results[1].eventId, 'evt2');
    console.log('✓ Basic append & retrieval: correct order');
}

/**
 * Test: Size trimming
 */
{
    const buffer = createArbResultsBuffer({ maxSize: 5, windowMs: 60000 });
    const nowMs = Date.now();

    // Add more than maxSize
    for (let i = 0; i < 10; i++) {
        addArbResult(buffer, {
            eventId: `evt${i}`,
            books: ['draftkings'],
            edge: 1.0,
            marketType: 'total',
            createdAtMs: nowMs - (i * 100)
        }, nowMs);
    }

    const results = getRecentArbResults(buffer, nowMs);

    assert.ok(results.length <= 5);
    assert.strictEqual(results[0].eventId, 'evt0'); // Most recent kept
    console.log('✓ Size trimming: respects maxSize');
}

/**
 * Test: Time window trimming
 */
{
    const buffer = createArbResultsBuffer({ maxSize: 100, windowMs: 10000 });
    const nowMs = Date.now();

    addArbResult(buffer, {
        eventId: 'recent',
        books: ['draftkings'],
        edge: 2.0,
        marketType: 'moneyline',
        createdAtMs: nowMs - 5000 // 5s ago, within window
    }, nowMs);

    addArbResult(buffer, {
        eventId: 'old',
        books: ['fanduel'],
        edge: 1.5,
        marketType: 'spread',
        createdAtMs: nowMs - 15000 // 15s ago, outside window
    }, nowMs);

    const results = getRecentArbResults(buffer, nowMs);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].eventId, 'recent');
    console.log('✓ Time window trimming: filters old entries');
}

/**
 * Test: Immutability
 */
{
    const buffer = createArbResultsBuffer({ maxSize: 10, windowMs: 60000 });
    const nowMs = Date.now();

    const original = {
        eventId: 'evt1',
        books: ['draftkings', 'fanduel'],
        edge: 2.5,
        marketType: 'moneyline',
        createdAtMs: nowMs
    };

    addArbResult(buffer, original, nowMs);

    // Mutate original
    original.edge = 99.9;
    original.books.push('betmgm');

    const results = getRecentArbResults(buffer, nowMs);

    assert.strictEqual(results[0].edge, 2.5); // Not mutated
    assert.strictEqual(results[0].books.length, 2); // Not mutated
    console.log('✓ Immutability: original not mutated');
}

/**
 * Test: Config helper
 */
{
    const config1 = getArbResultsBufferConfig({
        dashboard: {
            arbResultsBuffer: {
                maxSize: 50,
                windowSeconds: 180
            }
        }
    });

    assert.strictEqual(config1.maxSize, 50);
    assert.strictEqual(config1.windowMs, 180000);

    // Test clamping
    const config2 = getArbResultsBufferConfig({
        dashboard: {
            arbResultsBuffer: {
                maxSize: 5000, // Over limit
                windowSeconds: 30  // Under minimum
            }
        }
    });

    assert.strictEqual(config2.maxSize, 1000); // Clamped to max
    assert.strictEqual(config2.windowMs, 60000); // Clamped to min

    // Test defaults
    const config3 = getArbResultsBufferConfig({});
    assert.strictEqual(config3.maxSize, 200);
    assert.strictEqual(config3.windowMs, 300000);

    console.log('✓ Config helper: defaults and clamping');
}

console.log('\\n=== All arb results buffer tests passed ===\\n');
