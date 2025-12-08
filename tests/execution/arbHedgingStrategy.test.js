/**
 * tests/execution/arbHedgingStrategy.test.js
 * 
 * Tests for arb hedging strategy computation.
 */

const assert = require('assert');
const { computeHedgeForBrokenArb } = require('../../src/execution/arbHedgingStrategy');

console.log('=== Arb Hedging Strategy Tests ===\\n');

/**
 * Test: No exposure to hedge
 */
{
    const arbPlan = {
        id: 'arb1',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const legResults = [
        { legId: 'leg1', book: 'draftkings', requestedStake: 100, filledStake: 0, remainingStake: 100, status: 'rejected', errorCode: null, errorMessage: null },
        { legId: 'leg2', book: 'fanduel', requestedStake: 105, filledStake: 0, remainingStake: 105, status: 'error', errorCode: null, errorMessage: null }
    ];

    const hedgingConfig = { enabled: true, mode: 'flatten_exposure', maxHedgeFraction: 1.0 };

    const result = computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig);

    assert.strictEqual(result.hedges.length, 0, 'No hedges when no exposure');
    assert.ok(result.notes.some(n => n.includes('no exposure')), 'Should note no exposure');
    console.log('✓ No exposure to hedge: hedges=[]');
}

/**
 * Test: Completed arb (all legs filled)
 */
{
    const arbPlan = {
        id: 'arb2',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt2', marketType: 'spread', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt2', marketType: 'spread', side: 'away', price: +105, stake: 105 }
        ]
    };

    const legResults = [
        { legId: 'leg1', book: 'draftkings', requestedStake: 100, filledStake: 100, remainingStake: 0, status: 'filled', errorCode: null, errorMessage: null },
        { legId: 'leg2', book: 'fanduel', requestedStake: 105, filledStake: 105, remainingStake: 0, status: 'filled', errorCode: null, errorMessage: null }
    ];

    const hedgingConfig = { enabled: true, mode: 'flatten_exposure', maxHedgeFraction: 1.0 };

    const result = computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig);

    assert.strictEqual(result.hedges.length, 0, 'No hedges for completed arb');
    assert.ok(result.notes.some(n => n.includes('completed arb')), 'Should note completed arb');
    console.log('✓ Completed arb: hedges=[], no hedge needed');
}

/**
 * Test: Broken arb with single filled leg
 */
{
    const arbPlan = {
        id: 'arb3',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt3', marketType: 'total', side: 'over', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt3', marketType: 'total', side: 'under', price: -110, stake: 100 }
        ]
    };

    const legResults = [
        { legId: 'leg1', book: 'draftkings', requestedStake: 100, filledStake: 100, remainingStake: 0, status: 'filled', errorCode: null, errorMessage: null },
        { legId: 'leg2', book: 'fanduel', requestedStake: 100, filledStake: 0, remainingStake: 100, status: 'rejected', errorCode: 'LIMIT_REJECTED', errorMessage: null }
    ];

    const hedgingConfig = { enabled: true, mode: 'flatten_exposure', maxHedgeFraction: 1.0 };

    const result = computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig);

    assert.strictEqual(result.hedges.length, 1, 'Should generate 1 hedge');
    assert.strictEqual(result.hedges[0].sourceLegId, 'leg1');
    assert.strictEqual(result.hedges[0].book, 'draftkings');
    assert.strictEqual(result.hedges[0].side, 'under', 'Should hedge with opposite side (over→under)');
    assert.strictEqual(result.hedges[0].stake, 100, 'Hedge stake should equal filledStake');
    assert.strictEqual(result.hedges[0].price, -110, 'Should use original price');
    console.log('✓ Broken arb with single filled leg: 1 hedge with opposite side');
}

/**
 * Test: Broken arb with multiple filled legs
 */
{
    const arbPlan = {
        id: 'arb4',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt4', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt4', marketType: 'moneyline', side: 'away', price: +105, stake: 105 },
            { legId: 'leg3', book: 'betmgm', eventId: 'evt4', marketType: 'moneyline', side: 'home', price: -105, stake: 100 }
        ]
    };

    const legResults = [
        { legId: 'leg1', book: 'draftkings', requestedStake: 100, filledStake: 100, remainingStake: 0, status: 'filled', errorCode: null, errorMessage: null },
        { legId: 'leg2', book: 'fanduel', requestedStake: 105, filledStake: 105, remainingStake: 0, status: 'filled', errorCode: null, errorMessage: null },
        { legId: 'leg3', book: 'betmgm', requestedStake: 100, filledStake: 0, remainingStake: 100, status: 'error', errorCode: 'NETWORK_ERROR', errorMessage: null }
    ];

    const hedgingConfig = { enabled: true, mode: 'flatten_exposure', maxHedgeFraction: 1.0 };

    const result = computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig);

    assert.strictEqual(result.hedges.length, 2, 'Should generate 2 hedges (one per filled leg)');
    assert.strictEqual(result.hedges[0].side, 'away', 'leg1 home→away');
    assert.strictEqual(result.hedges[1].side, 'home', 'leg2 away→home');
    console.log('✓ Broken arb with multiple filled legs: 2 hedges generated');
}

/**
 * Test: maxHedgeFraction < 1
 */
{
    const arbPlan = {
        id: 'arb5',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt5', marketType: 'spread', side: 'home', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt5', marketType: 'spread', side: 'away', price: +105, stake: 105 }
        ]
    };

    const legResults = [
        { legId: 'leg1', book: 'draftkings', requestedStake: 100, filledStake: 100, remainingStake: 0, status: 'filled', errorCode: null, errorMessage: null },
        { legId: 'leg2', book: 'fanduel', requestedStake: 105, filledStake: 0, remainingStake: 105, status: 'rejected', errorCode: null, errorMessage: null }
    ];

    const hedgingConfig = { enabled: true, mode: 'flatten_exposure', maxHedgeFraction: 0.5 };

    const result = computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig);

    assert.strictEqual(result.hedges.length, 1);
    assert.strictEqual(result.hedges[0].stake, 50, 'Hedge stake should be filledStake * maxHedgeFraction (100 * 0.5)');
    console.log('✓ maxHedgeFraction < 1: hedge stake = filledStake * 0.5');
}

/**
 * Test: Unknown side mapping
 */
{
    const arbPlan = {
        id: 'arb6',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt6', marketType: 'exotic', side: 'weird_side', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt6', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
        ]
    };

    const legResults = [
        { legId: 'leg1', book: 'draftkings', requestedStake: 100, filledStake: 100, remainingStake: 0, status: 'filled', errorCode: null, errorMessage: null },
        { legId: 'leg2', book: 'fanduel', requestedStake: 105, filledStake: 0, remainingStake: 105, status: 'rejected', errorCode: null, errorMessage: null }
    ];

    const hedgingConfig = { enabled: true, mode: 'flatten_exposure', maxHedgeFraction: 1.0 };

    const result = computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig);

    assert.strictEqual(result.hedges.length, 0, 'Should not hedge leg with unknown side');
    assert.ok(result.notes.some(n => n.includes('weird_side') && n.includes('skipping')), 'Should note unknown side');
    console.log('✓ Unknown side mapping: no hedge, note recorded');
}

/**
 * Test: Partial fills hedge
 */
{
    const arbPlan = {
        id: 'arb7',
        legs: [
            { legId: 'leg1', book: 'draftkings', eventId: 'evt7', marketType: 'total', side: 'over', price: -110, stake: 100 },
            { legId: 'leg2', book: 'fanduel', eventId: 'evt7', marketType: 'total', side: 'under', price: -110, stake: 100 }
        ]
    };

    const legResults = [
        { legId: 'leg1', book: 'draftkings', requestedStake: 100, filledStake: 60, remainingStake: 40, status: 'partial_filled', errorCode: null, errorMessage: null },
        { legId: 'leg2', book: 'fanduel', requestedStake: 100, filledStake: 0, remainingStake: 100, status: 'error', errorCode: 'NETWORK_ERROR', errorMessage: null }
    ];

    const hedgingConfig = { enabled: true, mode: 'flatten_exposure', maxHedgeFraction: 1.0 };

    const result = computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig);

    assert.strictEqual(result.hedges.length, 1);
    assert.strictEqual(result.hedges[0].stake, 60, 'Should hedge partial filledStake');
    console.log('✓ Partial fills: hedge uses partial filledStake (60)');
}

console.log('\\n=== All hedging strategy tests passed ===\\n');
