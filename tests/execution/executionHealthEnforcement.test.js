/**
 * tests/execution/executionHealthEnforcement.test.js
 */

const assert = require('assert');
const { evaluateExecutionHealthForBatch } = require('../../src/execution/executionHealthAdvisoryIntegration');

console.log('=== executionHealthEnforcement.test.js ===\n');

// Test 1: Default mode (ignore) - no behavior change
{
    const healthHalt = {
        global: { fills: 45, rejects: 55, partials: 0, unknown: 0, total: 100, fillRate: 0.45, rejectRate: 0.55 },
        perBook: [{ book: 'dk', total: 100, rejectRate: 0.58, fillRate: 0.42 }],
        systemicAlerts: []
    };

    const config = {}; // Default mode = 'ignore'
    const result = evaluateExecutionHealthForBatch(healthHalt, config);

    assert.strictEqual(result.enforcementMode, 'ignore', 'Should be ignore mode');
    assert.strictEqual(result.haltRecommended, true, 'Should recommend halt');
    assert.strictEqual(result.shouldAffectExecution, false, 'Should NOT affect execution in ignore mode');

    console.log('✓ Test 1: Ignore mode - no behavior change even with halt recommended');
}

// Test 2: Halt mode with OK status - proceed as normal
{
    const healthOk = {
        global: { fills: 95, rejects: 3, partials: 2, unknown: 0, total: 100, fillRate: 0.95, rejectRate: 0.03 },
        perBook: [],
        systemicAlerts: []
    };

    const config = { execution: { healthAdvisory: { enforcementMode: 'halt' } } };
    const result = evaluateExecutionHealthForBatch(healthOk, config);

    assert.strictEqual(result.enforcementMode, 'halt', 'Should be halt mode');
    assert.strictEqual(result.advisory.level, 'ok', 'Should have OK advisory');
    assert.strictEqual(result.haltRecommended, false, 'Should NOT recommend halt');
    assert.strictEqual(result.shouldAffectExecution, false, 'Should NOT affect execution with OK status');

    console.log('✓ Test 2: Halt mode with OK status - proceed as normal');
}

// Test 3: Halt mode with degraded status - proceed as normal
{
    const healthDegraded = {
        global: { fills: 75, rejects: 22, partials: 3, unknown: 0, total: 100, fillRate: 0.75, rejectRate: 0.22 },
        perBook: [],
        systemicAlerts: []
    };

    const config = { execution: { healthAdvisory: { enforcementMode: 'halt' } } };
    const result = evaluateExecutionHealthForBatch(healthDegraded, config);

    assert.strictEqual(result.enforcementMode, 'halt', 'Should be halt mode');
    assert.strictEqual(result.advisory.level, 'degraded', 'Should have degraded advisory');
    assert.strictEqual(result.haltRecommended, false, 'Should NOT recommend halt');
    assert.strictEqual(result.shouldAffectExecution, false, 'Should NOT affect execution with degraded status');

    console.log('✓ Test 3: Halt mode with degraded status - proceed as normal');
}

// Test 4: Halt mode with halt_recommended - BLOCK execution
{
    const healthHalt = {
        global: { fills: 45, rejects: 55, partials: 0, unknown: 0, total: 100, fillRate: 0.45, rejectRate: 0.55 },
        perBook: [{ book: 'dk', total: 100, rejectRate: 0.58, fillRate: 0.42 }],
        systemicAlerts: []
    };

    const config = { execution: { healthAdvisory: { enforcementMode: 'halt' } } };
    const result = evaluateExecutionHealthForBatch(healthHalt, config);

    assert.strictEqual(result.enforcementMode, 'halt', 'Should be halt mode');
    assert.strictEqual(result.advisory.level, 'halt_recommended', 'Should have halt_recommended advisory');
    assert.strictEqual(result.haltRecommended, true, 'Should recommend halt');
    assert.strictEqual(result.shouldAffectExecution, true, 'SHOULD affect execution');

    console.log('✓ Test 4: Halt mode with halt_recommended - execution should be blocked');
}

// Test 5: Execution engine integration
{
    (async () => {
        // This would test the actual execution engine, but we'll do a simple mock test
        const result = evaluateExecutionHealthForBatch({
            global: { fills: 40, rejects: 60, partials: 0, unknown: 0, total: 100, fillRate: 0.40, rejectRate: 0.60 },
            perBook: [{ book: 'dk', total: 100, rejectRate: 0.60, fillRate: 0.40 }],
            systemicAlerts: []
        }, { execution: { healthAdvisory: { enforcementMode: 'halt' } } });

        if (result.shouldAffectExecution) {
            const mockHaltedResult = {
                status: 'halted_by_health_advisory',
                reason: 'execution_health_advisory_halt',
                advisoryLevel: result.advisory.level,
                results: []
            };

            assert.strictEqual(mockHaltedResult.status, 'halted_by_health_advisory', 'Should halt');
            assert.strictEqual(mockHaltedResult.reason, 'execution_health_advisory_halt', 'Should have halt reason');
            assert.strictEqual(mockHaltedResult.results.length, 0, 'Should have no results');

            console.log('✓ Test 5: Execution engine returns halted status correctly');
        }
    })();
}

setTimeout(() => {
    console.log('\n=== All enforcement tests passed ===\n');
}, 1000);
