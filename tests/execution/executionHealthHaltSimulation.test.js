/**
 * tests/execution/executionHealthHaltSimulation.test.js
 */

const assert = require('assert');
const { calibrateHealthThresholds } = require('../../src/execution/run-execution-health-calibration');

console.log('=== executionHealthHaltSimulation.test.js ===\n');

// Test 1: Simulation disabled - no halt simulation output
{
    (async () => {
        const result = await calibrateHealthThresholds({
            limit: 100,
            windowMinutes: 10,
            simulateHalt: false
        });

        assert.ok(result, 'Should return result');
        assert.ok(typeof result.totalWindows === 'number', 'Should have totalWindows');
        assert.ok(typeof result.okCount === 'number', 'Should have okCount');
        assert.strictEqual(result.haltSimulation, undefined, 'Should NOT have haltSimulation when disabled');

        console.log('✓ Test 1: Simulation disabled - no halt simulation output');
    })();
}

// Test 2: Simulation enabled - includes halt simulation data
{
    (async () => {
        const result = await calibrateHealthThresholds({
            limit: 100,
            windowMinutes: 10,
            simulateHalt: true
        });

        assert.ok(result.haltSimulation, 'Should have haltSimulation when enabled');
        assert.ok(typeof result.haltSimulation.totalWindows === 'number', 'Should have totalWindows');
        assert.ok(typeof result.haltSimulation.wouldHaveHaltedCount === 'number', 'Should have wouldHaveHaltedCount');
        assert.ok(typeof result.haltSimulation.haltPercentage === 'number', 'Should have haltPercentage');
        assert.ok(result.haltSimulation.thresholds, 'Should have thresholds');

        console.log('✓ Test 2: Simulation enabled - includes halt simulation data');
    })();
}

// Test 3: Threshold reflection
{
    (async () => {
        const result = await calibrateHealthThresholds({
            limit: 100,
            windowMinutes: 10,
            simulateHalt: true
        });

        assert.ok(result.haltSimulation.thresholds.rejectRate, 'Should have rejectRate thresholds');
        assert.ok(result.haltSimulation.thresholds.globalFillRate, 'Should have globalFillRate thresholds');
        assert.ok(result.haltSimulation.thresholds.unknownStatusRatio, 'Should have unknownStatusRatio threshold');
        assert.ok(result.haltSimulation.thresholds.invalidTimestampRatio, 'Should have invalidTimestampRatio threshold');

        assert.ok(typeof result.haltSimulation.thresholds.rejectRate.halt === 'number', 'rejectRate.halt should be a number');
        assert.ok(typeof result.haltSimulation.thresholds.globalFillRate.critical === 'number', 'globalFillRate.critical should be a number');

        console.log('✓ Test 3: Threshold reflection includes all required thresholds');
    })();
}

// Test 4: Determinism
{
    (async () => {
        const result1 = await calibrateHealthThresholds({
            limit: 50,
            windowMinutes: 5,
            simulateHalt: true
        });

        const result2 = await calibrateHealthThresholds({
            limit: 50,
            windowMinutes: 5,
            simulateHalt: true
        });

        // Should be deterministic (same data, same results)
        assert.strictEqual(result1.haltSimulation.wouldHaveHaltedCount, result2.haltSimulation.wouldHaveHaltedCount, 'Should be deterministic');
        assert.strictEqual(result1.haltSimulation.haltPercentage, result2.haltSimulation.haltPercentage, 'Percentage should be deterministic');

        console.log('✓ Test 4: Deterministic - same inputs yield same outputs');
    })();
}

// Test 5: Percentage calculation
{
    (async () => {
        const result = await calibrateHealthThresholds({
            limit: 100,
            windowMinutes: 10,
            simulateHalt: true
        });

        // Verify percentage is correctly calculated
        if (result.haltSimulation.totalWindows > 0) {
            const expectedPct = (result.haltSimulation.wouldHaveHaltedCount / result.haltSimulation.totalWindows) * 100;
            assert.strictEqual(result.haltSimulation.haltPercentage, expectedPct, 'Percentage should be correctly calculated');
        }

        console.log('✓ Test 5: Percentage calculation is correct');
    })();
}

setTimeout(() => {
    console.log('\n=== All halt simulation tests passed ===\n');
}, 2000);
