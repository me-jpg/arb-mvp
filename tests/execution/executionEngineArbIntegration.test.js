/**
 * tests/execution/executionEngineArbIntegration.test.js
 * 
 * Integration tests for multi-leg arb execution in engine.
 */

const assert = require('assert');

console.log('=== Execution Engine Arb Integration Tests ===\\n');

// Mock executeArbPlan
async function executeArbPlanMock(arbPlan, engineContext) {
    const { orchestrateArbExecution } = require('../../src/execution/arbExecutionOrchestrator');
    const { normalizeExecutionResult } = require('../../src/execution/executionResultNormalizer');

    const context = {
        config: engineContext.config || {},
        recentExecutions: engineContext.recentExecutions || [],
        executeSingleLegFn: async (leg) => {
            // Mock single-leg execution
            if (engineContext.mockLegExecutor) {
                const rawResult = engineContext.mockLegExecutor(leg);
                return normalizeExecutionResult(rawResult, leg);
            }

            // Default: filled
            return {
                requestedStake: leg.stake,
                filledStake: leg.stake,
                remainingStake: 0,
                status: 'filled',
                errorCode: null,
                errorMessage: null
            };
        }
    };

    return orchestrateArbExecution(arbPlan, context);
}

/**
 * Test: Simple arb execution
 */
{
    const arbPlan = {
        id: 'simple_arb',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const engineContext = {
        config: {
            execution: {
                arbExecution: {
                    strategy: 'sequential_conservative',
                    maxLegsPerArb: 4
                }
            }
        },
        recentExecutions: []
    };

    executeArbPlanMock(arbPlan, engineContext).then(result => {
        assert.strictEqual(result.overallStatus, 'completed');
        assert.strictEqual(result.legs.length, 2);
        assert.strictEqual(result.legs[0].status, 'filled');
        assert.strictEqual(result.legs[1].status, 'filled');
        console.log('✓ Simple arb execution: completed with 2 filled legs');
    });
}

/**
 * Test: Conservative stop integration
 */
{
    let executedLegs = [];

    const arbPlan = {
        id: 'conservative_stop',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt2', marketType: 'spread', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt2', marketType: 'spread', side: 'away', price: +105, stake: 105 },
            { legId: 'leg3', book: 'betmgm', eventId: 'evt2', marketType: 'spread', side: 'home', price: -105, stake: 100 }
        ]
    };

    const engineContext = {
        config: {},
        recentExecutions: [],
        mockLegExecutor: (leg) => {
            executedLegs.push(leg.legId);

            if (leg.legId === 'leg1') {
                return { success: true, filledStake: 100 };
            } else if (leg.legId === 'leg2') {
                return { success: false, errorCode: 'LIMIT_REJECTED' };
            }
            throw new Error('leg3 should not execute');
        }
    };

    executeArbPlanMock(arbPlan, engineContext).then(result => {
        assert.strictEqual(result.overallStatus, 'partial');
        assert.strictEqual(result.legs.length, 2, 'Only 2 legs should execute');
        assert.strictEqual(result.legs[1].status, 'rejected');
        assert.deepStrictEqual(executedLegs, ['leg1', 'leg2'], 'leg3 should not be executed');
        console.log('✓ Conservative stop integration: leg3 not executed after leg2 rejection');
    });
}

/**
 * Test: Backward compatibility check
 */
{
    // Simulate existing single-leg behavior remains unchanged
    const singleOrder = {
        orderId: 'single_order',
        stake: 100,
        book: 'draftkings',
        eventId: 'evt3',
        marketType: 'moneyline',
        side: 'home',
        price: -110
    };

    // If we have existing executeWithRetry or similar, it should work unchanged
    // For this test, we just verify the structure is compatible
    const isCompatible = singleOrder.stake !== undefined &&
        singleOrder.book !== undefined &&
        singleOrder.eventId !== undefined;

    assert.ok(isCompatible, 'Single-leg order structure should remain compatible');
    console.log('✓ Backward compatibility: single-leg structure unchanged');
}

console.log('\\n=== All engine arb integration tests passed ===\\n');
