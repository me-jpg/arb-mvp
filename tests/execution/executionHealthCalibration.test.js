/**
 * tests/execution/executionHealthCalibration.test.js
 */

const assert = require('assert');
const { calibrateHealthThresholds } = require('../../src/execution/run-execution-health-calibration');

console.log('=== executionHealthCalibration.test.js ===\n');

// Test 1: Calibration aggregates correctly
{
    (async () => {
        const result = await calibrateHealthThresholds({ limit: 100, windowMinutes: 10 });

        assert.ok(result, 'Should return result');
        assert.ok(typeof result.totalWindows === 'number', 'Should have totalWindows');
        assert.ok(typeof result.okCount === 'number', 'Should have okCount');
        assert.ok(typeof result.degradedCount === 'number', 'Should have degradedCount');
        assert.ok(typeof result.haltRecommendedCount === 'number', 'Should have haltRecommendedCount');

        const sum = result.okCount + result.degradedCount + result.haltRecommendedCount;
        assert.strictEqual(sum, result.totalWindows, 'Counts should sum to total');

        console.log('✓ Test 1: Calibration aggregates correctly');
    })();
}

// Test 2: Advisory logging is side-effect free
{
    const { deriveExecutionHealthStatus } = require('../../src/execution/executionHealthAdvisor');

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

    // Call advisor
    const advisory = deriveExecutionHealthStatus(healthSummary);

    // Verify it returns expected structure but doesn't mutate input
    assert.ok(advisory, 'Should return advisory');
    assert.ok(advisory.level, 'Should have level');
    assert.strictEqual(healthSummary.global.fillRate, 0.85, 'Should not mutate input');

    // Verify no global state changes
    const advisory2 = deriveExecutionHealthStatus(healthSummary);
    assert.strictEqual(advisory.level, advisory2.level, 'Should be deterministic');

    console.log('✓ Test 2: Advisory logging is side-effect free');
}

setTimeout(() => {
    console.log('\n=== All calibration tests passed ===\n');
}, 1000);
