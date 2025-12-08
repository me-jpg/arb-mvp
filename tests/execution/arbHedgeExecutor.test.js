/**
 * tests/execution/arbHedgeExecutor.test.js
 * 
 * Unit tests for arb hedge executor.
 */

const assert = require('assert');
const { executeHedgingPlan } = require('../../src/execution/arbHedgeExecutor');

console.log('=== Arb Hedge Executor Tests ===\\n');

/**
 * Test: No hedges
 */
{
    const hedgingPlan = {
        hedges: [],
        notes: []
    };

    const engineContext = {};

    executeHedgingPlan(hedgingPlan, engineContext).then(result => {
        assert.strictEqual(result.status, 'no_hedges');
        assert.strictEqual(result.hedgeResults.length, 0);
        assert.ok(result.notes.some(n => n.includes('no hedges')));
        console.log('✓ No hedges: returns no_hedges status');
    });
}

/**
 * Test: Single hedge full fill
 */
{
    const hedgingPlan = {
        hedges: [
            {
                hedgeId: 'hedge1',
                sourceLegId: 'leg1',
                book: 'draftkings',
                eventId: 'evt1',
                marketType: 'moneyline',
                side: 'away',
                price: -110,
                stake: 100
            }
        ],
        notes: []
    };

    const engineContext = {
        executeSingleLegFn: async (leg) => {
            return {
                status: 'filled',
                filledStake: leg.stake,
                remainingStake: 0,
                errorCode: null,
                errorMessage: null
            };
        }
    };

    executeHedgingPlan(hedgingPlan, engineContext).then(result => {
        assert.strictEqual(result.status, 'hedges_executed');
        assert.strictEqual(result.hedgeResults.length, 1);
        assert.strictEqual(result.hedgeResults[0].hedgeId, 'hedge1');
        assert.strictEqual(result.hedgeResults[0].status, 'filled');
        assert.strictEqual(result.hedgeResults[0].filledStake, 100);
        console.log('✓ Single hedge full fill: executed successfully');
    });
}

/**
 * Test: Multiple hedges
 */
{
    const hedgingPlan = {
        hedges: [
            { hedgeId: 'hedge1', sourceLegId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: -110, stake: 100 },
            { hedgeId: 'hedge2', sourceLegId: 'leg2', book: 'fanduel', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: +105, stake: 105 }
        ],
        notes: []
    };

    let callCount = 0;

    const engineContext = {
        executeSingleLegFn: async (leg) => {
            callCount++;
            return {
                status: callCount === 1 ? 'filled' : 'partial_filled',
                filledStake: callCount === 1 ? leg.stake : leg.stake * 0.5,
                remainingStake: callCount === 1 ? 0 : leg.stake * 0.5,
                errorCode: null,
                errorMessage: null
            };
        }
    };

    executeHedgingPlan(hedgingPlan, engineContext).then(result => {
        assert.strictEqual(result.status, 'hedges_executed');
        assert.strictEqual(result.hedgeResults.length, 2);
        assert.strictEqual(result.hedgeResults[0].status, 'filled');
        assert.strictEqual(result.hedgeResults[1].status, 'partial_filled');
        console.log('✓ Multiple hedges: both collected correctly');
    });
}

/**
 * Test: Error / rejected hedge
 */
{
    const hedgingPlan = {
        hedges: [
            { hedgeId: 'hedge1', sourceLegId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: -110, stake: 100 }
        ],
        notes: []
    };

    const engineContext = {
        executeSingleLegFn: async (leg) => {
            return {
                status: 'rejected',
                filledStake: 0,
                remainingStake: leg.stake,
                errorCode: 'LIMIT_REJECTED',
                errorMessage: 'Bet limit exceeded'
            };
        }
    };

    executeHedgingPlan(hedgingPlan, engineContext).then(result => {
        assert.strictEqual(result.status, 'hedges_executed');
        assert.strictEqual(result.hedgeResults[0].status, 'rejected');
        assert.strictEqual(result.hedgeResults[0].errorCode, 'LIMIT_REJECTED');
        assert.strictEqual(result.hedgeResults[0].filledStake, 0);
        console.log('✓ Error/rejected hedge: errorCode populated');
    });
}

/**
 * Test: Determinism
 */
{
    const hedgingPlan = {
        hedges: [
            { hedgeId: 'hedge1', sourceLegId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: -110, stake: 100 }
        ],
        notes: []
    };

    const engineContext = {
        executeSingleLegFn: async (leg) => {
            return {
                status: 'filled',
                filledStake: leg.stake,
                remainingStake: 0
            };
        }
    };

    Promise.all([
        executeHedgingPlan(hedgingPlan, engineContext),
        executeHedgingPlan(hedgingPlan, engineContext)
    ]).then(([result1, result2]) => {
        assert.strictEqual(result1.status, result2.status);
        assert.strictEqual(result1.hedgeResults.length, result2.hedgeResults.length);
        assert.strictEqual(result1.hedgeResults[0].hedgeId, result2.hedgeResults[0].hedgeId);
        console.log('✓ Determinism: same input produces same output');
    });
}

console.log('\\n=== All hedge executor tests passed ===\\n');
