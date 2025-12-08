/**
 * tests/hf/hfStreamEngine.test.js
 */

const assert = require('assert');
const { runHfStreamFromEvents, createHfStreamEngine } = require('../../src/hf/hfStreamEngine');

console.log('=== hfStreamEngine.test.js ===\n');

// Mock events
const mockEvents = [
    { timestamp: 1000, eventId: 'e1', book: 'b1', marketType: 'moneyline', marketKey: 'k1', oldPrice: 100, newPrice: 110 },
    { timestamp: 1500, eventId: 'e1', book: 'b2', marketType: 'moneyline', marketKey: 'k1', oldPrice: 105, newPrice: 108 },
    { timestamp: 2000, eventId: 'e1', book: 'b1', marketType: 'moneyline', marketKey: 'k1', oldPrice: 110, newPrice: 115 },
    { timestamp: 70000, eventId: 'e1', book: 'b1', marketType: 'moneyline', marketKey: 'k1', oldPrice: 115, newPrice: 120 }
];

// Test 1: Events processed in order
{
    const processedTimestamps = [];

    runHfStreamFromEvents(mockEvents, {
        windowMs: 60000,
        onTick: ({ event }) => {
            processedTimestamps.push(event.timestamp || event._ts);
        }
    });

    assert.strictEqual(processedTimestamps.length, 4, 'Should process all events');

    // Check order
    for (let i = 1; i < processedTimestamps.length; i++) {
        assert.ok(processedTimestamps[i] >= processedTimestamps[i - 1], 'Events should be in timestamp order');
    }

    console.log('✓ Test 1: Events processed in timestamp order');
}

// Test 2: Feature and marketState presence
{
    let tickCount = 0;

    runHfStreamFromEvents(mockEvents, {
        windowMs: 60000,
        onTick: ({ event, feature, marketState }) => {
            tickCount++;

            assert.ok(event, 'Event should exist');
            assert.ok(feature, 'Feature should exist');
            assert.ok(marketState, 'Market state should exist');

            // Check feature structure
            assert.ok(feature.delta !== undefined, 'Feature should have delta');
            assert.ok(feature.absDelta !== undefined, 'Feature should have absDelta');
            assert.ok(feature.windowRollup, 'Feature should have windowRollup');
            assert.ok(feature.windowRollup.count > 0, 'Window count should be positive');

            // Check marketState structure
            assert.ok(marketState.volatilityScore !== undefined, 'Market state should have volatility score');
            assert.ok(Array.isArray(marketState.booksActive), 'Market state should have books active');
            assert.ok(marketState.totalMoves > 0, 'Total moves should be positive');
        }
    });

    assert.strictEqual(tickCount, 4, 'Should have 4 ticks');

    console.log('✓ Test 2: Feature and marketState presence');
}

// Test 3: Window expiration (windowMs)
{
    const windowCounts = [];

    runHfStreamFromEvents(mockEvents, {
        windowMs: 60000, // 60 second window
        onTick: ({ feature }) => {
            windowCounts.push(feature.windowRollup.count);
        }
    });

    // T=1000: count=1
    // T=1500: count=2 (both in window)
    // T=2000: count=3 (all 3 in window)
    // T=70000: count=1 (T=1000, T=1500, T=2000 all expired, only current event)

    assert.strictEqual(windowCounts[0], 1, 'First event: window count 1');
    assert.strictEqual(windowCounts[1], 2, 'Second event: window count 2');
    assert.strictEqual(windowCounts[2], 3, 'Third event: window count 3');
    assert.strictEqual(windowCounts[3], 1, 'Fourth event: window count 1 (previous expired)');

    console.log('✓ Test 3: Window expiration behavior');
}

// Test 4: onBatchEnd callback
{
    let batchEndCalled = false;
    let finalCount = 0;

    runHfStreamFromEvents(mockEvents, {
        windowMs: 60000,
        onBatchEnd: ({ count, lastTimestamp }) => {
            batchEndCalled = true;
            finalCount = count;
            assert.ok(lastTimestamp !== null, 'Last timestamp should exist');
        }
    });

    assert.ok(batchEndCalled, 'onBatchEnd should be called');
    assert.strictEqual(finalCount, 4, 'Final count should be 4');

    console.log('✓ Test 4: onBatchEnd callback');
}

// Test 5: Volatility increases with diverse deltas
{
    const volatilityScores = [];

    const diverseEvents = [
        { timestamp: 1000, eventId: 'e2', book: 'b1', marketType: 'spread', marketKey: 'k2', oldPrice: 100, newPrice: 100 }, // delta 0
        { timestamp: 2000, eventId: 'e2', book: 'b2', marketType: 'spread', marketKey: 'k2', oldPrice: 100, newPrice: 110 }, // delta 10
        { timestamp: 3000, eventId: 'e2', book: 'b3', marketType: 'spread', marketKey: 'k2', oldPrice: 100, newPrice: 90 },  // delta -10
        { timestamp: 4000, eventId: 'e2', book: 'b4', marketType: 'spread', marketKey: 'k2', oldPrice: 100, newPrice: 120 }  // delta 20
    ];

    runHfStreamFromEvents(diverseEvents, {
        windowMs: 60000,
        onTick: ({ marketState }) => {
            volatilityScores.push(marketState.volatilityScore);
        }
    });

    // Volatility should generally increase as we add more diverse moves
    assert.ok(volatilityScores[volatilityScores.length - 1] > volatilityScores[0],
        'Volatility should increase with diverse deltas');

    console.log('✓ Test 5: Volatility calculation');
}

// Test 6: Invalid timestamps are skipped
{
    const invalidEvents = [
        { timestamp: 1000, eventId: 'e3', book: 'b1', marketType: 'm', marketKey: 'k', oldPrice: 1, newPrice: 2 },
        { timestamp: undefined, eventId: 'e3', book: 'b2', marketType: 'm', marketKey: 'k', oldPrice: 2, newPrice: 3 },
        { timestamp: 'invalid', eventId: 'e3', book: 'b3', marketType: 'm', marketKey: 'k', oldPrice: 3, newPrice: 4 },
        { timestamp: 2000, eventId: 'e3', book: 'b4', marketType: 'm', marketKey: 'k', oldPrice: 4, newPrice: 5 }
    ];

    let tickCount = 0;

    runHfStreamFromEvents(invalidEvents, {
        windowMs: 60000,
        onTick: () => { tickCount++; }
    });

    assert.strictEqual(tickCount, 2, 'Should only process events with valid timestamps');

    console.log('✓ Test 6: Invalid timestamp handling');
}

console.log('\n=== All HF stream engine tests passed ===\n');
