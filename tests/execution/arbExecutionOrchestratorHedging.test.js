/**
 * tests/execution/arbExecutionOrchestratorHedging.test.js
 * 
 * Tests for hedging integration in arb execution orchestrator.
 */

const assert = require('assert');
const { orchestrateArbExecution } = require('../../src/execution/arbExecutionOrchestrator');

console.log('=== Arb Execution Orchestrator Hedging Integration Tests===\\n');

/**
 * Test: Hedging disabled (default behavior)
 */
{
    let callCount = 0;

    const arbPlan = {
        id: 'arb_nohedge',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const context = {
        config: {
            execution: {
                hedging: {
                    enabled: false  // Explicitly disabled
                }
            }
        },
        recentExecutions: [],
        executeSingleLegFn: async (leg) => {
            callCount++;
            if (leg.legId === 'leg1') {
                return {
                    requestedStake: leg.stake,
                    filledStake: leg.stake,
                    remainingStake: 0,
                    status: 'filled',
                    errorCode: null,
                    errorMessage: null
                };
            } else {
                return {
                    requestedStake: leg.stake,
                    filledStake: 0,
                    remainingStake: leg.stake,
                    status: 'rejected',
                    errorCode: 'LIMIT_REJECTED',
                    errorMessage: null
                };
            }
        }
    };

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.overallStatus, 'partial');
        assert.strictEqual(result.hedgingPlan, undefined, 'Should not include hedgingPlan when disabled');
        console.log('✓ Hedging disabled: no hedgingPlan in result');
    });
}

/**
 * Test: Hedging enabled with broken arb
 */
{
    const arbPlan = {
        id: 'arb_withhedge',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt2', marketType: 'spread', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt2', marketType: 'spread', side: 'away', price: +105, stake: 105 }
        ]
    };

    const context = {
        config: {
            execution: {
                hedging: {
                    enabled: true,
                    mode: 'flatten_exposure',
                    maxHedgeFraction: 1.0
                }
            }
        },
        recentExecutions: [],
        executeSingleLegFn: async (leg) => {
            if (leg.legId === 'leg1') {
                return {
                    requestedStake: leg.stake,
                    filledStake: leg.stake,
                    remainingStake: 0,
                    status: 'filled',
                    errorCode: null,
                    errorMessage: null
                };
            } else {
                return {
                    requestedStake: leg.stake,
                    filledStake: 0,
                    remainingStake: leg.stake,
                    status: 'rejected',
                    errorCode: 'LIMIT_REJECTED',
                    errorMessage: null
                };
            }
        }
    };

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.overallStatus, 'partial');
        assert.ok(result.hedgingPlan, 'Should include hedgingPlan when enabled');
        assert.ok(Array.isArray(result.hedgingPlan.hedges), 'hedgingPlan should have hedges array');
        assert.strictEqual(result.hedgingPlan.hedges.length, 1, 'Should have 1 hedge for filled leg');
        assert.strictEqual(result.hedgingPlan.hedges[0].sourceLegId, 'leg1');
        assert.strictEqual(result.hedgingPlan.hedges[0].side, 'away', 'Should hedge with opposite side');
        console.log('✓ Hedging enabled: hedgingPlan with 1 hedge generated');
    });
}

/**
 * Test: Hedging enabled but arb completed
 */
{
    const arbPlan = {
        id: 'arb_completed',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt3', marketType: 'total', side: 'over', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt3', marketType: 'total', side: 'under', price: -110, stake: 100 }
        ]
    };

    const context = {
        config: {
            execution: {
                hedging: {
                    enabled: true
                }
            }
        },
        recentExecutions: [],
        executeSingleLegFn: async () => {
            return {
                requestedStake: 100,
                filledStake: 100,
                remainingStake: 0,
                status: 'filled',
                errorCode: null,
                errorMessage: null
            };
        }
    };

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.overallStatus, 'completed');
        // No hedging plan for completed arb (or empty hedges)
        if (result.hedgingPlan) {
            assert.strictEqual(result.hedgingPlan.hedges.length, 0, 'Completed arb should have no hedges');
        }
        console.log('✓ Hedging enabled + completed arb: no hedges needed');
    });
}

/**
 * Test: Hedging with partial fill
 */
{
    const arbPlan = {
        id: 'arb_partial',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt4', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt4', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const context = {
        config: {
            execution: {
                hedging: {
                    enabled: true,
                    maxHedgeFraction: 0.5
                }
            }
        },
        recentExecutions: [],
        executeSingleLegFn: async (leg) => {
            if (leg.legId === 'leg1') {
                return {
                    requestedStake: 100,
                    filledStake: 80,  // Partial fill
                    remainingStake: 20,
                    status: 'partial_filled',
                    errorCode: null,
                    errorMessage: null
                };
            } else {
                return {
                    requestedStake: 105,
                    filledStake: 0,
                    remainingStake: 105,
                    status: 'error',
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: null
                };
            }
        }
    };

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.overallStatus, 'partial');
        assert.ok(result.hedgingPlan);
        assert.strictEqual(result.hedgingPlan.hedges.length, 1);
        assert.strictEqual(result.hedgingPlan.hedges[0].stake, 40, 'Hedge should use filledStake * maxHedgeFraction (80 * 0.5)');
        console.log('✓ Hedging with partial fill + maxHedgeFraction: stake = 40');
    });
}

console.log('\\n=== All orchestrator hedging integration tests passed ===\\n');
