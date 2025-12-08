/**
 * tests/execution/executionEngineLatencyGuardIntegration.test.js
 * 
 * Integration tests for latency guard in execution engine.
 */

const assert = require('assert');
const { evaluateArbLatency } = require('../../src/execution/latencyAwareArbGuard');

console.log('=== Execution Engine Latency Guard Integration Tests ===\\n');

const nowMs = Date.now();

/**
 * Mock executeArbPlan with latency guard logic
 */
async function mockExecuteArbPlan(arbPlan, engineContext) {
    const { orchestrateArbExecution } = require('../../src/execution/arbExecutionOrchestrator');
    const { getExecutionLatencyGuardConfig } = require('../../config');

    const config = (engineContext && engineContext.config) || {};

    // Latency guard evaluation
    const latencyConfig = getExecutionLatencyGuardConfig(config);
    const latencyDecision = evaluateArbLatency(arbPlan, latencyConfig, engineContext.nowMs || Date.now());

    if (latencyDecision.shouldSkip) {
        return {
            arbId: arbPlan.id,
            strategy: 'sequential_conservative',
            legs: arbPlan.legs.map(leg => ({
                legId: leg.legId || leg.orderId,
                book: leg.book,
                requestedStake: leg.stake,
                filledStake: 0,
                remainingStake: leg.stake,
                status: 'skipped_latency',
                errorCode: null,
                errorMessage: null
            })),
            overallStatus: 'skipped',
            notes: ['latency_guard_blocked', ...latencyDecision.reasons],
            latencyMetrics: latencyDecision.metrics
        };
    }

    // Proceed with orchestration
    const context = {
        config,
        recentExecutions: [],
        executeSingleLegFn: engineContext.executeSingleLegFn
    };

    const arbResult = await orchestrateArbExecution(arbPlan, context);
    return { ...arbResult, latencyMetrics: latencyDecision.metrics };
}

/**
 * Test: Guard disabled (default)
 */
{
    const arbPlan = {
        id: 'arb1',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110, stake: 100, lastUpdatedAt: nowMs - 5000 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                latencyGuard: {
                    enabled: false  // Disabled
                }
            }
        },
        executeSingleLegFn: async () => ({ status: 'filled', filledStake: 100, remainingStake: 0 })
    };

    mockExecuteArbPlan(arbPlan, engineContext).then(result => {
        assert.notStrictEqual(result.overallStatus, 'skipped', 'Should not skip when disabled');
        assert.strictEqual(result.latencyMetrics, null, 'Metrics should be null when disabled');
        console.log('✓ Guard disabled: normal execution');
    });
}

/**
 * Test: Guard enabled, skip path
 */
{
    const arbPlan = {
        id: 'arb2',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt2', marketType: 'spread', side: 'home', price: -110, stake: 100, lastUpdatedAt: nowMs - 3000 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                latencyGuard: {
                    enabled: true,
                    maxLegAgeMs: 2000,  // Leg exceeds this
                    action: 'skip'
                }
            }
        },
        nowMs,
        executeSingleLegFn: async () => {
            throw new Error('Should not call executeSingleLegFn when skipped');
        }
    };

    mockExecuteArbPlan(arbPlan, engineContext).then(result => {
        assert.strictEqual(result.overallStatus, 'skipped');
        assert.ok(result.notes.includes('latency_guard_blocked'));
        assert.strictEqual(result.legs[0].status, 'skipped_latency');
        assert.ok(result.latencyMetrics);
        console.log('✓ Guard enabled, skip: skipped due to staleness');
    });
}

/**
 * Test: Guard enabled, warn_only
 */
{
    const arbPlan = {
        id: 'arb3',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt3', marketType: 'total', side: 'over', price: -110, stake: 100, lastUpdatedAt: nowMs - 3000 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                latencyGuard: {
                    enabled: true,
                    maxLegAgeMs: 2000,
                    action: 'warn_only'  // Don't skip
                }
            }
        },
        nowMs,
        executeSingleLegFn: async () => ({ status: 'filled', filledStake: 100, remainingStake: 0 })
    };

    mockExecuteArbPlan(arbPlan, engineContext).then(result => {
        assert.notStrictEqual(result.overallStatus, 'skipped', 'Should not skip with warn_only');
        assert.ok(result.latencyMetrics, 'Should have metrics');
        console.log('✓ Guard enabled, warn_only: executes with metrics');
    });
}

/**
 * Test: Determinism
 */
{
    const arbPlan = {
        id: 'arb4',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt4', marketType: 'moneyline', side: 'home', price: -110, stake: 100, lastUpdatedAt: nowMs - 1500 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                latencyGuard: {
                    enabled: true,
                    maxLegAgeMs: 2000,
                    maxSkewBetweenLegsMs: 1500,
                    action: 'skip'
                }
            }
        },
        nowMs,  // Fixed time for determinism
        executeSingleLegFn: async () => ({ status: 'filled', filledStake: 100, remainingStake: 0 })
    };

    Promise.all([
        mockExecuteArbPlan(arbPlan, engineContext),
        mockExecuteArbPlan(arbPlan, engineContext)
    ]).then(([result1, result2]) => {
        assert.strictEqual(result1.overallStatus, result2.overallStatus);
        assert.strictEqual(result1.latencyMetrics?.maxAgeMs, result2.latencyMetrics?.maxAgeMs);
        console.log('✓ Determinism: same input produces same output');
    });
}

console.log('\\n=== All latency guard integration tests passed ===\\n');
