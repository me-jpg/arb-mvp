/**
 * tests/execution/executionRetryPolicy.test.js
 */

const assert = require('assert');
const { buildRetryPolicy, shouldRetryExecution, computeNextBackoffMs } = require('../../src/execution/executionRetryPolicy');

console.log('=== executionRetryPolicy.test.js ===\n');

// Test 1: buildRetryPolicy - applies defaults
{
    const policy = buildRetryPolicy({});

    assert.strictEqual(policy.maxAttempts, 1, 'Default maxAttempts should be 1');
    assert.strictEqual(policy.baseDelayMs, 100, 'Default baseDelayMs should be 100');
    assert.strictEqual(policy.maxDelayMs, 2000, 'Default maxDelayMs should be 2000');
    assert.strictEqual(policy.backoffFactor, 2, 'Default backoffFactor should be 2');
    assert.deepStrictEqual(policy.retryableErrorCodes, ['NETWORK_ERROR', 'TIMEOUT']);
    assert.deepStrictEqual(policy.retryableFailureReasons, ['transient', 'unknown']);

    console.log('✓ Test 1: buildRetryPolicy applies defaults correctly');
}

// Test 2: buildRetryPolicy - overrides specific fields
{
    const policy = buildRetryPolicy({
        maxAttempts: 5,
        baseDelayMs: 200,
        retryableErrorCodes: ['CUSTOM_ERROR']
    });

    assert.strictEqual(policy.maxAttempts, 5, 'Should override maxAttempts');
    assert.strictEqual(policy.baseDelayMs, 200, 'Should override baseDelayMs');
    assert.deepStrictEqual(policy.retryableErrorCodes, ['CUSTOM_ERROR'], 'Should override retryableErrorCodes');
    assert.strictEqual(policy.maxDelayMs, 2000, 'Should keep default maxDelayMs');

    console.log('✓ Test 2: buildRetryPolicy overrides specific fields');
}

// Test 3: shouldRetryExecution - exceeds max attempts
{
    const policy = buildRetryPolicy({ maxAttempts: 3 });

    const result = shouldRetryExecution({
        attemptNumber: 3,
        errorCode: 'NETWORK_ERROR',
        policy
    });

    assert.strictEqual(result, false, 'Should not retry when at max attempts');

    console.log('✓ Test 3: shouldRetryExecution returns false when max attempts reached');
}

// Test 4: shouldRetryExecution - retryable error code
{
    const policy = buildRetryPolicy({ maxAttempts: 3 });

    const result = shouldRetryExecution({
        attemptNumber: 1,
        errorCode: 'NETWORK_ERROR',
        policy
    });

    assert.strictEqual(result, true, 'Should retry for retryable errorCode');

    console.log('✓ Test 4: shouldRetryExecution returns true for retryable errorCode');
}

// Test 5: shouldRetryExecution - retryable failure reason
{
    const policy = buildRetryPolicy({ maxAttempts: 3 });

    const result = shouldRetryExecution({
        attemptNumber: 1,
        failureReason: 'transient',
        policy
    });

    assert.strictEqual(result, true, 'Should retry for retryable failureReason');

    console.log('✓ Test 5: shouldRetryExecution returns true for retryable failureReason');
}

// Test 6: shouldRetryExecution - non-retryable error
{
    const policy = buildRetryPolicy({ maxAttempts: 3 });

    const result = shouldRetryExecution({
        attemptNumber: 1,
        errorCode: 'LIMIT_REJECTED',
        policy
    });

    assert.strictEqual(result, false, 'Should not retry for non-retryable errorCode');

    console.log('✓ Test 6: shouldRetryExecution returns false for non-retryable conditions');
}

// Test 7: computeNextBackoffMs - first attempt has no delay
{
    const policy = buildRetryPolicy();

    const delay = computeNextBackoffMs({
        attemptNumber: 1,
        policy
    });

    assert.strictEqual(delay, 0, 'First attempt should have 0ms delay');

    console.log('✓ Test 7: computeNextBackoffMs returns 0 for first attempt');
}

// Test 8: computeNextBackoffMs - exponential backoff
{
    const policy = buildRetryPolicy({ baseDelayMs: 100, backoffFactor: 2 });

    const delay2 = computeNextBackoffMs({ attemptNumber: 2, policy });
    const delay3 = computeNextBackoffMs({ attemptNumber: 3, policy });
    const delay4 = computeNextBackoffMs({ attemptNumber: 4, policy });

    assert.strictEqual(delay2, 100, 'Attempt 2 should be baseDelayMs');
    assert.strictEqual(delay3, 200, 'Attempt 3 should be baseDelayMs * factor');
    assert.strictEqual(delay4, 400, 'Attempt 4 should be baseDelayMs * factor^2');

    console.log('✓ Test 8: computeNextBackoffMs applies exponential backoff correctly');
}

// Test 9: computeNextBackoffMs - clamps at maxDelayMs
{
    const policy = buildRetryPolicy({ baseDelayMs: 1000, backoffFactor: 3, maxDelayMs: 2000 });

    const delay2 = computeNextBackoffMs({ attemptNumber: 2, policy });
    const delay3 = computeNextBackoffMs({ attemptNumber: 3, policy });
    const delay4 = computeNextBackoffMs({ attemptNumber: 4, policy });

    assert.strictEqual(delay2, 1000, 'Attempt 2: 1000ms');
    assert.strictEqual(delay3, 2000, 'Attempt 3: clamped to maxDelayMs (3000 -> 2000)');
    assert.strictEqual(delay4, 2000, 'Attempt 4: clamped to maxDelayMs');

    console.log('✓ Test 9: computeNextBackoffMs clamps at maxDelayMs');
}

// Test 10: Deterministic behavior
{
    const policy = buildRetryPolicy({ maxAttempts: 3 });

    const result1 = shouldRetryExecution({
        attemptNumber: 1,
        errorCode: 'TIMEOUT',
        policy
    });

    const result2 = shouldRetryExecution({
        attemptNumber: 1,
        errorCode: 'TIMEOUT',
        policy
    });

    assert.strictEqual(result1, result2, 'Should be deterministic');

    const delay1 = computeNextBackoffMs({ attemptNumber: 2, policy });
    const delay2 = computeNextBackoffMs({ attemptNumber: 2, policy });

    assert.strictEqual(delay1, delay2, 'Backoff should be deterministic');

    console.log('✓ Test 10: Retry policy functions are deterministic');
}

console.log('\n=== All execution retry policy tests passed ===\n');
