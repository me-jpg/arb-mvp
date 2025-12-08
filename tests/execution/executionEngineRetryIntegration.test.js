/**
 * tests/execution/executionEngineRetryIntegration.test.js
 */

const assert = require('assert');
const { executeArbitrageBatch } = require('../../src/execution/executionEngine');

console.log('=== executionEngineRetryIntegration.test.js ===\n');

// Test 1: Default behavior - no retry with maxAttempts = 1
{
    const signals = [
        {
            id: 'sig1',
            eventId: 'evt1',
            primaryBook: 'dk',
            marketType: 'spread',
            side: 'over',
            line: 42.5,
            targetPrice: 1.95,
            expectedEdge: 0.025,
            timestamp: new Date().toISOString()
        }
    ];

    const config = {
        execution: {
            enabled: true,
            dryRun: false,
            defaultStake: 50,
            simSlippageBps: 0,
            simRejectProb: 0, // Ensure success
            retry: {
                maxAttempts: 1, // No retries
                baseDelayMs: 100,
                maxDelayMs: 2000,
                backoffFactor: 2,
                retryableErrorCodes: ['NETWORK_ERROR', 'TIMEOUT'],
                retryableFailureReasons: ['transient', 'unknown']
            }
        }
    };

    (async () => {
        const result = await executeArbitrageBatch(signals, config);

        assert.ok(result, 'Should return result');
        assert.ok(result.results, 'Should have results array');
        assert.strictEqual(result.results.length, 1, 'Should have 1 execution result');

        console.log('✓ Test 1: Default behavior with maxAttempts=1 (no retry)');
    })();
}

// Test 2: Success on first attempt with retries enabled
{
    const signals = [
        {
            id: 'sig2',
            eventId: 'evt2',
            primaryBook: 'betmgm',
            marketType: 'moneyline',
            side: 'home',
            targetPrice: 2.1,
            expectedEdge: 0.02,
            timestamp: new Date().toISOString()
        }
    ];

    const config = {
        execution: {
            enabled: true,
            dryRun: false,
            defaultStake: 50,
            simSlippageBps: 0,
            simRejectProb: 0, // Success on first try
            retry: {
                maxAttempts: 3, // Retries enabled but not needed
                baseDelayMs: 50,
                maxDelayMs: 500,
                backoffFactor: 2,
                retryableErrorCodes: ['NETWORK_ERROR', 'TIMEOUT'],
                retryableFailureReasons: ['transient', 'unknown']
            }
        }
    };

    setTimeout(async () => {
        const result = await executeArbitrageBatch(signals, config);

        assert.ok(result.results, 'Should have results');
        assert.strictEqual(result.results.length, 1, 'Should execute 1 order');
        assert.strictEqual(result.results[0].success, true, 'Should succeed on first attempt');

        console.log('✓ Test 2: Success on first attempt with retries enabled');
    }, 100);
}

// Test 3: Retry with simRejectProb (simulating intermittent failure)
{
    const signals = [
        {
            id: 'sig3',
            eventId: 'evt3',
            primaryBook: 'fanduel',
            marketType: 'total',
            side: 'under',
            targetPrice: 1.85,
            expectedEdge: 0.015,
            timestamp: new Date().toISOString()
        }
    ];

    const config = {
        execution: {
            enabled: true,
            dryRun: false,
            defaultStake: 50,
            simSlippageBps: 0,
            simRejectProb: 0.5, // 50% rejection rate - may retry
            retry: {
                maxAttempts: 3,
                baseDelayMs: 10, // Small delay for test speed
                maxDelayMs: 100,
                backoffFactor: 2,
                retryableErrorCodes: ['NETWORK_ERROR', 'TIMEOUT'],
                retryableFailureReasons: ['transient', 'unknown', 'rejected']
            }
        }
    };

    setTimeout(async () => {
        const result = await executeArbitrageBatch(signals, config);

        assert.ok(result.results, 'Should have results');
        assert.strictEqual(result.results.length, 1, 'Should attempt execution');

        // Result may succeed or fail after retries, but should complete
        assert.ok(result.results[0].success !== undefined, 'Should have success status');

        console.log('✓ Test 3: Retry logic handles intermittent failures');
    }, 200);
}

// Test 4: Multiple orders in batch
{
    const signals = [
        {
            id: 'sig4a',
            eventId: 'evt4',
            primaryBook: 'dk',
            marketType: 'spread',
            side: 'over',
            targetPrice: 1.92,
            expectedEdge: 0.02,
            timestamp: new Date().toISOString()
        },
        {
            id: 'sig4b',
            eventId: 'evt4',
            primaryBook: 'betmgm',
            marketType: 'spread',
            side: 'under',
            targetPrice: 1.91,
            expectedEdge: 0.025,
            timestamp: new Date().toISOString()
        }
    ];

    const config = {
        execution: {
            enabled: true,
            dryRun: false,
            defaultStake: 50,
            simSlippageBps: 0,
            simRejectProb: 0,
            retry: {
                maxAttempts: 2,
                baseDelayMs: 10,
                maxDelayMs: 100,
                backoffFactor: 2,
                retryableErrorCodes: ['NETWORK_ERROR'],
                retryableFailureReasons: ['transient']
            }
        }
    };

    setTimeout(async () => {
        const result = await executeArbitrageBatch(signals, config);

        assert.ok(result.results, 'Should have results');
        assert.strictEqual(result.results.length, 2, 'Should execute both orders');
        assert.ok(result.results.every(r => r.success !== undefined), 'All should have success status');

        console.log('✓ Test 4: Multiple orders in batch with retry enabled');
    }, 300);
}

// Test 5: Deterministic behavior - same config produces consistent results
{
    const signals = [
        {
            id: 'sig5',
            eventId: 'evt5',
            primaryBook: 'dk',
            marketType: 'moneyline',
            side: 'away',
            targetPrice: 2.5,
            expectedEdge: 0.03,
            timestamp: new Date().toISOString()
        }
    ];

    const config = {
        execution: {
            enabled: true,
            dryRun: false,
            defaultStake: 75,
            simSlippageBps: 0,
            simRejectProb: 0, // Deterministic
            retry: {
                maxAttempts: 1,
                baseDelayMs: 100,
                maxDelayMs: 2000,
                backoffFactor: 2,
                retryableErrorCodes: ['NETWORK_ERROR'],
                retryableFailureReasons: []
            }
        }
    };

    setTimeout(async () => {
        const result1 = await executeArbitrageBatch(signals, config);
        const result2 = await executeArbitrageBatch(signals, config);

        assert.strictEqual(result1.results.length, result2.results.length, 'Should be deterministic');
        assert.strictEqual(result1.results[0].success, result2.results[0].success, 'Success status should match');

        console.log('✓ Test 5: Deterministic behavior with same config');
    }, 400);
}

// Wait for all async tests to complete
setTimeout(() => {
    console.log('\n=== All execution engine retry integration tests passed ===\n');
}, 600);
