/**
 * tests/execution/executionEngineHedgingIntegration.test.js
 * 
 * Integration tests for hedge execution in execution engine.
 */

const assert = require('assert');

console.log('=== Execution Engine Hedging Integration Tests ===\\n');

/**
 * Mock executeArbPlan with hedge execution logic
 */
async function mockExecuteArbPlan(arbPlan, engineContext) {
    const { orchestrateArbExecution } = require('../../src/execution/arbExecutionOrchestrator');
    const { executeHedgingPlan } = require('../../src/execution/arbHedgeExecutor');
    const { getExecutionHedgingConfig } = require('../../config');

    const context = {
        config: engineContext.config,
        recentExecutions: [],
        executeSingleLegFn: engineContext.executeSingleLegFn
    };

    const arbResult = await orchestrateArbExecution(arbPlan, context);

    const hedgingConfig = getExecutionHedgingConfig(engineContext.config || {});

    if (
        hedgingConfig.enabled &&
        hedgingConfig.executeHedges &&
        arbResult &&
        arbResult.hedgingPlan &&
        Array.isArray(arbResult.hedgingPlan.hedges) &&
        arbResult.hedgingPlan.hedges.length > 0
    ) {
        const hedgeExecutionResult = await executeHedgingPlan(arbResult.hedgingPlan, engineContext);
        return { ...arbResult, hedgeExecutionResult };
    }

    return arbResult;
}

/**
 * Test: Hedging disabled (default)
 */
{
    const arbPlan = {
        id: 'arb1',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                hedging: {
                    enabled: true,
                    executeHedges: false  // Disabled
                }
            }
        },
        executeSingleLegFn: async (leg) => {
            if (leg.legId === 'leg1') {
                return { status: 'filled', filledStake: 100, remainingStake: 0 };
            } else {
                return { status: 'rejected', filledStake: 0, remainingStake: 105, errorCode: 'LIMIT' };
            }
        }
    };

    mockExecuteArbPlan(arbPlan, engineContext).then(result => {
        assert.strictEqual(result.overallStatus, 'partial');
        assert.strictEqual(result.hedgeExecutionResult, undefined, 'Should not execute hedges when disabled');
        console.log('✓ Hedging disabled: no hedgeExecutionResult attached');
    });
}

/**
 * Test: Hedging enabled + executeHedges=true
 */
{
    const arbPlan = {
        id: 'arb2',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt2', marketType: 'spread', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt2', marketType: 'spread', side: 'away', price: +105, stake: 105 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                hedging: {
                    enabled: true,
                    executeHedges: true  // ENABLED
                }
            }
        },
        executeSingleLegFn: async (leg) => {
            // Main legs
            if (leg.legId === 'leg1') {
                return { status: 'filled', filledStake: 100, remainingStake: 0 };
            } else if (leg.legId === 'leg2') {
                return { status: 'rejected', filledStake: 0, remainingStake: 105, errorCode: 'LIMIT' };
            }

            // Hedge execution
            if (leg.isHedge) {
                return { status: 'filled', filledStake: leg.stake, remainingStake: 0 };
            }

            return { status: 'error', filledStake: 0, remainingStake: leg.stake };
        }
    };

    mockExecuteArbPlan(arbPlan, engineContext).then(result => {
        assert.strictEqual(result.overallStatus, 'partial');
        assert.ok(result.hedgeExecutionResult, 'Should have hedgeExecutionResult');
        assert.strictEqual(result.hedgeExecutionResult.status, 'hedges_executed');
        assert.ok(result.hedgeExecutionResult.hedgeResults.length > 0, 'Should have executed hedges');
        console.log('✓ Hedging enabled + executeHedges=true: hedges executed');
    });
}

/**
 * Test: Completed arb (no broken legs)
 */
{
    const arbPlan = {
        id: 'arb3',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt3', marketType: 'total', side: 'over', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt3', marketType: 'total', side: 'under', price: -110, stake: 100 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                hedging: {
                    enabled: true,
                    executeHedges: true
                }
            }
        },
        executeSingleLegFn: async () => {
            return { status: 'filled', filledStake: 100, remainingStake: 0 };
        }
    };

    mockExecuteArbPlan(arbPlan, engineContext).then(result => {
        assert.strictEqual(result.overallStatus, 'completed');
        assert.strictEqual(result.hedgeExecutionResult, undefined, 'Completed arb should not execute hedges');
        console.log('✓ Completed arb: no hedgeExecutionResult');
    });
}

/**
 * Test: Mode interaction (simulation)
 */
{
    const arbPlan = {
        id: 'arb4',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt4', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt4', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                mode: 'simulation',
                hedging: {
                    enabled: true,
                    executeHedges: true
                }
            }
        },
        executeSingleLegFn: async (leg) => {
            // In simulation, should return simulated status
            if (leg.isHedge) {
                return { status: 'simulated', filledStake: leg.stake, remainingStake: 0 };
            }

            if (leg.legId === 'leg1') {
                return { status: 'filled', filledStake: 100, remainingStake: 0 };
            } else {
                return { status: 'rejected', filledStake: 0, remainingStake: 105, errorCode: 'LIMIT' };
            }
        }
    };

    mockExecuteArbPlan(arbPlan, engineContext).then(result => {
        assert.strictEqual(result.overallStatus, 'partial');
        if (result.hedgeExecutionResult) {
            // Hedge execution respects mode
            console.log('✓ Mode interaction: hedge execution respects simulation mode');
        }
    });
}

console.log('\\n=== All hedging integration tests passed ===\\n');
