/**
 * tests/execution/executionHealthAdvisoryIntegration.test.js
 */

const assert = require('assert');
const { evaluateExecutionHealthForBatch } = require('../../src/execution/executionHealthAdvisoryIntegration');

console.log('=== executionHealthAdvisoryIntegration.test.js ===\n');

// Test 1: Default enforcement mode
{
    const healthSummary = {
        global: {
            fills: 90,
            rejects: 8,
            partials: 2,
            unknown: 0,
            total: 100,
            fillRate: 0.90,
            rejectRate: 0.08
        },
        perBook: [],
        systemicAlerts: []
    };

    const config = { execution: {} };  // No healthAdvisory specified

    const result = evaluateExecutionHealthForBatch(healthSummary, config);

    assert.strictEqual(result.enforcementMode, 'ignore', 'Default should be ignore');
    assert.strictEqual(result.shouldAffectExecution, false, 'Should not affect execution');
    assert.ok(result.advisory, 'Should have advisory');

    console.log('✓ Test 1: Default enforcement mode is ignore');
}

// Test 2: Explicit enforcement modes
{
    const healthSummary = {
        global: {
            fills: 70,
            rejects: 25,
            partials: 5,
            unknown: 0,
            total: 100,
            fillRate: 0.70,
            rejectRate: 0.25
        },
        perBook: [],
        systemicAlerts: []
    };

    // Test 'log' mode
    const configLog = { execution: { healthAdvisory: { enforcementMode: 'log' } } };
    const resultLog = evaluateExecutionHealthForBatch(healthSummary, configLog);

    assert.strictEqual(resultLog.enforcementMode, 'log', 'Should reflect log mode');
    assert.strictEqual(resultLog.shouldAffectExecution, false, 'Still should not affect execution');

    // Test 'halt' mode
    const configHalt = { execution: { healthAdvisory: { enforcementMode: 'halt' } } };
    const resultHalt = evaluateExecutionHealthForBatch(healthSummary, configHalt);

    assert.strictEqual(resultHalt.enforcementMode, 'halt', 'Should reflect halt mode');
    assert.strictEqual(resultHalt.shouldAffectExecution, false, 'Still should not affect execution (not implemented)');

    console.log('✓ Test 2: Explicit enforcement modes propagate correctly');
}

// Test 3: Health summary propagation
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
        perBook: [],
        systemicAlerts: []
    };

    const config = {};
    const result = evaluateExecutionHealthForBatch(healthSummary, config);

    assert.ok(result.advisory, 'Should have advisory');
    assert.ok(result.advisory.level, 'Advisory should have level');
    assert.ok(result.advisory.metrics, 'Advisory should have metrics');
    assert.strictEqual(result.advisory.metrics.globalFillRate, 0.85, 'Should propagate metrics');

    console.log('✓ Test 3: Health summary propagates to advisory');
}

// Test 4: Halt recommended detection
{
    // OK status
    const healthOk = {
        global: { fills: 95, rejects: 3, partials: 2, unknown: 0, total: 100, fillRate: 0.95, rejectRate: 0.03 },
        perBook: [],
        systemicAlerts: []
    };

    const resultOk = evaluateExecutionHealthForBatch(healthOk, {});
    assert.strictEqual(resultOk.haltRecommended, false, 'OK status should not recommend halt');

    // Halt status (high reject rate on book with enough samples)
    const healthHalt = {
        global: { fills: 45, rejects: 55, partials: 0, unknown: 0, total: 100, fillRate: 0.45, rejectRate: 0.55 },
        perBook: [
            { book: 'dk', total: 100, rejectRate: 0.58, fillRate: 0.42 }
        ],
        systemicAlerts: []
    };

    const resultHalt = evaluateExecutionHealthForBatch(healthHalt, {});
    assert.strictEqual(resultHalt.advisory.level, 'halt_recommended', 'Should derive halt_recommended');
    assert.strictEqual(resultHalt.haltRecommended, true, 'Should flag halt recommended');

    console.log('✓ Test 4: Halt recommended detection works');
}

// Test 5: Pure function - no mutations
{
    const healthSummary = {
        global: { fills: 80, rejects: 15, partials: 5, unknown: 0, total: 100, fillRate: 0.80, rejectRate: 0.15 },
        perBook: [],
        systemicAlerts: []
    };

    const config = { execution: { healthAdvisory: { enforcementMode: 'log' } } };

    const result1 = evaluateExecutionHealthForBatch(healthSummary, config);
    const result2 = evaluateExecutionHealthForBatch(healthSummary, config);

    // Should be deterministic
    assert.strictEqual(result1.advisory.level, result2.advisory.level, 'Should be deterministic');
    assert.strictEqual(result1.enforcementMode, result2.enforcementMode, 'Should be deterministic');

    // Should not mutate inputs
    assert.strictEqual(healthSummary.global.fillRate, 0.80, 'Should not mutate health summary');
    assert.strictEqual(config.execution.healthAdvisory.enforcementMode, 'log', 'Should not mutate config');

    console.log('✓ Test 5: Pure function with no mutations');
}

console.log('\n=== All advisory integration tests passed ===\n');
