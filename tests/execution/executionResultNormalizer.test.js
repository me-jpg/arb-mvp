/**
 * tests/execution/executionResultNormalizer.test.js
 * 
 * Tests for execution result normalization and partial fill merging.
 */

const assert = require('assert');
const { normalizeExecutionResult, mergePartialFill } = require('../../src/execution/executionResultNormalizer');

console.log('=== Execution Result Normalizer Tests ===\\n');

/**
 * Test: Full fill from success flag
 */
{
    const rawResult = {
        success: true,
        book: 'draftkings'
    };

    const orderContext = {
        stake: 100,
        book: 'draftkings',
        eventId: 'evt123',
        marketType: 'moneyline',
        side: 'home',
        price: -110
    };

    const normalized = normalizeExecutionResult(rawResult, orderContext);

    assert.strictEqual(normalized.filledStake, 100, 'Full fill should have filledStake = requestedStake');
    assert.strictEqual(normalized.remainingStake, 0, 'Full fill should have remainingStake = 0');
    assert.strictEqual(normalized.status, 'filled', 'Full fill should have status = filled');
    assert.strictEqual(normalized.requestedStake, 100);

    console.log('✓ Full fill from success flag');
}

/**
 * Test: Explicit partial fill
 */
{
    const rawResult = {
        success: true,
        filledStake: 40,
        requestedStake: 100
    };

    const orderContext = {
        stake: 100,
        book: 'fanduel',
        eventId: 'evt456',
        marketType: 'spread',
        side: 'away',
        price: +105
    };

    const normalized = normalizeExecutionResult(rawResult, orderContext);

    assert.strictEqual(normalized.filledStake, 40, 'Partial fill should use explicit filledStake');
    assert.strictEqual(normalized.remainingStake, 60, 'Partial fill remainingStake = requestedStake - filledStake');
    assert.strictEqual(normalized.status, 'partial_filled', 'Partial fill should have status = partial_filled');

    console.log('✓ Explicit partial fill');
}

/**
 * Test: Rejection with error code
 */
{
    const rawResult = {
        success: false,
        errorCode: 'LIMIT_REJECTED',
        errorMessage: 'Bet limit exceeded'
    };

    const orderContext = {
        stake: 100,
        book: 'draftkings',
        eventId: 'evt789',
        marketType: 'total',
        side: 'over',
        price: -110
    };

    const normalized = normalizeExecutionResult(rawResult, orderContext);

    assert.strictEqual(normalized.filledStake, 0, 'Rejection should have filledStake = 0');
    assert.strictEqual(normalized.remainingStake, 100, 'Rejection should have full remainingStake');
    assert.strictEqual(normalized.status, 'rejected', 'Known rejection code should map to rejected');
    assert.strictEqual(normalized.errorCode, 'LIMIT_REJECTED');
    assert.strictEqual(normalized.errorMessage, 'Bet limit exceeded');

    console.log('✓ Rejection with error code');
}

/**
 * Test: Error (network/unknown)
 */
{
    const rawResult = {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'Connection timeout'
    };

    const orderContext = {
        stake: 100,
        book: 'fanduel',
        eventId: 'evt123',
        marketType: 'moneyline',
        side: 'home',
        price: -110
    };

    const normalized = normalizeExecutionResult(rawResult, orderContext);

    assert.strictEqual(normalized.filledStake, 0, 'Error should have filledStake = 0');
    assert.strictEqual(normalized.status, 'error', 'Unknown error code should map to error');
    assert.strictEqual(normalized.errorCode, 'NETWORK_ERROR');

    console.log('✓ Error (unknown code maps to error status)');
}

/**
 * Test: Determinism - same inputs produce same output
 */
{
    const rawResult = { success: true, filledStake: 75 };
    const orderContext = { stake: 100, book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110 };

    const normalized1 = normalizeExecutionResult(rawResult, orderContext);
    const normalized2 = normalizeExecutionResult(rawResult, orderContext);

    assert.deepStrictEqual(normalized1, normalized2, 'Same inputs should produce identical outputs');

    console.log('✓ Determinism: same inputs produce same output');
}

/**
 * Test: mergePartialFill - two partial fills
 */
{
    const existing = {
        book: 'draftkings',
        eventId: 'evt123',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        requestedStake: 100,
        filledStake: 30,
        remainingStake: 70,
        status: 'partial_filled',
        errorCode: null,
        errorMessage: null,
        raw: { attempt: 1 }
    };

    const newFill = {
        book: 'draftkings',
        eventId: 'evt123',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        requestedStake: 100,
        filledStake: 20,
        remainingStake: 50,
        status: 'partial_filled',
        errorCode: null,
        errorMessage: null,
        raw: { attempt: 2 }
    };

    const merged = mergePartialFill(existing, newFill);

    assert.strictEqual(merged.filledStake, 50, 'Merged fill should sum filledStakes');
    assert.strictEqual(merged.remainingStake, 50, 'Merged remainingStake = requestedStake - totalFilled');
    assert.strictEqual(merged.status, 'partial_filled', 'Status should remain partial_filled');

    console.log('✓ mergePartialFill: two partial fills');
}

/**
 * Test: mergePartialFill - partial + final fill
 */
{
    const existing = {
        book: 'fanduel',
        eventId: 'evt456',
        marketType: 'spread',
        side: 'away',
        price: +105,
        requestedStake: 100,
        filledStake: 70,
        remainingStake: 30,
        status: 'partial_filled',
        errorCode: null,
        errorMessage: null,
        raw: {}
    };

    const newFill = {
        book: 'fanduel',
        eventId: 'evt456',
        marketType: 'spread',
        side: 'away',
        price: +105,
        requestedStake: 100,
        filledStake: 30,
        remainingStake: 0,
        status: 'filled',
        errorCode: null,
        errorMessage: null,
        raw: {}
    };

    const merged = mergePartialFill(existing, newFill);

    assert.strictEqual(merged.filledStake, 100, 'Final fill should complete to requestedStake');
    assert.strictEqual(merged.remainingStake, 0, 'Final fill should have remainingStake = 0');
    assert.strictEqual(merged.status, 'filled', 'Status should be filled when complete');

    console.log('✓ mergePartialFill: partial + final fill completes order');
}

/**
 * Test: mergePartialFill - partial + error
 */
{
    const existing = {
        book: 'draftkings',
        eventId: 'evt789',
        marketType: 'total',
        side: 'over',
        price: -110,
        requestedStake: 100,
        filledStake: 40,
        remainingStake: 60,
        status: 'partial_filled',
        errorCode: null,
        errorMessage: null,
        raw: {}
    };

    const newFill = {
        book: 'draftkings',
        eventId: 'evt789',
        marketType: 'total',
        side: 'over',
        price: -110,
        requestedStake: 100,
        filledStake: 0,
        remainingStake: 100,
        status: 'error',
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'Connection lost',
        raw: {}
    };

    const merged = mergePartialFill(existing, newFill);

    assert.strictEqual(merged.filledStake, 40, 'Error should not add filled stake');
    assert.strictEqual(merged.remainingStake, 60, 'Remaining stake unchanged');
    assert.strictEqual(merged.status, 'partial_filled', 'Status should remain partial_filled');
    assert.strictEqual(merged.errorCode, 'NETWORK_ERROR', 'Error code should be preserved');

    console.log('✓ mergePartialFill: partial + error preserves partial and error info');
}

/**
 * Test: mergePartialFill - validation (different orders)
 */
{
    const existing = {
        book: 'draftkings',
        eventId: 'evt1',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        requestedStake: 100,
        filledStake: 50,
        remainingStake: 50,
        status: 'partial_filled',
        errorCode: null,
        errorMessage: null,
        raw: {}
    };

    const newFill = {
        book: 'fanduel',  // Different book
        eventId: 'evt1',
        marketType: 'moneyline',
        side: 'home',
        price: -110,
        requestedStake: 100,
        filledStake: 30,
        remainingStake: 70,
        status: 'partial_filled',
        errorCode: null,
        errorMessage: null,
        raw: {}
    };

    let errorThrown = false;
    try {
        mergePartialFill(existing, newFill);
    } catch (err) {
        errorThrown = true;
        assert.ok(err.message.includes('different orders'), 'Should throw error for different orders');
    }

    assert.ok(errorThrown, 'Should throw when merging different orders');

    console.log('✓ mergePartialFill: validates order identity');
}

console.log('\\n=== All normalizer tests passed ===\\n');
