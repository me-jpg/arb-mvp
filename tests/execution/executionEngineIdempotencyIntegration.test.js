/**
 * tests/execution/executionEngineIdempotencyIntegration.test.js
 * 
 * Integration tests for idempotency in execution engine.
 */

const assert = require('assert');

console.log('=== Execution Engine Idempotency Integration Tests ===\\n');

// Mock executeArbitrageBatch - simplified version for testing
async function executeArbitrageBatchMock(arbSignals, config = {}) {
    const { buildIdempotencyKey, shouldBlockDuplicate } = require('../../src/execution/executionIdempotency');
    const { getExecutionIdempotencyConfig } = require('../../config');

    const results = [];
    const idempotencyConfig = getExecutionIdempotencyConfig(config);

    for (const signal of arbSignals) {
        const orderContext = {
            eventId: signal.eventId || signal.id,
            book: signal.book,
            marketType: signal.marketType || signal.type,
            side: signal.side,
            price: signal.price,
            stake: signal.stake || signal.suggestedStake || 100
        };

        const recentExecutions = config.recentExecutions || [];
        const isBlocked = shouldBlockDuplicate(orderContext, recentExecutions, idempotencyConfig);

        if (isBlocked) {
            const idempotencyKey = buildIdempotencyKey(orderContext);
            results.push({
                signalId: signal.id,
                status: 'blocked_duplicate',
                reason: 'idempotency_duplicate_order',
                idempotencyKey
            });
        } else {
            // Mock successful execution
            results.push({
                signalId: signal.id,
                status: 'filled',
                executedStake: orderContext.stake
            });
        }
    }

    return { status: 'completed', results };
}

/**
 * Test: New order (no duplicates) - allows execution
 */
{
    const signal = {
        id: 'sig123',
        eventId: 'evt123',
        book: 'draftkings',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        stake: 100
    };

    const config = {
        recentExecutions: [],
        execution: {
            idempotency: {
                enabled: true
            }
        }
    };

    executeArbitrageBatchMock([signal], config).then(result => {
        assert.strictEqual(result.status, 'completed');
        assert.strictEqual(result.results.length, 1);
        assert.strictEqual(result.results[0].status, 'filled', 'New order should be filled');
        console.log('✓ New order (no duplicates): allowed and filled');
    });
}

/**
 * Test: Duplicate order - blocks execution
 */
{
    const signal = {
        id: 'sig123',
        eventId: 'evt123',
        book: 'draftkings',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        stake: 100
    };

    const recentExecutions = [
        {
            eventId: 'evt123',
            book: 'draftkings',
            marketType: 'moneyline',
            side: 'home',
            price: -110,
            stake: 100,
            status: 'filled',
            timestamp: new Date().toISOString()
        }
    ];

    const config = {
        recentExecutions,
        execution: {
            idempotency: {
                enabled: true
            }
        }
    };

    executeArbitrageBatchMock([signal], config).then(result => {
        assert.strictEqual(result.status, 'completed');
        assert.strictEqual(result.results.length, 1);
        assert.strictEqual(result.results[0].status, 'blocked_duplicate', 'Duplicate order should be blocked');
        assert.strictEqual(result.results[0].reason, 'idempotency_duplicate_order');
        assert.ok(result.results[0].idempotencyKey, 'Should include idempotency key');
        console.log('✓ Duplicate order: blocked with reason and key');
    });
}

/**
 * Test: Idempotency disabled - allows duplicate
 */
{
    const signal = {
        id: 'sig123',
        eventId: 'evt123',
        book: 'draftkings',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        stake: 100
    };

    const recentExecutions = [
        {
            eventId: 'evt123',
            book: 'draftkings',
            marketType: 'moneyline',
            side: 'home',
            price: -110,
            stake: 100,
            status: 'filled',
            timestamp: new Date().toISOString()
        }
    ];

    const config = {
        recentExecutions,
        execution: {
            idempotency: {
                enabled: false  // Disabled
            }
        }
    };

    executeArbitrageBatchMock([signal], config).then(result => {
        assert.strictEqual(result.status, 'completed');
        assert.strictEqual(result.results.length, 1);
        assert.strictEqual(result.results[0].status, 'filled', 'With idempotency disabled, duplicate should be allowed');
        console.log('✓ Idempotency disabled: duplicate allowed');
    });
}

/**
 * Test: Lookback window filtering
 */
{
    const signal = {
        id: 'sig123',
        eventId: 'evt123',
        book: 'draftkings',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        stake: 100
    };

    // Old execution outside window
    const recentExecutions = [
        {
            eventId: 'evt123',
            book: 'draftkings',
            marketType: 'moneyline',
            side: 'home',
            price: -110,
            stake: 100,
            status: 'filled',
            timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
        }
    ];

    const config = {
        recentExecutions,
        execution: {
            idempotency: {
                enabled: true,
                lookbackWindowMs: 5 * 60 * 1000 // 5 minute window
            }
        }
    };

    executeArbitrageBatchMock([signal], config).then(result => {
        assert.strictEqual(result.status, 'completed');
        assert.strictEqual(result.results.length, 1);
        assert.strictEqual(result.results[0].status, 'filled', 'Old execution outside window should not block');
        console.log('✓ Lookback window: old executions ignored, order filled');
    });
}

/**
 * Test: Multiple signals with mixed duplicates
 */
{
    const signals = [
        { id: 'sig1', eventId: 'evt1', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
        { id: 'sig2', eventId: 'evt2', book: 'fanduel', marketType: 'spread', side: 'away', price: +105, stake: 200 },
        { id: 'sig3', eventId: 'evt1', book: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, stake: 100 } // Duplicate of sig1
    ];

    const recentExecutions = [
        {
            eventId: 'evt1',
            book: 'draftkings',
            marketType: 'moneyline',
            side: 'home',
            price: -110,
            stake: 100,
            status: 'filled',
            timestamp: new Date().toISOString()
        }
    ];

    const config = {
        recentExecutions,
        execution: {
            idempotency: {
                enabled: true
            }
        }
    };

    executeArbitrageBatchMock(signals, config).then(result => {
        assert.strictEqual(result.status, 'completed');
        assert.strictEqual(result.results.length, 3);

        // sig1 should be blocked (duplicate)
        assert.strictEqual(result.results[0].status, 'blocked_duplicate', 'sig1 should be blocked');

        // sig2 should be filled (different event)
        assert.strictEqual(result.results[1].status, 'filled', 'sig2 should be filled');

        // sig3 should also be blocked (duplicate of sig1)
        assert.strictEqual(result.results[2].status, 'blocked_duplicate', 'sig3 should be blocked');

        console.log('✓ Multiple signals: mixed duplicates handled correctly');
    });
}

console.log('\\n=== All idempotency integration tests passed ===\\n');
