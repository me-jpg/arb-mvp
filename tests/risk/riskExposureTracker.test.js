/**
 * tests/risk/riskExposureTracker.test.js
 */

const assert = require('assert');
const { computeBookExposure, computeDailyPnL } = require('../../src/risk/riskExposureTracker');

console.log('=== riskExposureTracker.test.js ===\n');

// Test 1: computeBookExposure - sums stakes for single book
{
    const executions = [
        { book: 'dk', stake: 100, timestamp: new Date().toISOString() },
        { book: 'dk', stake: 50, timestamp: new Date().toISOString() },
        { book: 'betmgm', stake: 75, timestamp: new Date().toISOString() }
    ];

    const result = computeBookExposure(executions, 'dk');

    assert.strictEqual(result.book, 'dk', 'Should return correct book');
    assert.strictEqual(result.totalStake, 150, 'Should sum stakes for dk only');
    assert.strictEqual(result.count, 2, 'Should count 2 executions');

    console.log('✓ Test 1: computeBookExposure sums stakes correctly');
}

// Test 2: computeBookExposure - ignores other books
{
    const executions = [
        { book: 'fanduel', stake: 200, timestamp: new Date().toISOString() },
        { book: 'betmgm', stake: 100, timestamp: new Date().toISOString() }
    ];

    const result = computeBookExposure(executions, 'dk');

    assert.strictEqual(result.totalStake, 0, 'Should have 0 exposure for dk');
    assert.strictEqual(result.count, 0, 'Should have 0 count');

    console.log('✓ Test 2: computeBookExposure ignores other books');
}

// Test 3: computeBookExposure - respects time window
{
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const twoHoursAgo = now - (2 * 60 * 60 * 1000);

    const executions = [
        { book: 'dk', stake: 100, timestamp: new Date(now).toISOString() },
        { book: 'dk', stake: 50, timestamp: new Date(oneHourAgo).toISOString() },
        { book: 'dk', stake: 25, timestamp: new Date(twoHoursAgo).toISOString() }
    ];

    // Only last 90 minutes
    const result = computeBookExposure(executions, 'dk', {
        windowMs: 90 * 60 * 1000,
        referenceTime: now
    });

    assert.strictEqual(result.totalStake, 150, 'Should only count last 2 executions');
    assert.strictEqual(result.count, 2, 'Should count 2 recent executions');

    console.log('✓ Test 3: computeBookExposure respects time window');
}

// Test 4: computeBookExposure - deterministic
{
    const executions = [
        { book: 'dk', stake: 75, timestamp: new Date().toISOString() },
        { book: 'dk', stake: 25, timestamp: new Date().toISOString() }
    ];

    const result1 = computeBookExposure(executions, 'dk');
    const result2 = computeBookExposure(executions, 'dk');

    assert.strictEqual(result1.totalStake, result2.totalStake, 'Should be deterministic');
    assert.strictEqual(result1.count, result2.count, 'Count should be deterministic');

    console.log('✓ Test 4: computeBookExposure is deterministic');
}

// Test 5: computeDailyPnL - sums PnL within day
{
    const today = new Date();
    const dayStart = new Date(today.setHours(0, 0, 0, 0));
    const dayEnd = new Date(today.setHours(23, 59, 59, 999));

    const executions = [
        { pnl: 50, timestamp: new Date(dayStart.getTime() + 1000).toISOString() },
        { pnl: -30, timestamp: new Date(dayStart.getTime() + 2000).toISOString() },
        { pnl: 20, timestamp: new Date(dayStart.getTime() + 3000).toISOString() }
    ];

    const result = computeDailyPnL(executions, { dayStart, dayEnd });

    assert.strictEqual(result.totalPnL, 40, 'Should sum PnL correctly');
    assert.strictEqual(result.count, 3, 'Should count all executions');

    console.log('✓ Test 5: computeDailyPnL sums PnL within day');
}

// Test 6: computeDailyPnL - ignores executions outside window
{
    const today = new Date();
    const dayStart = new Date(today.setHours(0, 0, 0, 0));
    const dayEnd = new Date(today.setHours(23, 59, 59, 999));
    const yesterday = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);

    const executions = [
        { pnl: 100, timestamp: new Date(dayStart.getTime() + 1000).toISOString() },
        { pnl: 50, timestamp: yesterday.toISOString() } // Yesterday, should be ignored
    ];

    const result = computeDailyPnL(executions, { dayStart, dayEnd });

    assert.strictEqual(result.totalPnL, 100, 'Should only count today');
    assert.strictEqual(result.count, 1, 'Should count only 1 execution');

    console.log('✓ Test 6: computeDailyPnL ignores executions outside window');
}

// Test 7: computeDailyPnL - handles positive and negative PnL
{
    const today = new Date();
    const dayStart = new Date(today.setHours(0, 0, 0, 0));
    const dayEnd = new Date(today.setHours(23, 59, 59, 999));

    const executions = [
        { pnl: 100, timestamp: new Date(dayStart.getTime() + 1000).toISOString() },
        { pnl: -150, timestamp: new Date(dayStart.getTime() + 2000).toISOString() },
        { pnl: 25, timestamp: new Date(dayStart.getTime() + 3000).toISOString() }
    ];

    const result = computeDailyPnL(executions, { dayStart, dayEnd });

    assert.strictEqual(result.totalPnL, -25, 'Should handle mixed PnL correctly');

    console.log('✓ Test 7: computeDailyPnL handles positive and negative PnL');
}

// Test 8: computeDailyPnL - deterministic
{
    const today = new Date();
    const dayStart = new Date(today.setHours(0, 0, 0, 0));
    const dayEnd = new Date(today.setHours(23, 59, 59, 999));

    const executions = [
        { pnl: 75, timestamp: new Date(dayStart.getTime() + 1000).toISOString() },
        { pnl: -25, timestamp: new Date(dayStart.getTime() + 2000).toISOString() }
    ];

    const result1 = computeDailyPnL(executions, { dayStart, dayEnd });
    const result2 = computeDailyPnL(executions, { dayStart, dayEnd });

    assert.strictEqual(result1.totalPnL, result2.totalPnL, 'Should be deterministic');
    assert.strictEqual(result1.count, result2.count, 'Count should be deterministic');

    console.log('✓ Test 8: computeDailyPnL is deterministic');
}

console.log('\n=== All risk exposure tracker tests passed ===\n');
