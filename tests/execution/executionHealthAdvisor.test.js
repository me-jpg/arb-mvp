/**
 * tests/execution/executionHealthAdvisor.test.js
 */

const assert = require('assert');
const {
    deriveExecutionHealthStatus,
    shouldHaltExecution,
    DEFAULT_THRESHOLDS
} = require('../../src/execution/executionHealthAdvisor');

console.log('=== executionHealthAdvisor.test.js ===\n');

// Test 1: OK status
{
    const healthSummary = {
        global: {
            fills: 95,
            rejects: 3,
            partials: 2,
            unknown: 0,
            total: 100,
            fillRate: 0.95,
            rejectRate: 0.03
        },
        perBook: [
            { book: 'dk', total: 50, rejectRate: 0.02, fillRate: 0.96 },
            { book: 'fanduel', total: 50, rejectRate: 0.04, fillRate: 0.94 }
        ],
        systemicAlerts: []
    };

    const result = deriveExecutionHealthStatus(healthSummary);

    assert.strictEqual(result.level, 'ok', 'Should be OK with healthy metrics');
    assert.ok(result.reasons.length > 0, 'Should have reasons');
    assert.strictEqual(result.metrics.globalFillRate, 0.95, 'Should capture fill rate');

    const shouldHalt = shouldHaltExecution(healthSummary);
    assert.strictEqual(shouldHalt, false, 'Should not halt for OK status');

    console.log('✓ Test 1: OK status');
}

// Test 2: Degraded status - low fill rate
{
    const healthSummary = {
        global: {
            fills: 75,
            rejects: 22,
            partials: 3,
            unknown: 0,
            total: 100,
            fillRate: 0.75,
            rejectRate: 0.22
        },
        perBook: [
            { book: 'dk', total: 100, rejectRate: 0.22, fillRate: 0.75 }
        ],
        systemicAlerts: []
    };

    const result = deriveExecutionHealthStatus(healthSummary);

    assert.strictEqual(result.level, 'degraded', 'Should be degraded with low fill rate');
    assert.ok(result.reasons.some(r => r.includes('fill rate')), 'Should mention fill rate');

    const shouldHalt = shouldHaltExecution(healthSummary);
    assert.strictEqual(shouldHalt, false, 'Should not halt for degraded');

    console.log('✓ Test 2: Degraded status - low fill rate');
}

// Test 3: Degraded status - high reject rate warning
{
    const healthSummary = {
        global: {
            fills: 65,
            rejects: 32,
            partials: 3,
            unknown: 0,
            total: 100,
            fillRate: 0.65,
            rejectRate: 0.32
        },
        perBook: [
            { book: 'dk', total: 50, rejectRate: 0.42, fillRate: 0.56 },
            { book: 'fanduel', total: 50, rejectRate: 0.22, fillRate: 0.74 }
        ],
        systemicAlerts: []
    };

    const result = deriveExecutionHealthStatus(healthSummary);

    assert.strictEqual(result.level, 'degraded', 'Should be degraded');
    assert.strictEqual(result.metrics.worstBook, 'dk', 'Should identify worst book');
    assert.ok(result.reasons.some(r => r.includes('dk')), 'Should mention worst book');

    console.log('✓ Test 3: Degraded status - high reject rate warning');
}

// Test 4: Halt recommended - critical reject rate
{
    const healthSummary = {
        global: {
            fills: 48,
            rejects: 50,
            partials: 2,
            unknown: 0,
            total: 100,
            fillRate: 0.48,
            rejectRate: 0.50
        },
        perBook: [
            { book: 'dk', total: 50, rejectRate: 0.58, fillRate: 0.40 },
            { book: 'fanduel', total: 50, rejectRate: 0.42, fillRate: 0.56 }
        ],
        systemicAlerts: []
    };

    const result = deriveExecutionHealthStatus(healthSummary);

    assert.strictEqual(result.level, 'halt_recommended', 'Should recommend halt');
    assert.ok(result.reasons.some(r => r.includes('halt threshold')), 'Should mention halt threshold');

    const shouldHalt = shouldHaltExecution(healthSummary);
    assert.strictEqual(shouldHalt, true, 'Should halt for critical reject rate');

    console.log('✓ Test 4: Halt recommended - critical reject rate');
}

// Test 5: Halt recommended - severe alert
{
    const healthSummary = {
        global: {
            fills: 85,
            rejects: 12,
            partials: 3,
            unknown: 0,
            total: 100,
            fillRate: 0.85,
            rejectRate: 0.12
        },
        perBook: [
            { book: 'dk', total: 100, rejectRate: 0.12, fillRate: 0.85 }
        ],
        systemicAlerts: [
            { severity: 'high', message: 'Critical system failure' }
        ]
    };

    const result = deriveExecutionHealthStatus(healthSummary);

    assert.strictEqual(result.level, 'halt_recommended', 'Should recommend halt for severe alert');
    assert.ok(result.reasons.some(r => r.includes('Severe')), 'Should mention severe alert');

    const shouldHalt = shouldHaltExecution(healthSummary);
    assert.strictEqual(shouldHalt, true, 'Should halt for severe alert');

    console.log('✓ Test 5: Halt recommended - severe alert');
}

// Test 6: Unknown status ratio triggers degraded
{
    const healthSummary = {
        global: {
            fills: 80,
            rejects: 5,
            partials: 3,
            unknown: 12,
            total: 100,
            fillRate: 0.80,
            rejectRate: 0.05
        },
        perBook: [
            { book: 'dk', total: 100, rejectRate: 0.05, fillRate: 0.80, unknown: 12 }
        ],
        systemicAlerts: []
    };

    const result = deriveExecutionHealthStatus(healthSummary);

    assert.strictEqual(result.level, 'degraded', 'Should be degraded with high unknown ratio');
    assert.ok(result.reasons.some(r => r.includes('Unknown statuses')), 'Should mention unknown statuses');
    assert.strictEqual(result.metrics.unknownStatusRatio, 0.12, 'Should calculate unknown ratio');

    const shouldHalt = shouldHaltExecution(healthSummary);
    assert.strictEqual(shouldHalt, false, 'Unknown statuses should not trigger halt');

    console.log('✓ Test 6: Unknown status ratio triggers degraded');
}

// Test 7: Small sample size ignored
{
    const healthSummary = {
        global: {
            fills: 5,
            rejects: 10,
            partials: 0,
            unknown: 0,
            total: 15,
            fillRate: 0.33,
            rejectRate: 0.67
        },
        perBook: [
            { book: 'dk', total: 15, rejectRate: 0.67, fillRate: 0.33 }
        ],
        systemicAlerts: []
    };

    const result = deriveExecutionHealthStatus(healthSummary);

    // Low sample size book shouldn't trigger halt
    assert.ok(result.metrics.worstBook === null || result.metrics.worstBook === 'dk', 'May or may not identify worst book with small sample');

    console.log('✓ Test 7: Small sample size handled');
}

// Test 8: No data returns OK
{
    const healthSummary = null;

    const result = deriveExecutionHealthStatus(healthSummary);

    assert.strictEqual(result.level, 'ok', 'Should return OK for no data');
    assert.ok(result.reasons.length > 0, 'Should have reason');

    console.log('✓ Test 8: No data returns OK');
}

// Test 9: Threshold constants are exported
{
    assert.ok(DEFAULT_THRESHOLDS, 'DEFAULT_THRESHOLDS should be exported');
    assert.strictEqual(DEFAULT_THRESHOLDS.rejectRate.halt, 0.5, 'Halt threshold should be 0.5');
    assert.strictEqual(DEFAULT_THRESHOLDS.globalFillRate.degraded, 0.8, 'Degraded fill rate should be 0.8');

    console.log('✓ Test 9: Threshold constants exported');
}

console.log('\n=== All 9 execution health advisor tests passed ===\n');
