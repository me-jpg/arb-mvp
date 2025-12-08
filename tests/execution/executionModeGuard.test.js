/**
 * tests/execution/executionModeGuard.test.js
 * 
 * Tests for execution mode guard (mode resolution and safety validation).
 */

const assert = require('assert');
const { resolveExecutionMode, validateLiveSafety } = require('../../src/execution/executionModeGuard');

console.log('=== Execution Mode Guard Tests ===\\n');

/**
 * Test: resolveExecutionMode - default config
 */
{
    const config = {};
    const mode = resolveExecutionMode(config);
    assert.strictEqual(mode, 'simulation', 'Default mode should be simulation');
    console.log('✓ resolveExecutionMode: default → simulation');
}

/**
 * Test: resolveExecutionMode - explicit modes
 */
{
    const configSim = { execution: { mode: 'simulation' } };
    assert.strictEqual(resolveExecutionMode(configSim), 'simulation');

    const configPaper = { execution: { mode: 'paper' } };
    assert.strictEqual(resolveExecutionMode(configPaper), 'paper');

    const configLive = { execution: { mode: 'live' } };
    assert.strictEqual(resolveExecutionMode(configLive), 'live');

    console.log('✓ resolveExecutionMode: explicit modes returned correctly');
}

/**
 * Test: resolveExecutionMode - unknown mode
 */
{
    const config = { execution: { mode: 'production' } };  // unknown mode
    const mode = resolveExecutionMode(config);
    assert.strictEqual(mode, 'simulation', 'Unknown mode should default to simulation for safety');
    console.log('✓ resolveExecutionMode: unknown → simulation (safety)');
}

/**
 * Test: validateLiveSafety - non-live modes always ok
 */
{
    const simConfig = { execution: { mode: 'simulation' } };
    const paperConfig = { execution: { mode: 'paper' } };

    const simResult = validateLiveSafety(simConfig, {}, {}, {});
    assert.strictEqual(simResult.ok, true, 'Simulation mode should always pass');
    assert.strictEqual(simResult.reasons.length, 0);

    const paperResult = validateLiveSafety(paperConfig, {}, {}, {});
    assert.strictEqual(paperResult.ok, true, 'Paper mode should always pass');
    assert.strictEqual(paperResult.reasons.length, 0);

    console.log('✓ validateLiveSafety: non-live modes → always ok');
}

/**
 * Test: validateLiveSafety - live mode with all requirements satisfied
 */
{
    const config = {
        execution: {
            mode: 'live',
            safety: {
                requireHealthAdvisoryIgnoreOrLog: true,
                requireIdempotencyEnabled: true,
                requireRiskCapsEnabled: true
            }
        }
    };

    const healthConfig = { enforcementMode: 'halt' };
    const riskConfig = { maxPerBookExposure: 1000, maxDailyLoss: 500 };
    const idempotencyConfig = { enabled: true };

    const result = validateLiveSafety(config, healthConfig, riskConfig, idempotencyConfig);

    assert.strictEqual(result.ok, true, 'Live mode with all requirements should pass');
    assert.strictEqual(result.reasons.length, 0);
    console.log('✓ validateLiveSafety: live + all requirements → ok');
}

/**
 * Test: validateLiveSafety - live with idempotency disabled
 */
{
    const config = { execution: { mode: 'live' } };
    const healthConfig = { enforcementMode: 'halt' };
    const riskConfig = { maxPerBookExposure: 1000, maxDailyLoss: 500 };
    const idempotencyConfig = { enabled: false };  // DISABLED

    const result = validateLiveSafety(config, healthConfig, riskConfig, idempotencyConfig);

    assert.strictEqual(result.ok, false, 'Should not pass with idempotency disabled');
    assert.ok(result.reasons.some(r => r.includes('Idempotency')), 'Should include idempotency reason');
    console.log('✓ validateLiveSafety: live + idempotency disabled → not ok');
}

/**
 * Test: validateLiveSafety - live with missing risk caps
 */
{
    const config = { execution: { mode: 'live' } };
    const healthConfig = { enforcementMode: 'halt' };
    const riskConfig = {};  // Missing caps
    const idempotencyConfig = { enabled: true };

    const result = validateLiveSafety(config, healthConfig, riskConfig, idempotencyConfig);

    assert.strictEqual(result.ok, false, 'Should not pass without risk caps');
    assert.ok(result.reasons.some(r => r.includes('Risk caps')), 'Should include risk caps reason');
    console.log('✓ validateLiveSafety: live + missing risk caps → not ok');
}

/**
 * Test: validateLiveSafety - multiple violations
 */
{
    const config = { execution: { mode: 'live' } };
    const healthConfig = { enforcementMode: 'halt' };
    const riskConfig = {};  // Missing caps
    const idempotencyConfig = { enabled: false };  // Disabled

    const result = validateLiveSafety(config, healthConfig, riskConfig, idempotencyConfig);

    assert.strictEqual(result.ok, false);
    assert.ok(result.reasons.length >= 2, 'Should have multiple violation reasons');
    console.log('✓ validateLiveSafety: multiple violations reported');
}

console.log('\\n=== All mode guard tests passed ===\\n');
