/**
 * tests/execution/executionConfigValidator.test.js
 * 
 * Unit tests for execution config validator.
 */

const assert = require('assert');
const { validateExecutionConfig } = require('../../src/execution/executionConfigValidator');

console.log('=== Execution Config Validator Tests ===\\n');

/**
 * Test: Valid live_guarded profile
 */
{
    const config = {
        execution: {
            mode: 'live',
            profileName: 'live_guarded',
            idempotency: { enabled: true },
            risk: {
                caps: { maxPerBookExposure: 5000, maxDailyLoss: 2000 }
            },
            hedging: { enabled: true, executeHedges: true },
            latencyGuard: { enabled: true },
            healthAdvisory: { enforcementMode: 'halt' },
            safety: {
                requireIdempotencyEnabled: true,
                requireRiskCapsEnabled: true
            }
        }
    };

    const result = validateExecutionConfig(config);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.profileName, 'live_guarded');
    assert.strictEqual(result.mode, 'live');
    console.log('✓ Valid live_guarded: ok=true, no errors');
}

/**
 * Test: Missing risk caps in live mode
 */
{
    const config = {
        execution: {
            mode: 'live',
            idempotency: { enabled: true },
            risk: { caps: {} },
            safety: { requireRiskCapsEnabled: true }
        }
    };

    const result = validateExecutionConfig(config);

    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.includes('risk caps')));
    console.log('✓ Missing risk caps in live: ok=false, errors present');
}

/**
 * Test: Idempotency disabled in live mode
 */
{
    const config = {
        execution: {
            mode: 'live',
            idempotency: { enabled: false },
            safety: { requireIdempotencyEnabled: true }
        }
    };

    const result = validateExecutionConfig(config);

    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.includes('idempotency')));
    console.log('✓ Idempotency disabled in live: ok=false');
}

/**
 * Test: sim_safe profile (no live requirements)
 */
{
    const config = {
        execution: {
            mode: 'simulation',
            profileName: 'sim_safe',
            idempotency: { enabled: true },
            hedging: { enabled: true, executeHedges: false },
            latencyGuard: { enabled: true }
        }
    };

    const result = validateExecutionConfig(config);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.mode, 'simulation');
    console.log('✓ sim_safe profile: ok=true, no live requirements');
}

/**
 * Test: Backward compatibility - base config
 */
{
    const config = {
        execution: {
            mode: 'simulation',
            idempotency: { enabled: true },
            risk: { caps: { maxPerBookExposure: 1000 } }
        }
    };

    const result = validateExecutionConfig(config);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.profileName, null);
    console.log('✓ Backward compatibility: base config validates');
}

/**
 * Test: live_guarded misconfigured (mode mismatch)
 */
{
    const config = {
        execution: {
            mode: 'simulation',
            profileName: 'live_guarded'
        }
    };

    const result = validateExecutionConfig(config);

    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.includes('live_guarded') && e.includes('mode')));
    console.log('✓ live_guarded misconfigured: ok=false, mode error');
}

console.log('\\n=== All config validator tests passed ===\\n');
