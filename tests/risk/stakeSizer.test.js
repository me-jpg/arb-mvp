/**
 * tests/risk/stakeSizer.test.js
 */

const assert = require('assert');
const { sizeStakeForSignal } = require('../../src/risk/stakeSizer');

console.log('=== stakeSizer.test.js ===\n');

// Test 1: flat mode - basic
{
    const signal = { edgeEstimate: 0.03 };
    const context = {
        bankrollConfig: { currentBankroll: 10000 },
        stakeSizingConfig: { mode: 'flat', flatStake: 50 }
    };

    const result = sizeStakeForSignal(signal, context);

    assert.strictEqual(result.stake, 50, 'Flat mode should return flatStake');
    assert.strictEqual(result.modeUsed, 'flat', 'Should use flat mode');
    assert.ok(result.reasons.length > 0, 'Should have reasons');

    console.log('✓ Test 1: flat mode - basic');
}

// Test 2: flat mode - respects max bankroll pct
{
    const signal = { edgeEstimate: 0.03 };
    const context = {
        bankrollConfig: { currentBankroll: 1000 }, // Small bankroll
        stakeSizingConfig: {
            mode: 'flat',
            flatStake: 500, // Would be 50% of bankroll
            maxStakePctBankroll: 0.02 // Max 2%
        }
    };

    const result = sizeStakeForSignal(signal, context);

    assert.ok(result.stake <= 20, 'Should cap at 2% of bankroll (20)');
    assert.ok(result.reasons.some(r => r.includes('Capped')), 'Should mention capping');

    console.log('✓ Test 2: flat mode - respects max bankroll pct');
}

// Test 3: edge_linear mode - higher edge increases stake
{
    const signal1 = { edgeEstimate: 0.02 };
    const signal2 = { edgeEstimate: 0.05 };
    const context = {
        bankrollConfig: { currentBankroll: 10000 },
        stakeSizingConfig: { mode: 'edge_linear', flatStake: 50 }
    };

    const result1 = sizeStakeForSignal(signal1, context);
    const result2 = sizeStakeForSignal(signal2, context);

    assert.strictEqual(result1.modeUsed, 'edge_linear', 'Should use edge_linear');
    assert.strictEqual(result2.modeUsed, 'edge_linear', 'Should use edge_linear');
    assert.ok(result2.stake > result1.stake, 'Higher edge should give higher stake');

    console.log('✓ Test 3: edge_linear mode - higher edge increases stake');
}

// Test 4: edge_linear mode - negative edge clamped
{
    const signal = { edgeEstimate: -0.05 };
    const context = {
        bankrollConfig: { currentBankroll: 10000 },
        stakeSizingConfig: { mode: 'edge_linear', flatStake: 50 }
    };

    const result = sizeStakeForSignal(signal, context);

    assert.ok(result.stake >= 0, 'Negative edge should not give negative stake');
    assert.ok(result.stake < 50, 'Negative edge should reduce stake below flat');

    console.log('✓ Test 4: edge_linear mode - negative edge clamped');
}

// Test 5: kelly_fraction mode - respects bankroll
{
    const signal = { edgeEstimate: 0.04 }; // 4% edge
    const context = {
        bankrollConfig: { currentBankroll: 10000 },
        stakeSizingConfig: {
            mode: 'kelly_fraction',
            flatStake: 50,
            kellyBaseFraction: 0.5, // Half Kelly
            maxStakePctBankroll: 0.02
        }
    };

    const result = sizeStakeForSignal(signal, context);

    assert.strictEqual(result.modeUsed, 'kelly_fraction', 'Should use kelly_fraction');
    // Half Kelly of 4% edge = 2% of bankroll = 200
    // But capped at 2% = 200, so should be ~200
    assert.ok(result.stake <= 200, 'Should respect max bankroll pct');
    assert.ok(result.stake > 0, 'Should be positive');

    console.log('✓ Test 5: kelly_fraction mode - respects bankroll');
}

// Test 6: kelly_fraction mode - ML score influence
{
    const signal1 = { edgeEstimate: 0.03, mlScore: 0.03 }; // ML agrees
    const signal2 = { edgeEstimate: 0.03, mlScore: 0.05 }; // ML is more optimistic
    const context = {
        bankrollConfig: { currentBankroll: 10000 },
        stakeSizingConfig: {
            mode: 'kelly_fraction',
            kellyBaseFraction: 0.5,
            flatStake: 50
        }
    };

    const result1 = sizeStakeForSignal(signal1, context);
    const result2 = sizeStakeForSignal(signal2, context);

    // Higher ML score should give slightly higher stake
    assert.ok(result2.stake >= result1.stake, 'Higher ML score should increase stake');
    assert.ok(result2.reasons.some(r => r.includes('ML')), 'Should mention ML adjustment');

    console.log('✓ Test 6: kelly_fraction mode - ML score influence');
}

// Test 7: minStake enforcement
{
    const signal = { edgeEstimate: 0.001 }; // Very small edge
    const context = {
        bankrollConfig: { currentBankroll: 10000 },
        stakeSizingConfig: {
            mode: 'edge_linear',
            flatStake: 50,
            minStake: 10
        }
    };

    const result = sizeStakeForSignal(signal, context);

    assert.ok(result.stake >= 10, 'Should enforce minStake');

    console.log('✓ Test 7: minStake enforcement');
}

// Test 8: error fallback
{
    const signal = { edgeEstimate: null }; // Invalid edge
    const context = {
        bankrollConfig: { currentBankroll: 10000 },
        stakeSizingConfig: { mode: 'flat', flatStake: 50 }
    };

    const result = sizeStakeForSignal(signal, context);

    assert.ok(result.stake === 50, 'Should fallback gracefully');
    assert.ok(result.modeUsed === 'flat', 'Should use flat on error');

    console.log('✓ Test 8: error fallback');
}

console.log('\n=== All stake sizer tests passed ===\n');
