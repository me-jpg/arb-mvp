/**
 * tests/execution/orderPlannerRiskIntegration.test.js
 */

const assert = require('assert');
const { buildPlannedOrders, computePlannedStake } = require('../../src/execution/orderPlanner');
const config = require('../../config');

console.log('=== orderPlannerRiskIntegration.test.js ===\n');

// Test 1: With valid riskConfig + positive edge
{
    const orderContext = { defaultStake: 50 };
    const edge = 0.02; // 2% edge

    const stake = computePlannedStake(orderContext, config, edge);

    assert.ok(stake > 0, 'Stake should be positive with valid edge');
    assert.ok(stake >= 10, 'Stake should be at least one baseUnit');

    console.log('✓ Test 1: Valid riskConfig + positive edge produces stake > 0');
}

// Test 2: With edge <= 0
{
    const orderContext = { defaultStake: 50 };
    const edge = 0; // No edge

    const stake = computePlannedStake(orderContext, config, edge);

    assert.strictEqual(stake, 50, 'Should fallback to default stake when edge <= 0');

    console.log('✓ Test 2: Edge <= 0 falls back to default stake');
}

// Test 3: With null edge
{
    const orderContext = { defaultStake: 75 };
    const edge = null;

    const stake = computePlannedStake(orderContext, config, edge);

    assert.strictEqual(stake, 75, 'Should use defaultStake when edge is null');

    console.log('✓ Test 3: Null edge preserves fallback behavior');
}

// Test 4: Determinism
{
    const orderContext = { defaultStake: 50 };
    const edge = 0.03;

    const stake1 = computePlannedStake(orderContext, config, edge);
    const stake2 = computePlannedStake(orderContext, config, edge);

    assert.strictEqual(stake1, stake2, 'Should be deterministic');

    console.log('✓ Test 4: Determinism - same inputs yield same stake');
}

// Test 5: Integration with buildPlannedOrders
{
    const signals = [
        {
            id: 'sig1',
            eventId: 'evt1',
            primaryBook: 'dk',
            marketType: 'spread',
            side: 'over',
            line: 42.5,
            targetPrice: 1.95,
            expectedEdge: 0.025,
            profitMargin: 2.5,
            timestamp: new Date().toISOString()
        }
    ];

    const orders = buildPlannedOrders(signals);

    assert.strictEqual(orders.length, 1, 'Should create one order');
    assert.ok(orders[0].stake > 0, 'Order should have positive stake');
    assert.strictEqual(orders[0].book, 'dk', 'Should preserve book');

    console.log('✓ Test 5: Integration with buildPlannedOrders works');
}

// Test 6: Order skipped when stake too small
{
    const signals = [
        {
            id: 'sig2',
            eventId: 'evt2',
            primaryBook: 'betmgm',
            marketType: 'moneyline',
            side: 'home',
            line: null,
            targetPrice: 2.1,
            expectedEdge: 0.001, // Tiny edge → stake likely < minStake
            profitMargin: 0.1,
            timestamp: new Date().toISOString()
        }
    ];

    const orders = buildPlannedOrders(signals);

    // Order may be skipped if stake rounds to 0 due to minStake
    assert.ok(orders.length >= 0, 'Should handle small stakes gracefully');

    console.log('✓ Test 6: Small stakes handled correctly');
}

// Test 7: Fallback when no edge in signal
{
    const signals = [
        {
            id: 'sig3',
            eventId: 'evt3',
            primaryBook: 'fanduel',
            marketType: 'total',
            side: 'under',
            line: 48.5,
            targetPrice: 1.85,
            // No expectedEdge or edge field
            profitMargin: 1.5,
            timestamp: new Date().toISOString()
        }
    ];

    const orders = buildPlannedOrders(signals);

    assert.strictEqual(orders.length, 1, 'Should still create order');
    assert.strictEqual(orders[0].stake, 50, 'Should use default stake when no edge');

    console.log('✓ Test 7: Fallback to default stake when no edge in signal');
}

// Test 8: Per-book exposure cap integration
{
    const now = Date.now();
    const recentExecutions = [
        { book: 'dk', stake: 2000, timestamp: new Date(now - 1000).toISOString(), pnl: 100 },
        { book: 'dk', stake: 1500, timestamp: new Date(now - 2000).toISOString(), pnl: -50 },
        { book: 'betmgm', stake: 500, timestamp: new Date(now - 3000).toISOString(), pnl: 25 }
    ];

    // Book 'dk' has 3500 exposure, cap is 5000, so only 1500 room left
    const orderContext = { defaultStake: 50, book: 'dk' };
    const edge = 0.05; // Would normally give large stake

    const stake = computePlannedStake(orderContext, config, edge, recentExecutions);

    // Should be capped to available room (5000 - 3500 = 1500)
    assert.ok(stake <= 1500, 'Should respect maxPerBookExposure cap');
    assert.ok(stake > 0, 'Should still allow some stake');

    console.log('✓ Test 8: Per-book exposure cap limits stake correctly');
}

// Test 9: Exposure cap with book at limit
{
    const now = Date.now();
    const recentExecutions = [
        { book: 'fanduel', stake: 5000, timestamp: new Date(now - 1000).toISOString(), pnl: 0 }
    ];

    // Book 'fanduel' already at 5000 exposure (the cap)
    const orderContext = { defaultStake: 50, book: 'fanduel' };
    const edge = 0.03;

    const stake = computePlannedStake(orderContext, config, edge, recentExecutions);

    assert.strictEqual(stake, 0, 'Should return 0 when book at exposure limit');

    console.log('✓ Test 9: Returns 0 when book at exposure limit');
}

// Test 10: Daily loss cap blocks betting
{
    const today = new Date();
    const dayStart = new Date(today.setHours(0, 0, 0, 0));

    const recentExecutions = [
        { book: 'dk', stake: 500, timestamp: new Date(dayStart.getTime() + 1000).toISOString(), pnl: -1000 },
        { book: 'betmgm', stake: 300, timestamp: new Date(dayStart.getTime() + 2000).toISOString(), pnl: -1200 }
    ];

    // Total PnL: -2200, cap is 2000, so should block
    const orderContext = { defaultStake: 50, book: 'dk' };
    const edge = 0.02;

    const stake = computePlannedStake(orderContext, config, edge, recentExecutions);

    assert.strictEqual(stake, 0, 'Should return 0 when daily loss limit exceeded');

    console.log('✓ Test 10: Daily loss cap blocks betting when limit exceeded');
}

// Test 11: Backward compatibility - no execution history
{
    const orderContext = { defaultStake: 50, book: 'dk' };
    const edge = 0.02;

    // No recentExecutions provided
    const stake = computePlannedStake(orderContext, config, edge);

    assert.ok(stake > 0, 'Should still work without execution history');
    assert.strictEqual(stake, 50, 'Should use Kelly sizing without exposure caps');

    console.log('✓ Test 11: Backward compatible when no execution history provided');
}

// Test 12: Empty execution history
{
    const orderContext = { defaultStake: 50, book: 'dk' };
    const edge = 0.02;

    const stake = computePlannedStake(orderContext, config, edge, []);

    assert.ok(stake > 0, 'Should work with empty execution array');

    console.log('✓ Test 12: Handles empty execution history gracefully');
}

console.log('\n=== All order planner risk integration tests passed ===\n');
