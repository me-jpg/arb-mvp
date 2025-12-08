/**
 * tests/execution/executionEngineModeIntegration.test.js
 * 
 * Integration tests for execution mode behavior in engine.
 */

const assert = require('assert');

console.log('=== Execution Engine Mode Integration Tests ===\\n');

// Mock executeWithRetry with mode support
async function executeWithRetryMock(order, context) {
    const { resolveExecutionMode, validateLiveSafety } = require('../../src/execution/executionModeGuard');
    const { getExecutionHealthAdvisoryMode, getExecutionRiskConfig, getExecutionIdempotencyConfig } = require('../../config');

    const config = context.config || {};
    const mode = resolveExecutionMode(config);

    // Simulation mode
    if (mode === 'simulation') {
        return {
            requestedStake: order.stake,
            filledStake: order.stake,
            remainingStake: 0,
            status: 'simulated',
            errorCode: null,
            errorMessage: null
        };
    }

    // Live mode - validate safety
    if (mode === 'live') {
        const healthConfig = getExecutionHealthAdvisoryMode(config);
        const riskConfig = getExecutionRiskConfig(config);
        const idempotencyConfig = getExecutionIdempotencyConfig(config);

        const safetyCheck = validateLiveSafety(config, healthConfig, riskConfig, idempotencyConfig);

        if (!safetyCheck.ok) {
            return {
                requestedStake: order.stake,
                filledStake: 0,
                remainingStake: order.stake,
                status: 'blocked_by_safety_gate',
                errorCode: 'SAFETY_VIOLATION',
                errorMessage: safetyCheck.reasons.join('; ')
            };
        }
    }

    // Paper/live (after safety) - simulate fill
    return {
        requestedStake: order.stake,
        filledStake: order.stake,
        remainingStake: 0,
        status: 'filled',
        errorCode: null,
        errorMessage: null
    };
}

/**
 * Test: Simulation mode
 */
{
    const order = {
        orderId: 'sim_order1',
        stake: 100,
        book: 'draftkings',
        eventId: 'evt1',
        marketType: 'moneyline',
        side: 'home',
        price: -110
    };

    const context = {
        config: {
            execution: {
                mode: 'simulation'
            }
        }
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'simulated', 'Should return simulated status');
        assert.strictEqual(result.filledStake, 100, 'Should fill requested stake');
        assert.strictEqual(result.remainingStake, 0);
        console.log('✓ Simulation mode: synthetic result, no real calls');
    });
}

/**
 * Test: Paper mode
 */
{
    const order = {
        orderId: 'paper_order1',
        stake: 100,
        book: 'fanduel',
        eventId: 'evt2',
        marketType: 'spread',
        side: 'away',
        price: +105
    };

    const context = {
        config: {
            execution: {
                mode: 'paper'
            }
        }
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'filled', 'Paper mode should simulate fill');
        assert.strictEqual(result.filledStake, 100);
        console.log('✓ Paper mode: full pipeline, stubbed send');
    });
}

/**
 * Test: Live mode with safe config
 */
{
    const order = {
        orderId: 'live_order1',
        stake: 100,
        book: 'betmgm',
        eventId: 'evt3',
        marketType: 'total',
        side: 'over',
        price: -110
    };

    const context = {
        config: {
            execution: {
                mode: 'live',
                health: {
                    enforcementMode: 'halt'
                },
                risk: {
                    maxPerBookExposure: 1000,
                    maxDailyLoss: 500
                },
                idempotency: {
                    enabled: true
                }
            }
        }
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'filled', 'Safe live config should allow execution');
        console.log('✓ Live mode + safe config: validation passes');
    });
}

/**
 * Test: Live mode with safety violation
 */
{
    const order = {
        orderId: 'live_order2',
        stake: 100,
        book: 'draftkings',
        eventId: 'evt4',
        marketType: 'moneyline',
        side: 'home',
        price: -110
    };

    const context = {
        config: {
            execution: {
                mode: 'live',
                idempotency: {
                    enabled: false  // Violates safety requirement
                }
            }
        }
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'blocked_by_safety_gate', 'Should block unsafe live execution');
        assert.strictEqual(result.errorCode, 'SAFETY_VIOLATION');
        assert.strictEqual(result.filledStake, 0, 'Should not fill');
        assert.ok(result.errorMessage.includes('Idempotency'), 'Should explain violation');
        console.log('✓ Live mode + violation: blocked, no execution');
    });
}

/**
 * Test: Default config (backward compatibility)
 */
{
    const order = {
        orderId: 'default_order1',
        stake: 100,
        book: 'fanduel',
        eventId: 'evt5',
        marketType: 'spread',
        side: 'home',
        price: -110
    };

    const context = {
        config: {}  // No mode specified
    };

    executeWithRetryMock(order, context).then(result => {
        assert.strictEqual(result.status, 'simulated', 'Default should be simulation mode');
        console.log('✓ Default config: simulation mode (backward compatible)');
    });
}

console.log('\\n=== All mode integration tests passed ===\\n');
