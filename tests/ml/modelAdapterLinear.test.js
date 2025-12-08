/**
 * tests/ml/modelAdapterLinear.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { scoreExample, loadLinearModelSync, scoreLinearModel } = require('../../src/ml/modelAdapter');

console.log('=== modelAdapterLinear.test.js ===\n');

// Create a temp model for testing
const tempModelPath = path.join(__dirname, 'temp-test-model.json');
const tempModel = {
    id: 'test-model',
    features: {
        edgeEstimate: 2.0,
        bookAvgLagMs: -0.001,
        marketVolatilityScore: 0.01
    },
    bias: 0.5
};

// Write temp model
fs.writeFileSync(tempModelPath, JSON.stringify(tempModel, null, 2));

// Test 1: Load model successfully
{
    const model = loadLinearModelSync(tempModelPath);

    assert.ok(model, 'Should load model');
    assert.strictEqual(model.id, 'test-model', 'Should have correct ID');
    assert.ok(model.features, 'Should have features');
    assert.strictEqual(model.bias, 0.5, 'Should have bias');

    console.log('✓ Test 1: Load model successfully');
}

// Test 2: Model caching
{
    const model1 = loadLinearModelSync(tempModelPath);
    const model2 = loadLinearModelSync(tempModelPath);

    assert.strictEqual(model1, model2, 'Should return cached model');

    console.log('✓ Test 2: Model caching');
}

// Test 3: Score with linear model
{
    const example = {
        id: 'test1',
        features: {
            edgeEstimate: 0.05,
            bookAvgLagMs: 100,
            marketVolatilityScore: 50
        }
    };

    const result = scoreLinearModel(example, tempModel);

    assert.strictEqual(result.id, 'test1', 'Should preserve ID');
    assert.ok(typeof result.score === 'number', 'Should have score');
    assert.ok(typeof result.rawScore === 'number', 'Should have rawScore');

    // Calculate expected rawScore: 0.5 + (2.0 * 0.05) + (-0.001 * 100) + (0.01 * 50)
    // = 0.5 + 0.1 - 0.1 + 0.5 = 1.0
    const expectedRaw = 0.5 + (2.0 * 0.05) + (-0.001 * 100) + (0.01 * 50);
    assert.ok(Math.abs(result.rawScore - expectedRaw) < 0.01, `Raw score should be ~${expectedRaw}, got ${result.rawScore}`);

    // Score should be sigmoid(1.0) ≈ 0.731
    const expectedProb = 1 / (1 + Math.exp(-expectedRaw));
    assert.ok(Math.abs(result.score - expectedProb) < 0.01, `Score should be ~${expectedProb}, got ${result.score}`);

    console.log('✓ Test 3: Score with linear model');
}

// Test 4: Handle missing features
{
    const example = {
        id: 'test2',
        features: {
            edgeEstimate: 0.03
            // Missing other features
        }
    };

    const result = scoreLinearModel(example, tempModel);

    assert.ok(result.score, 'Should handle missing features');
    // rawScore should be: 0.5 + (2.0 * 0.03) = 0.56
    const expectedRaw = 0.5 + (2.0 * 0.03);
    assert.ok(Math.abs(result.rawScore - expectedRaw) < 0.01, 'Should use 0 for missing features');

    console.log('✓ Test 4: Handle missing features');
}

// Test 5: scoreExample with linear_model mode
{
    const example = {
        id: 'test3',
        features: {
            edgeEstimate: 0.04,
            bookAvgLagMs: 200
        }
    };

    const result = scoreExample(example, { mode: 'linear_model', modelPath: tempModelPath });

    assert.strictEqual(result.id, 'test3', 'Should preserve ID');
    assert.ok(typeof result.score === 'number', 'Should have score');
    assert.ok(result.rawScore !== undefined, 'Should have rawScore');

    console.log('✓ Test 5: scoreExample with linear_model mode');
}

// Test 6: Fallback on missing model
{
    const example = {
        id: 'test4',
        features: {
            edgeEstimate: 0.03
        }
    };

    const result = scoreExample(example, { mode: 'linear_model', modelPath: 'nonexistent.json' });

    assert.ok(result, 'Should not crash on missing model');
    // Should fallback to baseline which just returns edge
    assert.strictEqual(result.score, 0.03, 'Should fallback to baseline');

    console.log('✓ Test 6: Fallback on missing model');
}

// Test 7: Invalid model file
{
    const invalidPath = path.join(__dirname, 'invalid-model.json');
    fs.writeFileSync(invalidPath, 'invalid json{');

    const model = loadLinearModelSync(invalidPath);
    assert.strictEqual(model, null, 'Should return null for invalid JSON');

    fs.unlinkSync(invalidPath);

    console.log('✓ Test 7: Invalid model file');
}

// Cleanup
fs.unlinkSync(tempModelPath);

console.log('\n=== All linear model adapter tests passed ===\n');
