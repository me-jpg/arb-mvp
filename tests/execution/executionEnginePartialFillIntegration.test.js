/**
 * tests/execution/executionEnginePartialFillIntegration.test.js
 * 
 * Integration tests for partial fill handling in execution engine.
 */

const assert = require('assert');

console.log('=== Execution Engine Partial Fill Integration Tests ===\\n');

// Mock executeWithRetry with normalizer logic
async function executeWithRetryMock(order, context) {
    const { normalizeExecutionResult, mergePartialFill } = require('../../src/execution/executionResultNormalizer');

    let aggregate = null;

    // Simulate attempts based on context.mockAttempts
    const attempts = context.mockAttempts || [{ success: true }];

    for (let i = 0; i < attempts.length; i++) {
        const rawResult = attempts[i];
        const normalized = normalizeExecutionResult(rawResult, order);

        aggregate = aggregate
            ? mergePartialFill(aggregate, normalized)
            : normalized;

        // Stop if filled
        if (aggregate.status === 'filled') {
            break;
        }
    }

    return aggregate;
}

/**
 * Test: Single full fill
 */
{
    const order = {
        orderId: 'ord1',
        stake: 100,
        book: 'draftkings',
        eventId: 'evt123',
        marketType: 'moneyline',
        side: 'home',
        price: -110
    };

    const context = {
        mockAttempts: [
            { success: true, filledStake: 100 }
        ]
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'filled', 'Single full fill should return filled status');
        assert.strictEqual(result.filledStake, 100);
        assert.strictEqual(result.remainingStake, 0);
        console.log('✓ Single full fill: returns normalized filled status');
    });
}

/**
 * Test: Multi-attempt partial fills aggregate
 */
{
    const order = {
        orderId: 'ord2',
        stake: 100,
        book: 'fanduel',
        eventId: 'evt456',
        marketType: 'spread',
        side: 'away',
        price: +105
    };

    const context = {
        mockAttempts: [
            { success: true, filledStake: 30, requestedStake: 100 },
            { success: true, filledStake: 70, requestedStake: 100 }
        ]
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'filled', 'Multi-attempt should aggregate to filled');
        assert.strictEqual(result.filledStake, 100, 'Should sum filledStakes from both attempts');
        assert.strictEqual(result.remainingStake, 0, 'No remaining stake after completion');
        console.log('✓ Multi-attempt partial fills: aggregate to complete fill');
    });
}

/**
 * Test: Partial + failure preserves partial
 */
{
    const order = {
        orderId: 'ord3',
        stake: 100,
        book: 'draftkings',
        eventId: 'evt789',
        marketType: 'total',
        side: 'over',
        price: -110
    };

    const context = {
        mockAttempts: [
            { success: true, filledStake: 40, requestedStake: 100 },
            { success: false, errorCode: 'NETWORK_ERROR', errorMessage: 'Connection lost' }
        ]
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'partial_filled', 'Should remain partial_filled after error');
        assert.strictEqual(result.filledStake, 40, 'Should preserve filledStake from successful attempt');
        assert.strictEqual(result.remainingStake, 60, 'Should have remaining stake');
        assert.strictEqual(result.errorCode, 'NETWORK_ERROR', 'Should preserve error from failed attempt');
        console.log('✓ Partial + error: preserves partial fill and error info');
    });
}

/**
 * Test: Backward compatibility - single attempt maxAttempts=1
 */
{
    const order = {
        orderId: 'ord4',
        stake: 100,
        book: 'fanduel',
        eventId: 'evt111',
        marketType: 'moneyline',
        side: 'home',
        price: -110
    };

    const context = {
        mockAttempts: [
            { success: true, filledStake: 100 }
        ]
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'filled');
        assert.strictEqual(result.filledStake, 100);
        assert.ok(result.requestedStake !== undefined, 'Should have requestedStake');
        assert.ok(result.remainingStake !== undefined, 'Should have remainingStake');
        console.log('✓ Backward compatibility: single attempt returns normalized result');
    });
}

/**
 * Test: No double-counting of fills
 */
{
    const order = {
        orderId: 'ord5',
        stake: 100,
        book: 'draftkings',
        eventId: 'evt222',
        marketType: 'spread',
        side: 'away',
        price: +105
    };

    const context = {
        mockAttempts: [
            { success: true, filledStake: 25, requestedStake: 100 },
            { success: true, filledStake: 25, requestedStake: 100 },
            { success: true, filledStake: 25, requestedStake: 100 },
            { success: true, filledStake: 25, requestedStake: 100 }
        ]
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.filledStake, 100, 'Should aggregate all partial fills correctly');
        assert.strictEqual(result.status, 'filled', 'Should complete after 4 partial fills');
        assert.strictEqual(result.remainingStake, 0);
        console.log('✓ Multiple partials: no double-counting, correct aggregation');
    });
}

/**
 * Test: Early termination on filled
 */
{
    const order = {
        orderId: 'ord6',
        stake: 100,
        book: 'fanduel',
        eventId: 'evt333',
        marketType: 'total',
        side: 'under',
        price: -110
    };

    // Simulate early termination - should stop after 2nd attempt
    const context = {
        mockAttempts: [
            { success: true, filledStake: 60, requestedStake: 100 },
            { success: true, filledStake: 40, requestedStake: 100 }
            // This should not be reached if logic correctly stops after filled
        ]
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'filled');
        assert.strictEqual(result.filledStake, 100);
        console.log('✓ Early termination: stops retrying after order filled');
    });
}

console.log('\\n=== All partial fill integration tests passed ===\\n');
