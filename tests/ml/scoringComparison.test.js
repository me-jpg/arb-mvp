/**
 * tests/ml/scoringComparison.test.js
 */

const assert = require('assert');
const { compareScoringModes } = require('../../src/ml/scoringComparison');

console.log('=== scoringComparison.test.js ===\n');

// Test 1: Empty dataset
{
    (async () => {
        const result = await compareScoringModes([], { modes: [] });

        assert.strictEqual(result.dataset.rows, 0, 'Should have 0 rows');
        assert.strictEqual(result.dataset.labeled, 0, 'Should have 0 labeled');
        assert.strictEqual(result.modes.length, 0, 'Should have 0 modes');

        console.log('✓ Test 1: Empty dataset');
    })();
}

// Test 2: Simple synthetic dataset with baseline mode
{
    (async () => {
        // Create synthetic rows
        const rows = [
            { edgeEstimate: 0.05, outcome: 'win', stake: 50 },
            { edgeEstimate: 0.03, outcome: 'win', stake: 50 },
            { edgeEstimate: 0.02, outcome: 'loss', stake: 50 },
            { edgeEstimate: 0.04, outcome: 'win', stake: 50 },
            { edgeEstimate: 0.01, outcome: 'loss', stake: 50 },
            { edgeEstimate: 0.06, outcome: 'win', stake: 50 },
            { edgeEstimate: 0.02, outcome: 'loss', stake: 50 },
            { edgeEstimate: 0.05, outcome: 'win', stake: 50 },
            { edgeEstimate: 0.03, outcome: 'win', stake: 50 },
            { edgeEstimate: 0.01, outcome: 'loss', stake: 50 }
        ];

        const modes = [
            { id: 'baseline', mode: 'baseline' }
        ];

        const result = await compareScoringModes(rows, {
            labelType: 'binary_win',
            minStake: 0,
            testRatio: 0.3,
            modes
        });

        assert.strictEqual(result.dataset.rows, 10, 'Should have 10 rows');
        assert.ok(result.dataset.labeled > 0, 'Should have labeled examples');
        assert.strictEqual(result.modes.length, 1, 'Should have 1 mode');

        const mode = result.modes[0];
        assert.strictEqual(mode.id, 'baseline', 'Should be baseline mode');
        assert.ok(typeof mode.avgScore === 'number', 'Should have avgScore');
        assert.ok(typeof mode.avgLabel === 'number', 'Should have avgLabel');
        assert.ok(typeof mode.correlation === 'number', 'Should have correlation');
        assert.strictEqual(mode.buckets.length, 5, 'Should have 5 buckets');

        console.log('✓ Test 2: Simple synthetic dataset with baseline mode');
    })();
}

// Test 3: Multiple modes comparison
{
    (async () => {
        const rows = [];
        for (let i = 0; i < 20; i++) {
            rows.push({
                edgeEstimate: 0.02 + (i * 0.002),
                bookAvgLagMs: 100 + (i * 10),
                outcome: i % 3 === 0 ? 'loss' : 'win',
                stake: 50
            });
        }

        const modes = [
            { id: 'baseline', mode: 'baseline' },
            { id: 'edge_plus_latency', mode: 'edge_plus_latency' }
        ];

        const result = await compareScoringModes(rows, {
            labelType: 'binary_win',
            minStake: 0,
            testRatio: 0.25,
            modes
        });

        assert.strictEqual(result.modes.length, 2, 'Should have 2 modes');
        assert.strictEqual(result.modes[0].id, 'baseline', 'First mode should be baseline');
        assert.strictEqual(result.modes[1].id, 'edge_plus_latency', 'Second mode should be edge_plus_latency');

        // Both should have metrics
        for (const mode of result.modes) {
            assert.ok(!mode.error, `Mode ${mode.id} should not have error`);
            assert.ok(typeof mode.avgScore === 'number', `Mode ${mode.id} should have avgScore`);
            assert.ok(mode.buckets.length === 5, `Mode ${mode.id} should have 5 buckets`);
        }

        console.log('✓ Test 3: Multiple modes comparison');
    })();
}

// Test 4: Bucket calculation
{
    (async () => {
        const rows = [];
        // Create examples that will fall into different buckets
        for (let i = 0; i < 10; i++) {
            rows.push({
                edgeEstimate: i * 0.1, // 0.0 to 0.9
                outcome: i >= 5 ? 'win' : 'loss', // Labels: 0,0,0,0,0,1,1,1,1,1
                stake: 50
            });
        }

        const modes = [
            { id: 'baseline', mode: 'baseline' }
        ];

        const result = await compareScoringModes(rows, {
            labelType: 'binary_win',
            minStake: 0,
            testRatio: 0.3,
            modes
        });

        const mode = result.modes[0];

        // Check that buckets have counts
        const totalCount = mode.buckets.reduce((sum, b) => sum + b.count, 0);
        assert.ok(totalCount > 0, 'Buckets should have total count > 0');

        // Each bucket should have valid avgLabel (0 to 1)
        for (const bucket of mode.buckets) {
            if (bucket.count > 0) {
                assert.ok(bucket.avgLabel >= 0 && bucket.avgLabel <= 1, 'avgLabel should be in [0,1]');
            }
        }

        console.log('✓ Test 4: Bucket calculation');
    })();
}

// Wait for all async tests
setTimeout(() => {
    console.log('\n=== All scoring comparison tests passed ===\n');
}, 1000);
