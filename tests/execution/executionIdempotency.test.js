/**
 * tests/execution/executionIdempotency.test.js
 * 
 * Tests for execution order idempotency & deduplication.
 */

const assert = require('assert');
const { buildIdempotencyKey, shouldBlockDuplicate } = require('../../src/execution/executionIdempotency');

console.log('=== Execution Idempotency Tests ===\\n');

/**
 * Test: buildIdempotencyKey - stable key
 */
{
    const orderContext = {
        eventId: 'evt123',
        book: 'draftkings',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        stake: 100
    };

    const key1 = buildIdempotencyKey(orderContext);
    const key2 = buildIdempotencyKey(orderContext);

    assert.strictEqual(key1, key2, 'Same orderContext should produce same key');
    console.log('✓ Stable key: same context produces same key');
}

/**
 * Test: buildIdempotencyKey - different keys for different books
 */
{
    const order1 = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };
    const order2 = { eventId: 'evt123', book: 'fanduel', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };

    const key1 = buildIdempotencyKey(order1);
    const key2 = buildIdempotencyKey(order2);

    assert.notStrictEqual(key1, key2, 'Different books should produce different keys');
    console.log('✓ Different books produce different keys');
}

/**
 * Test: buildIdempotencyKey - different keys for different fields
 */
{
    const base = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };

    const diffEvent = { ...base, eventId: 'evt456' };
    const diffSide = { ...base, side: 'away' };
    const diffPrice = { ...base, price: +100 };
    const diffStake = { ...base, stake: 200 };

    const baseKey = buildIdempotencyKey(base);

    assert.notStrictEqual(buildIdempotencyKey(diffEvent), baseKey, 'Different eventId produces different key');
    assert.notStrictEqual(buildIdempotencyKey(diffSide), baseKey, 'Different side produces different key');
    assert.notStrictEqual(buildIdempotencyKey(diffPrice), baseKey, 'Different price produces different key');
    assert.notStrictEqual(buildIdempotencyKey(diffStake), baseKey, 'Different stake produces different key');

    console.log('✓ Different fields (eventId, side, price, stake) produce different keys');
}

/**
 * Test: shouldBlockDuplicate - idempotency disabled
 */
{
    const orderContext = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };
    const recentExecutions = [
        { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100, status: 'filled' }
    ];
    const config = { enabled: false };

    const result = shouldBlockDuplicate(orderContext, recentExecutions, config);

    assert.strictEqual(result, false, 'Should not block when idempotency disabled');
    console.log('✓ Idempotency disabled: no blocking');
}

/**
 * Test: shouldBlockDuplicate - no prior executions
 */
{
    const orderContext = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };
    const recentExecutions = [];
    const config = { enabled: true };

    const result = shouldBlockDuplicate(orderContext, recentExecutions, config);

    assert.strictEqual(result, false, 'Should not block when no prior executions');
    console.log('✓ No prior executions: no blocking');
}

/**
 * Test: shouldBlockDuplicate - matching prior execution with final status
 */
{
    const orderContext = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };
    const recentExecutions = [
        { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100, status: 'filled', timestamp: new Date().toISOString() }
    ];
    const config = { enabled: true, lookbackWindowMs: 5 * 60 * 1000 };

    const result = shouldBlockDuplicate(orderContext, recentExecutions, config);

    assert.strictEqual(result, true, 'Should block matching order with final status');
    console.log('✓ Matching prior execution (filled): blocked');
}

/**
 * Test: shouldBlockDuplicate - non-matching prior execution
 */
{
    const orderContext = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };
    const recentExecutions = [
        { eventId: 'evt456', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100, status: 'filled' }
    ];
    const config = { enabled: true };

    const result = shouldBlockDuplicate(orderContext, recentExecutions, config);

    assert.strictEqual(result, false, 'Should not block when no matching execution');
    console.log('✓ Non-matching prior execution: no blocking');
}

/**
 * Test: shouldBlockDuplicate - lookback window
 */
{
    const orderContext = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };

    // Old execution outside window
    const oldExecution = {
        eventId: 'evt123',
        book: 'draftkings',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        stake: 100,
        status: 'filled',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
    };

    const config = { enabled: true, lookbackWindowMs: 5 * 60 * 1000 }; // 5 minute window

    const result = shouldBlockDuplicate(orderContext, [oldExecution], config);

    assert.strictEqual(result, false, 'Should not block executions outside lookback window');
    console.log('✓ Lookback window: old executions ignored');
}

/**
 * Test: shouldBlockDuplicate - matching with pre-computed idempotency key
 */
{
    const orderContext = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };
    const key = buildIdempotencyKey(orderContext);

    const recentExecutions = [
        { idempotencyKey: key, status: 'success', timestamp: new Date().toISOString() }
    ];
    const config = { enabled: true };

    const result = shouldBlockDuplicate(orderContext, recentExecutions, config);

    assert.strictEqual(result, true, 'Should block when matching pre-computed key');
    console.log('✓ Pre-computed idempotency key: blocked');
}

/**
 * Test: shouldBlockDuplicate - multiple final states
 */
{
    const orderContext = { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 };

    const testFinalStatus = (status) => {
        const recentExecutions = [
            { eventId: 'evt123', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100, status, timestamp: new Date().toISOString() }
        ];
        const config = { enabled: true };
        return shouldBlockDuplicate(orderContext, recentExecutions, config);
    };

    assert.strictEqual(testFinalStatus('filled'), true, 'Should block status:filled');
    assert.strictEqual(testFinalStatus('success'), true, 'Should block status:success');
    assert.strictEqual(testFinalStatus('rejected'), true, 'Should block status:rejected');
    assert.strictEqual(testFinalStatus('blocked'), true, 'Should block status:blocked');

    console.log('✓ Multiple final states (filled, success, rejected, blocked): all blocked');
}

console.log('\\n=== All idempotency tests passed ===\\n');
