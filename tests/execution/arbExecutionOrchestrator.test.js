/**
 * tests/execution/arbExecutionOrchestrator.test.js
 * 
 * Unit tests for multi-leg arbitrage execution orchestrator.
 */

const assert = require('assert');
const { orchestrateArbExecution } = require('../../src/execution/arbExecutionOrchestrator');

console.log('=== Arb Execution Orchestrator Tests ===\\n');

/**
 * Test: All legs filled (happy path)
 */
{
    let callCount = 0;

    const arbPlan = {
        id: 'arb123',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const context = {
        config: {
            execution: {
                arbExecution: {
                    strategy: 'sequential_conservative',
                    maxLegsPerArb: 4
                }
            }
        },
        recentExecutions: [],
        executeSingleLegFn: async (leg) => {
            callCount++;
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

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.arbId, 'arb123');
        assert.strictEqual(result.strategy, 'sequential_conservative');
        assert.strictEqual(result.overallStatus, 'completed', 'All legs filled should result in completed status');
        assert.strictEqual(result.legs.length, 2);
        assert.strictEqual(result.legs[0].status, 'filled');
        assert.strictEqual(result.legs[1].status, 'filled');
        assert.strictEqual(callCount, 2, 'Should execute both legs');
        console.log('✓ All legs filled: overallStatus=completed');
    });
}

/**
 * Test: Second leg rejected (conservative stop)
 */
{
    let callCount = 0;

    const arbPlan = {
        id: 'arb456',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt2', marketType: 'spread', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt2', marketType: 'spread', side: 'away', price: +105, stake: 105 },
            { legId: 'leg3', book: 'betmgm', eventId: 'evt2', marketType: 'spread', side: 'home', price: -105, stake: 100 }
        ]
    };

    const context = {
        config: {},
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
            } else if (leg.legId === 'leg2') {
                return {
                    requestedStake: leg.stake,
                    filledStake: 0,
                    remainingStake: leg.stake,
                    status: 'rejected',
                    errorCode: 'LIMIT_REJECTED',
                    errorMessage: 'Bet limit exceeded'
                };
            }
            throw new Error('leg3 should not be executed');
        }
    };

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.overallStatus, 'partial', 'Conservative stop should result in partial status');
        assert.strictEqual(result.legs.length, 2, 'Only legs 1 and 2 should be present');
        assert.strictEqual(result.legs[0].status, 'filled');
        assert.strictEqual(result.legs[1].status, 'rejected');
        assert.strictEqual(result.legs[1].errorCode, 'LIMIT_REJECTED');
        assert.strictEqual(callCount, 2, 'leg3 should not be executed');
        assert.ok(result.notes.length > 0, 'Should have notes explaining stop');
        console.log('✓ Second leg rejected: conservative stop, leg3 not executed');
    });
}

/**
 * Test: Partial chain
 */
{
    const arbPlan = {
        id: 'arb789',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt3', marketType: 'total', side: 'over', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt3', marketType: 'total', side: 'under', price: -110, stake: 100 }
        ]
    };

    const context = {
        config: {},
        recentExecutions: [],
        executeSingleLegFn: async (leg) => {
            if (leg.legId === 'leg1') {
                return {
                    requestedStake: 100,
                    filledStake: 60,
                    remainingStake: 40,
                    status: 'partial_filled',
                    errorCode: null,
                    errorMessage: null
                };
            } else {
                return {
                    requestedStake: 100,
                    filledStake: 100,
                    remainingStake: 0,
                    status: 'filled',
                    errorCode: null,
                    errorMessage: null
                };
            }
        }
    };

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.overallStatus, 'partial', 'Partial fill should result in partial status');
        assert.strictEqual(result.legs[0].status, 'partial_filled');
        assert.strictEqual(result.legs[0].filledStake, 60);
        assert.strictEqual(result.legs[1].status, 'filled');
        console.log('✓ Partial chain: overallStatus=partial');
    });
}

/**
 * Test: First leg fails
 */
{
    let callCount = 0;

    const arbPlan = {
        id: 'arb999',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt4', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt4', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const context = {
        config: {},
        recentExecutions: [],
        executeSingleLegFn: async (leg) => {
            callCount++;
            return {
                requestedStake: leg.stake,
                filledStake: 0,
                remainingStake: leg.stake,
                status: 'error',
                errorCode: 'NETWORK_ERROR',
                errorMessage: 'Connection timeout'
            };
        }
    };

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.overallStatus, 'failed', 'First leg error with no position should be failed');
        assert.strictEqual(result.legs.length, 1, 'Only first leg should be executed');
        assert.strictEqual(result.legs[0].status, 'error');
        assert.strictEqual(callCount, 1, 'Should not execute second leg');
        console.log('✓ First leg fails: overallStatus=failed, no further execution');
    });
}

/**
 * Test: Max legs guardrail
 */
{
    let callCount = 0;

    const arbPlan = {
        id: 'arb_toolarge',
        legs: [
            { legId: 'leg1', book: 'dk', eventId: 'evt5', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fd', eventId: 'evt5', marketType: 'moneyline', side: 'away', price: +105, stake: 105 },
            { legId: 'leg3', book: 'mgm', eventId: 'evt5', marketType: 'moneyline', side: 'home', price: -105, stake: 100 },
            { legId: 'leg4', book: 'cz', eventId: 'evt5', marketType: 'moneyline', side: 'away', price: +110, stake: 110 },
            { legId: 'leg5', book: 'pb', eventId: 'evt5', marketType: 'moneyline', side: 'home', price: -115, stake: 100 }
        ]
    };

    const context = {
        config: {
            execution: {
                arbExecution: {
                    maxLegsPerArb: 4
                }
            }
        },
        recentExecutions: [],
        executeSingleLegFn: async () => {
            callCount++;
            throw new Error('Should not be called');
        }
    };

    orchestrateArbExecution(arbPlan, context).then(result => {
        assert.strictEqual(result.overallStatus, 'failed', 'Exceeding maxLegsPerArb should fail');
        assert.strictEqual(result.legs.length, 0, 'No legs should be executed');
        assert.ok(result.notes.some(note => note.includes('maxLegsPerArb')), 'Notes should explain rejection');
        assert.strictEqual(callCount, 0, 'executeSingleLegFn should not be called');
        console.log('✓ Max legs guardrail: rejected with 5 legs > 4 max');
    });
}

console.log('\\n=== All orchestrator tests passed ===\\n');
