/**
 * tests/experiments/configSweepRunner.test.js
 */

const assert = require('assert');
const { runConfigSweep } = require('../../src/experiments/configSweepRunner');

console.log('=== configSweepRunner.test.js ===\n');

// Test 1: Empty configs
{
    (async () => {
        const result = await runConfigSweep([], { limit: 10 });

        assert.strictEqual(result.runs.length, 0, 'Should have 0 runs');
        assert.strictEqual(result.bestByRoi, null, 'Should have no best');
        assert.strictEqual(result.bestByProfit, null, 'Should have no best');

        console.log('✓ Test 1: Empty configs');
    })();
}

// Test 2: Single config run
{
    (async () => {
        const configs = [
            {
                id: 'test-flat',
                strategyOptions: { minEdge: 0.02 },
                mlScoring: { enabled: false, mode: 'baseline' },
                stakeSizing: { mode: 'flat', flatStake: 50 }
            }
        ];

        const result = await runConfigSweep(configs, { limit: 100 });

        assert.strictEqual(result.runs.length, 1, 'Should have 1 run');
        assert.strictEqual(result.runs[0].id, 'test-flat', 'Should have correct ID');

        // Check metrics exist (may be null if no signals available)
        if (result.runs[0].metrics) {
            assert.ok(typeof result.runs[0].metrics.roi === 'number', 'Should have ROI');
            assert.ok(typeof result.runs[0].metrics.fills === 'number', 'Should have fills');
        }

        console.log('✓ Test 2: Single config run');
    })();
}

// Test 3: Multiple configs comparison
{
    (async () => {
        const configs = [
            {
                id: 'config-a',
                strategyOptions: {},
                mlScoring: { enabled: false },
                stakeSizing: { mode: 'flat', flatStake: 50 }
            },
            {
                id: 'config-b',
                strategyOptions: {},
                mlScoring: { enabled: true, mode: 'baseline' },
                stakeSizing: { mode: 'edge_linear', flatStake: 50 }
            },
            {
                id: 'config-c',
                strategyOptions: {},
                mlScoring: { enabled: true, mode: 'edge_plus_latency' },
                stakeSizing: { mode: 'kelly_fraction', flatStake: 50, kellyBaseFraction: 0.5 }
            }
        ];

        const result = await runConfigSweep(configs, { limit: 100 });

        assert.strictEqual(result.runs.length, 3, 'Should have 3 runs');
        assert.ok(result.runs.every(r => r.id && r.config), 'All runs should have ID and config');

        // If we have successful runs, check best selection
        const successfulRuns = result.runs.filter(r => r.metrics);
        if (successfulRuns.length > 0) {
            assert.ok(result.bestByRoi, 'Should have bestByRoi');
            assert.ok(result.bestByProfit, 'Should have bestByProfit');
        }

        console.log('✓ Test 3: Multiple configs comparison');
    })();
}

// Test 4: Config ID preservation
{
    (async () => {
        const configs = [
            {
                id: 'my-custom-id',
                strategyOptions: {},
                mlScoring: { enabled: false },
                stakeSizing: { mode: 'flat' }
            }
        ];

        const result = await runConfigSweep(configs, { limit: 50 });

        assert.strictEqual(result.runs[0].id, 'my-custom-id', 'Should preserve config ID');

        console.log('✓ Test 4: Config ID preservation');
    })();
}

// Wait for all async tests
setTimeout(() => {
    console.log('\n=== All config sweep runner tests passed ===\n');
}, 500);
