/**
 * tests/risk/simRiskEngine.test.js
 */

const assert = require('assert');
const { computeStakeSize, applyRiskCaps } = require('../../src/risk/simRiskEngine');

console.log('=== simRiskEngine.test.js ===\n');

// Test 1: Returns 0 for edge <= 0 or null
{
    const params = {
        edge: 0,
        bankroll: 10000,
        baseUnit: 10
    };

    assert.strictEqual(computeStakeSize(params), 0, 'Should return 0 for edge = 0');
    assert.strictEqual(computeStakeSize({ ...params, edge: -0.01 }), 0, 'Should return 0 for negative edge');
    assert.strictEqual(computeStakeSize({ ...params, edge: null }), 0, 'Should return 0 for null edge');

    console.log('✓ Test 1: Returns 0 for edge <= 0 or null');
}

// Test 2: Kelly calculation correctness
{
    const params = {
        edge: 0.02,           // 2% edge
        bankroll: 10000,
        baseUnit: 10,
        kellyFraction: 0.25
    };

    // Expected: 10000 * 0.02 * 0.25 = 50, snapped to nearest 10 = 50
    const result = computeStakeSize(params);
    assert.strictEqual(result, 50, 'Kelly calculation should be correct');

    console.log('✓ Test 2: Kelly calculation correctness');
}

// Test 3: BaseUnit snapping
{
    const params = {
        edge: 0.027,          // Results in 67.5 before snapping
        bankroll: 10000,
        baseUnit: 10,
        kellyFraction: 0.25
    };

    // Expected: 10000 * 0.027 * 0.25 = 67.5, snapped to nearest 10 = 70
    const result = computeStakeSize(params);
    assert.strictEqual(result, 70, 'Should snap to nearest baseUnit');

    console.log('✓ Test 3: BaseUnit snapping works correctly');
}

// Test 4: minStake floor
{
    const params = {
        edge: 0.005,          // Small edge
        bankroll: 10000,
        baseUnit: 10,
        kellyFraction: 0.25,
        minStake: 20
    };

    // Expected: 10000 * 0.005 * 0.25 = 12.5, snapped to 10, < minStake 20 → 0
    const result = computeStakeSize(params);
    assert.strictEqual(result, 0, 'Should return 0 when snapped stake < minStake');

    // With larger edge that meets minStake
    const result2 = computeStakeSize({ ...params, edge: 0.02 });
    assert.strictEqual(result2, 50, 'Should return stake when >= minStake');

    console.log('✓ Test 4: minStake floor behaves correctly');
}

// Test 5: maxStake ceiling
{
    const params = {
        edge: 0.10,           // Large edge
        bankroll: 10000,
        baseUnit: 10,
        kellyFraction: 0.25,
        maxStake: 100
    };

    // Expected: 10000 * 0.10 * 0.25 = 250, snapped to 250, > maxStake 100 → 100
    const result = computeStakeSize(params);
    assert.strictEqual(result, 100, 'Should clamp to maxStake');

    console.log('✓ Test 5: maxStake ceiling behaves correctly');
}

// Test 6: Determinism
{
    const params = {
        edge: 0.03,
        bankroll: 10000,
        baseUnit: 10,
        kellyFraction: 0.25
    };

    const result1 = computeStakeSize(params);
    const result2 = computeStakeSize(params);

    assert.strictEqual(result1, result2, 'Should be deterministic');

    console.log('✓ Test 6: Deterministic output');
}

// Test 7: applyRiskCaps - no caps
{
    const stake = 150;
    const result = applyRiskCaps(stake, {});

    assert.strictEqual(result, 150, 'Should not change stake when no caps');
    /**
     * tests/risk/simRiskEngine.test.js
     */

    const assert = require('assert');
    const { computeStakeSize, applyRiskCaps } = require('../../src/risk/simRiskEngine');

    console.log('=== simRiskEngine.test.js ===\n');

    // Test 1: Returns 0 for edge <= 0 or null
    {
        const params = {
            edge: 0,
            bankroll: 10000,
            baseUnit: 10
        };

        assert.strictEqual(computeStakeSize(params), 0, 'Should return 0 for edge = 0');
        assert.strictEqual(computeStakeSize({ ...params, edge: -0.01 }), 0, 'Should return 0 for negative edge');
        assert.strictEqual(computeStakeSize({ ...params, edge: null }), 0, 'Should return 0 for null edge');

        console.log('✓ Test 1: Returns 0 for edge <= 0 or null');
    }

    // Test 2: Kelly calculation correctness
    {
        const params = {
            edge: 0.02,           // 2% edge
            bankroll: 10000,
            baseUnit: 10,
            kellyFraction: 0.25
        };

        // Expected: 10000 * 0.02 * 0.25 = 50, snapped to nearest 10 = 50
        const result = computeStakeSize(params);
        assert.strictEqual(result, 50, 'Kelly calculation should be correct');

        console.log('✓ Test 2: Kelly calculation correctness');
    }

    // Test 3: BaseUnit snapping
    {
        const params = {
            edge: 0.027,          // Results in 67.5 before snapping
            bankroll: 10000,
            baseUnit: 10,
            kellyFraction: 0.25
        };

        // Expected: 10000 * 0.027 * 0.25 = 67.5, snapped to nearest 10 = 70
        const result = computeStakeSize(params);
        assert.strictEqual(result, 70, 'Should snap to nearest baseUnit');

        console.log('✓ Test 3: BaseUnit snapping works correctly');
    }

    // Test 4: minStake floor
    {
        const params = {
            edge: 0.005,          // Small edge
            bankroll: 10000,
            baseUnit: 10,
            kellyFraction: 0.25,
            minStake: 20
        };

        // Expected: 10000 * 0.005 * 0.25 = 12.5, snapped to 10, < minStake 20 → 0
        const result = computeStakeSize(params);
        assert.strictEqual(result, 0, 'Should return 0 when snapped stake < minStake');

        // With larger edge that meets minStake
        const result2 = computeStakeSize({ ...params, edge: 0.02 });
        assert.strictEqual(result2, 50, 'Should return stake when >= minStake');

        console.log('✓ Test 4: minStake floor behaves correctly');
    }

    // Test 5: maxStake ceiling
    {
        const params = {
            edge: 0.10,           // Large edge
            bankroll: 10000,
            baseUnit: 10,
            kellyFraction: 0.25,
            maxStake: 100
        };

        // Expected: 10000 * 0.10 * 0.25 = 250, snapped to 250, > maxStake 100 → 100
        const result = computeStakeSize(params);
        assert.strictEqual(result, 100, 'Should clamp to maxStake');

        console.log('✓ Test 5: maxStake ceiling behaves correctly');
    }

    // Test 6: Determinism
    {
        const params = {
            edge: 0.03,
            bankroll: 10000,
            baseUnit: 10,
            kellyFraction: 0.25
        };

        const result1 = computeStakeSize(params);
        const result2 = computeStakeSize(params);

        assert.strictEqual(result1, result2, 'Should be deterministic');

        console.log('✓ Test 6: Deterministic output');
    }

    // Test 7: applyRiskCaps - no caps
    {
        const stake = 150;
        const result = applyRiskCaps(stake, {});

        assert.strictEqual(result, 150, 'Should not change stake when no caps');

        assert.strictEqual(result, 100, 'Should reduce stake to fit within cap (500 - 400 = 100)');

        console.log('✓ Test 9: applyRiskCaps - maxPerBookExposure reduces stake to fit');
    }

    // Test 10: applyRiskCaps - maxPerBookExposure returns 0 when at limit
    {
        const stake = 200;
        const caps = { maxPerBookExposure: 500 };
        const context = { bookExposure: 500 }; // Already at limit

        const result = applyRiskCaps(stake, caps, context);

        assert.strictEqual(result, 0, 'Should return 0 when already at exposure limit');

        console.log('✓ Test 10: applyRiskCaps - returns 0 when at book exposure limit');
    }

    // Test 11: applyRiskCaps - maxDailyLoss blocks betting
    {
        const stake = 100;
        const caps = { maxDailyLoss: 500 };
        const context = { dailyPnL: -500 }; // Hit daily loss limit

        const result = applyRiskCaps(stake, caps, context);

        assert.strictEqual(result, 0, 'Should return 0 when daily loss limit reached');

        // Still betting allowed when below limit
        const result2 = applyRiskCaps(stake, caps, { dailyPnL: -400 });
        assert.strictEqual(result2, 100, 'Should allow betting when below daily loss limit');

        console.log('✓ Test 11: applyRiskCaps - maxDailyLoss blocks betting when limit reached');
    }

    // Test 12: applyRiskCaps - combines multiple caps
    {
        const stake = 300;
        const caps = {
            maxPerBet: 200,
            maxPerBookExposure: 500
        };
        const context = { bookExposure: 450 };

        const result = applyRiskCaps(stake, caps, context);

        // maxPerBet reduces 300 → 200
        // maxPerBookExposure reduces 200 → 50 (500 - 450)
        assert.strictEqual(result, 50, 'Should apply both caps, taking most restrictive');

        console.log('✓ Test 12: applyRiskCaps - combines multiple caps correctly');
    }

    console.log('\n=== All simRiskEngine tests passed ===\n');
