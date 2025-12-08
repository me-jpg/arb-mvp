/**
 * tests/execution/executionHealthMonitor.test.js
 */

const assert = require('assert');
const {
    computeFillRates,
    classifyFailures,
    detectSystemicFailPatterns
} = require('../../src/execution/executionHealthMonitor');

console.log('=== executionHealthMonitor.test.js ===\n');

// Test 1: computeFillRates - empty executions
{
    const result = computeFillRates([]);

    assert.strictEqual(result.global.total, 0, 'Empty should have 0 total');
    assert.strictEqual(result.global.fillRate, 0, 'Empty should have 0 fill rate');
    assert.strictEqual(result.perBook.length, 0, 'Empty should have no books');

    console.log('✓ Test 1: computeFillRates - empty executions');
}

// Test 2: computeFillRates - mixed statuses
{
    const execs = [
        { book: 'dk', status: 'filled' },
        { book: 'dk', status: 'filled' },
        { book: 'dk', status: 'rejected' },
        { book: 'fanduel', status: 'filled' },
        { book: 'fanduel', status: 'partial' }
    ];

    const result = computeFillRates(execs);

    assert.strictEqual(result.global.total, 5, 'Should have 5 total');
    assert.strictEqual(result.global.fills, 3, 'Should have 3 fills');
    assert.strictEqual(result.global.rejects, 1, 'Should have 1 reject');
    assert.strictEqual(result.global.partials, 1, 'Should have 1 partial');
    assert.strictEqual(result.global.fillRate, 0.6, 'Fill rate should be 60%');

    console.log('✓ Test 2: computeFillRates - mixed statuses');
}

// Test 3: computeFillRates - per-book grouping
{
    const execs = [
        { book: 'dk', status: 'filled' },
        { book: 'dk', status: 'filled' },
        { book: 'dk', status: 'rejected' },
        { book: 'fanduel', status: 'filled' }
    ];

    const result = computeFillRates(execs);

    assert.strictEqual(result.perBook.length, 2, 'Should have 2 books');

    const dk = result.perBook.find(b => b.book === 'dk');
    assert.ok(dk, 'DK should exist');
    assert.strictEqual(dk.fills, 2, 'DK should have 2 fills');
    assert.strictEqual(dk.rejects, 1, 'DK should have 1 reject');
    assert.strictEqual(Math.round(dk.fillRate * 100), 67, 'DK fill rate ~67%');

    console.log('✓ Test 3: computeFillRates - per-book grouping');
}

// Test 4: classifyFailures - ordered precedence
{
    const execs = [
        { status: 'rejected', rejectReason: 'price moved' },
        { status: 'rejected', rejectReason: 'odds changed' },
        { status: 'rejected', rejectReason: 'line changed' },
        { status: 'rejected', rejectReason: 'throttled request' },
        { status: 'rejected', rejectReason: 'risk limit exceeded' }
    ];

    const result = classifyFailures(execs);

    const priceMode = result.find(f => f.type === 'price_moved');
    assert.ok(priceMode, 'Should have price_moved');
    assert.strictEqual(priceMode.count, 2, 'Should have 2 price failures');

    const lineMode = result.find(f => f.type === 'line_changed');
    assert.ok(lineMode, 'Should have line_changed');

    const riskMode = result.find(f => f.type === 'risk_limit');
    assert.ok(riskMode, 'Should have risk_limit');

    console.log('✓ Test 4: classifyFailures - ordered precedence');
}

// Test 5: Unknown status bucket
{
    const execs = [
        { book: 'dk', status: 'filled' },
        { book: 'dk', status: 'pending' },
        { book: 'dk', status: 'cancelled' },
        { book: 'dk', status: 'expired' }
    ];

    const result = computeFillRates(execs);

    assert.strictEqual(result.global.total, 4, 'Should have 4 total');
    assert.strictEqual(result.global.fills, 1, 'Should have 1 fill');
    assert.strictEqual(result.global.unknown, 3, 'Should have 3 unknown statuses');

    const sum = result.global.fills + result.global.rejects + result.global.partials + result.global.unknown;
    assert.strictEqual(sum, result.global.total, 'Categories should sum to total');

    console.log('✓ Test 5: Unknown status bucket');
}

// Test 6: No alerts
{
    const execs = [
        { book: 'dk', status: 'filled', timestamp: new Date().toISOString() },
        { book: 'dk', status: 'filled', timestamp: new Date().toISOString() }
    ];

    const result = detectSystemicFailPatterns(execs, { rejectThresholdPct: 0.3 });

    assert.strictEqual(result.length, 0, 'Should have no alerts for all fills');

    console.log('✓ Test 6: No alerts');
}

// Test 7: Edge cases
{
    const result1 = computeFillRates(null);
    assert.strictEqual(result1.global.total, 0, 'Null should return empty');

    const result2 = classifyFailures(undefined);
    assert.strictEqual(result2.length, 0, 'Undefined should return empty array');

    const result3 = detectSystemicFailPatterns([]);
    assert.strictEqual(result3.length, 0, 'Empty should return no alerts');

    console.log('✓ Test 7: Edge cases');
}

console.log('\n=== All execution health monitor tests passed ===\n');
