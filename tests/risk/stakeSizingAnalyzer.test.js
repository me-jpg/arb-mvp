/**
 * tests/risk/stakeSizingAnalyzer.test.js
 */

const assert = require('assert');
const { analyzeStakeSizingFromExecutions } = require('../../src/risk/stakeSizingAnalyzer');

console.log('=== stakeSizingAnalyzer.test.js ===\n');

// Test 1: Empty inputs
{
    const result = analyzeStakeSizingFromExecutions({});

    assert.strictEqual(result.overall.count, 0, 'Should have 0 fills');
    assert.strictEqual(result.overall.totalStake, 0, 'Should have 0 stake');
    assert.deepStrictEqual(result.modes, {}, 'Should have no modes');

    console.log('✓ Test 1: Empty inputs');
}

// Test 2: Basic flat mode analysis
{
    const signals = [
        { id: 's1', edgeEstimate: 0.03 }
    ];

    const executionEvents = [
        {
            sourceSignalId: 's1',
            status: 'filled',
            stake: 50,
            filledStake: 50,
            eventId: 'game1',
            metadata: { stakeSizing: { mode: 'flat' } }
        }
    ];

    const results = {
        game1: { score: 1 } // Win
    };

    const analysis = analyzeStakeSizingFromExecutions({ signals, executionEvents, results });

    assert.strictEqual(analysis.overall.count, 1, 'Should have 1 fill');
    assert.strictEqual(analysis.overall.totalStake, 50, 'Should have 50 total stake');
    assert.ok(analysis.overall.realizedProfit > 0, 'Should have positive profit on win');

    assert.ok(analysis.modes.flat, 'Should have flat mode');
    assert.strictEqual(analysis.modes.flat.count, 1, 'Flat mode should have 1 fill');
    assert.strictEqual(analysis.modes.flat.avgStake, 50, 'Flat mode avg stake should be 50');
    assert.ok(analysis.modes.flat.hitRate === 1, 'Hit rate should be 100%');

    console.log('✓ Test 2: Basic flat mode analysis');
}

// Test 3: Multiple modes with wins/losses
{
    const signals = [
        { id: 's1', edgeEstimate: 0.03 },
        { id: 's2', edgeEstimate: 0.04, mlScore: 0.05 },
        { id: 's3', edgeEstimate: 0.02 }
    ];

    const executionEvents = [
        {
            sourceSignalId: 's1',
            status: 'filled',
            filledStake: 50,
            eventId: 'game1',
            metadata: { stakeSizing: { mode: 'flat' } }
        },
        {
            sourceSignalId: 's2',
            status: 'filled',
            filledStake: 75,
            eventId: 'game2',
            metadata: { stakeSizing: { mode: 'edge_linear' } }
        },
        {
            sourceSignalId: 's3',
            status: 'filled',
            filledStake: 100,
            eventId: 'game3',
            metadata: { stakeSizing: { mode: 'kelly_fraction' } }
        }
    ];

    const results = {
        game1: { score: 1 },   // Win
        game2: { score: 0 },   // Loss
        game3: { score: 1 }    // Win
    };

    const analysis = analyzeStakeSizingFromExecutions({ signals, executionEvents, results });

    assert.strictEqual(analysis.overall.count, 3, 'Should have 3 fills');
    assert.strictEqual(Object.keys(analysis.modes).length, 3, 'Should have 3 modes');

    // Check each mode exists
    assert.ok(analysis.modes.flat, 'Should have flat mode');
    assert.ok(analysis.modes.edge_linear, 'Should have edge_linear mode');
    assert.ok(analysis.modes.kelly_fraction, 'Should have kelly_fraction mode');

    // Check edge_linear has loss
    assert.ok(analysis.modes.edge_linear.realizedProfit < 0, 'edge_linear should have negative profit');

    // Check ML score aggregation
    assert.ok(analysis.modes.edge_linear.avgMlScore !== null, 'Should have avgMlScore');

    console.log('✓ Test 3: Multiple modes with wins/losses');
}

// Test 4: Unknown mode grouping
{
    const signals = [];

    const executionEvents = [
        {
            status: 'filled',
            filledStake: 50,
            eventId: 'game1',
            // No stakeSizing metadata
        }
    ];

    const results = {
        game1: { score: 1 }
    };

    const analysis = analyzeStakeSizingFromExecutions({ signals, executionEvents, results });

    assert.ok(analysis.modes.unknown, 'Should have unknown mode');
    assert.strictEqual(analysis.modes.unknown.count, 1, 'Unknown mode should have 1 fill');

    console.log('✓ Test 4: Unknown mode grouping');
}

// Test 5: ROI calculation
{
    const signals = [];

    const executionEvents = [
        { status: 'filled', filledStake: 100, eventId: 'game1', metadata: { stakeSizing: { mode: 'test' } } },
        { status: 'filled', filledStake: 100, eventId: 'game2', metadata: { stakeSizing: { mode: 'test' } } }
    ];

    const results = {
        game1: { score: 1 },  // Win, profit ~100 (assuming 2.0 odds)
        game2: { score: 0 }   // Loss, profit -100
    };

    const analysis = analyzeStakeSizingFromExecutions({ signals, executionEvents, results });

    assert.strictEqual(analysis.modes.test.totalStake, 200, 'Total stake should be 200');
    // Profit should be close to 0 (1 win, 1 loss)
    assert.ok(Math.abs(analysis.modes.test.roi) < 0.1, 'ROI should be near 0');
    assert.strictEqual(analysis.modes.test.hitRate, 0.5, 'Hit rate should be 50%');

    console.log('✓ Test 5: ROI calculation');
}

// Test 6: Only filled/partial orders analyzed
{
    const signals = [];

    const executionEvents = [
        { status: 'filled', filledStake: 50, eventId: 'game1', metadata: { stakeSizing: { mode: 'test' } } },
        { status: 'rejected', stake: 50, eventId: 'game2', metadata: { stakeSizing: { mode: 'test' } } },
        { status: 'blocked', stake: 50, eventId: 'game3', metadata: { stakeSizing: { mode: 'test' } } },
        { status: 'partial', filledStake: 30, eventId: 'game4', metadata: { stakeSizing: { mode: 'test' } } }
    ];

    const results = {
        game1: { score: 1 },
        game4: { score: 1 }
    };

    const analysis = analyzeStakeSizingFromExecutions({ signals, executionEvents, results });

    // Only filled and partial should be counted
    assert.strictEqual(analysis.overall.count, 2, 'Should only count filled/partial');
    assert.strictEqual(analysis.modes.test.count, 2, 'Mode should have 2 fills');

    console.log('✓ Test 6: Only filled/partial orders analyzed');
}

console.log('\n=== All stake sizing analyzer tests passed ===\n');
