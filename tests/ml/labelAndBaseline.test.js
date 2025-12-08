/**
 * tests/ml/labelAndBaseline.test.js
 */

const assert = require('assert');
const { buildLabelsFromRows } = require('../../src/ml/labelBuilder');
const { trainTestSplit, shuffleWithSeed } = require('../../src/ml/trainTestSplitter');
const { evaluateBaseline } = require('../../src/ml/baselineEvaluator');

console.log('=== labelAndBaseline.test.js ===\n');

// Mock dataset rows
const mockRows = [
    { signalId: 's1', realizedProfit: 5, edgeEstimate: 2.5, stakePlanned: 100, bookAvgLagMs: 200 },
    { signalId: 's2', realizedProfit: -3, edgeEstimate: -1.0, stakePlanned: 50, bookAvgLagMs: 150 },
    { signalId: 's3', realizedProfit: 10, edgeEstimate: 3.0, stakePlanned: 75, bookAvgLagMs: 180 },
    { signalId: 's4', realizedProfit: 0, edgeEstimate: 0.5, stakePlanned: 100, bookAvgLagMs: 220 }, // Push - should be skipped
    { signalId: 's5', realizedProfit: -2, edgeEstimate: 1.0, stakePlanned: 25, bookAvgLagMs: 300 },
    { signalId: 's6', realizedProfit: 8, edgeEstimate: null, stakePlanned: 60, bookAvgLagMs: 250 }
];

// Test 1: buildLabelsFromRows - binary_win
{
    const examples = buildLabelsFromRows(mockRows, { labelType: 'binary_win' });

    // Should have 5 examples (all except s4 which is a push)
    assert.ok(examples.length === 5, `Should have 5 examples, got ${examples.length}`);

    // Check s1 - win
    const s1 = examples.find(e => e.id === 's1');
    assert.ok(s1, 's1 should exist');
    assert.strictEqual(s1.label, 1, 's1 should have label 1 (win)');
    assert.strictEqual(s1.features.edgeEstimate, 2.5, 'Edge should be preserved');

    // Check s2 - loss
    const s2 = examples.find(e => e.id === 's2');
    assert.ok(s2, 's2 should exist');
    assert.strictEqual(s2.label, 0, 's2 should have label 0 (loss)');

    // Check s4 - push (should be excluded)
    const s4 = examples.find(e => e.id === 's4');
    assert.strictEqual(s4, undefined, 's4 (push) should be excluded');

    console.log('✓ Test 1: buildLabelsFromRows - binary_win');
}

// Test 2: buildLabelsFromRows - edge_sign
{
    const examples = buildLabelsFromRows(mockRows, { labelType: 'edge_sign' });

    // Should have 5 examples (all except s6 which has null edge)
    assert.ok(examples.length === 5, `Should have 5 examples, got ${examples.length}`);

    // s1 - positive edge
    const s1 = examples.find(e => e.id === 's1');
    assert.ok(s1, 's1 should exist');
    assert.strictEqual(s1.label, 1, 's1 should have label 1 (positive edge)');

    // s2 - negative edge
    const s2 = examples.find(e => e.id === 's2');
    assert.ok(s2, 's2 should exist');
    assert.strictEqual(s2.label, -1, 's2 should have label -1 (negative edge)');

    // s6 - null edge (should be excluded)
    const s6 = examples.find(e => e.id === 's6');
    assert.strictEqual(s6, undefined, 's6 should be excluded (null edge)');

    console.log('✓ Test 2: buildLabelsFromRows - edge_sign');
}

// Test 3: trainTestSplit - deterministic shuffle
{
    const examples = buildLabelsFromRows(mockRows, { labelType: 'binary_win' });

    const split1 = trainTestSplit(examples, { testRatio: 0.2, shuffleSeed: 42 });
    const split2 = trainTestSplit(examples, { testRatio: 0.2, shuffleSeed: 42 });

    // Should be deterministic
    assert.strictEqual(split1.train.length, split2.train.length, 'Train size should be consistent');
    assert.strictEqual(split1.test.length, split2.test.length, 'Test size should be consistent');
    assert.strictEqual(split1.train[0].id, split2.train[0].id, 'First train example should be same');

    console.log('✓ Test 3: trainTestSplit - deterministic shuffle');
}

// Test 4: trainTestSplit - test ratio
{
    const examples = buildLabelsFromRows(mockRows, { labelType: 'binary_win' });

    const split = trainTestSplit(examples, { testRatio: 0.3 });

    const totalSize = split.train.length + split.test.length;
    const testRatio = split.test.length / totalSize;

    assert.ok(Math.abs(testRatio - 0.3) < 0.15, 'Test ratio should be approximately 0.3');
    assert.strictEqual(totalSize, examples.length, 'Total should equal input size');

    console.log('✓ Test 4: trainTestSplit - test ratio');
}

// Test 5: evaluateBaseline - metrics calculation
{
    const syntheticExamples = [
        { id: 'e1', features: { edgeEstimate: 2.0 }, label: 1 },  // Positive edge, win
        { id: 'e2', features: { edgeEstimate: -1.0 }, label: 0 }, // Negative edge, loss
        { id: 'e3', features: { edgeEstimate: 1.5 }, label: 1 },  // Positive edge, win
        { id: 'e4', features: { edgeEstimate: -0.5 }, label: 0 }, // Negative edge, loss
        { id: 'e5', features: { edgeEstimate: 3.0 }, label: 0 }   // Positive edge, loss (wrong)
    ];

    const metrics = evaluateBaseline(syntheticExamples);

    assert.strictEqual(metrics.count, 5, 'Count should be 5');

    // avgEdge = (2.0 - 1.0 + 1.5 - 0.5 + 3.0) / 5 = 5.0 / 5 = 1.0
    assert.ok(Math.abs(metrics.avgEdge - 1.0) < 0.01, `avgEdge should be ~1.0, got ${metrics.avgEdge}`);

    // positiveRate = 2 / 5 = 0.4
    assert.ok(Math.abs(metrics.positiveRate - 0.4) < 0.01, `positiveRate should be ~0.4, got ${metrics.positiveRate}`);

    // edgeDirectionAccuracy = 4 / 5 = 0.8 (e1, e2, e3, e4 correct; e5 wrong)
    assert.ok(Math.abs(metrics.edgeDirectionAccuracy - 0.8) < 0.01, `edgeDirectionAccuracy should be ~0.8, got ${metrics.edgeDirectionAccuracy}`);

    console.log('✓ Test 5: evaluateBaseline - metrics calculation');
}

// Test 6: evaluateBaseline - empty input
{
    const metrics = evaluateBaseline([]);

    assert.strictEqual(metrics.count, 0, 'Count should be 0');
    assert.strictEqual(metrics.avgEdge, null, 'avgEdge should be null');
    assert.strictEqual(metrics.positiveRate, null, 'positiveRate should be null');
    assert.strictEqual(metrics.edgeDirectionAccuracy, null, 'edgeDirectionAccuracy should be null');

    console.log('✓ Test 6: evaluateBaseline - empty input');
}

console.log('\n=== All ML label and baseline tests passed ===\n');
