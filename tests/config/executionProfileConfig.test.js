/**
 * tests/config/executionProfileConfig.test.js
 * 
 * Unit tests for execution profile config merge.
 */

const assert = require('assert');
const { getExecutionProfileConfig, DEFAULT_EXECUTION_PROFILES } = require('../../config');

console.log('=== Execution Profile Config Tests ===\\n');

/**
 * Test: Unknown profile returns baseConfig unchanged
 */
{
    const baseConfig = {
        execution: {
            mode: 'paper',
            defaultStake: 100
        }
    };

    const result = getExecutionProfileConfig(baseConfig, 'unknown_profile');

    assert.deepStrictEqual(result, baseConfig);
    console.log('✓ Unknown profile: returns baseConfig unchanged');
}

/**
 * Test: dev profile merge
 */
{
    const baseConfig = {
        execution: {
            defaultStake: 50,
            risk: { caps: { maxPerBookExposure: 1000 } }
        }
    };

    const result = getExecutionProfileConfig(baseConfig, 'dev');

    assert.strictEqual(result.execution.mode, 'simulation');
    assert.strictEqual(result.execution.hedging.enabled, false);
    assert.strictEqual(result.execution.defaultStake, 50); // preserved
    console.log('✓ dev profile: merged correctly, preserves base fields');
}

/**
 * Test: sim_safe profile
 */
{
    const baseConfig = {};
    const result = getExecutionProfileConfig(baseConfig, 'sim_safe');

    assert.strictEqual(result.execution.mode, 'simulation');
    assert.strictEqual(result.execution.hedging.enabled, true);
    assert.strictEqual(result.execution.latencyGuard.enabled, true);
    console.log('✓ sim_safe profile: applied correctly');
}

/**
 * Test: live_guarded profile
 */
{
    const baseConfig = {};
    const result = getExecutionProfileConfig(baseConfig, 'live_guarded');

    assert.strictEqual(result.execution.mode, 'live');
    assert.strictEqual(result.execution.hedging.executeHedges, true);
    assert.strictEqual(result.execution.latencyGuard.enabled, true);
    assert.strictEqual(result.execution.safety.requireIdempotencyEnabled, true);
    console.log('✓ live_guarded profile: strict safety settings');
}

/**
 * Test: Idempotent behavior (no mutation)
 */
{
    const baseConfig = {
        execution: { mode: 'simulation' }
    };

    const result1 = getExecutionProfileConfig(baseConfig, 'dev');
    const result2 = getExecutionProfileConfig(baseConfig, 'dev');

    assert.deepStrictEqual(result1.execution.mode, result2.execution.mode);
    assert.deepStrictEqual(baseConfig, { execution: { mode: 'simulation' } }); // unchanged
    console.log('✓ Idempotent: no mutation of baseConfig');
}

console.log('\\n=== All profile config tests passed ===\\n');
