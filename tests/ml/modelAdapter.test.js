/**
 * tests/ml/modelAdapter.test.js
 */

const assert = require('assert');
const { scoreExample, scoreBatch } = require('../../src/ml/modelAdapter');

console.log('=== modelAdapter.test.js ===\n');

// Test 1: baseline mode - score == edge
{
    const example = {
        id: 'test1',
        features: {
            edgeEstimate: 2.5,
            bookAvgLagMs: 100,
            marketVolatilityScore: 50
        }
    };

    const result = scoreExample(example, { mode: 'baseline' });

    assert.strictEqual(result.id, 'test1', 'ID should be preserved');
    assert.strictEqual(result.score, 2.5, 'Score should equal edge in baseline mode');
    assert.deepStrictEqual(result.rawFeatures, example.features, 'Raw features should be preserved');

    console.log('✓ Test 1: baseline mode - score == edge');
}

// Test 2: edge_plus_latency mode - score decreases with lag
{
    const example1 = {
        id: 'test2a',
        features: {
            edgeEstimate: 3.0,
            bookAvgLagMs: 0,
            marketVolatilityScore: 0
        }
    };

    const example2 = {
        id: 'test2b',
        features: {
            edgeEstimate: 3.0,
            bookAvgLagMs: 1000, // 1 second lag
            marketVolatilityScore: 0
        }
    };

    const result1 = scoreExample(example1, { mode: 'edge_plus_latency' });
    const result2 = scoreExample(example2, { mode: 'edge_plus_latency' });

    assert.strictEqual(result1.score, 3.0, 'No lag should give full edge score');
    assert.ok(result2.score < result1.score, 'Higher lag should decrease score');
    assert.ok(Math.abs(result2.score - (3.0 - 1.0)) < 0.01, 'Score should be ~2.0 with default latency coef');

    console.log('✓ Test 2: edge_plus_latency mode - score decreases with lag');
}

// Test 3: experimental mode - score responds to volatility
{
    const example1 = {
        id: 'test3a',
        features: {
            edgeEstimate: 2.0,
            bookAvgLagMs: 0,
            marketVolatilityScore: 0
        }
    };

    const example2 = {
        id: 'test3b',
        features: {
            edgeEstimate: 2.0,
            bookAvgLagMs: 0,
            marketVolatilityScore: 100 // High volatility
        }
    };

    const result1 = scoreExample(example1, { mode: 'experimental' });
    const result2 = scoreExample(example2, { mode: 'experimental' });

    assert.strictEqual(result1.score, 2.0, 'No volatility should give base edge score');
    assert.ok(result2.score > result1.score, 'Higher volatility should increase score');

    console.log('✓ Test 3: experimental mode - score responds to volatility');
}

// Test 4: custom weights
{
    const example = {
        id: 'test4',
        features: {
            edgeEstimate: 3.0,
            bookAvgLagMs: 500,
            marketVolatilityScore: 0
        }
    };

    const result1 = scoreExample(example, { mode: 'edge_plus_latency' });
    const result2 = scoreExample(example, { mode: 'edge_plus_latency', weights: { latencyCoef: 0.002 } });

    assert.ok(result2.score < result1.score, 'Higher latency coefficient should penalize more');

    console.log('✓ Test 4: custom weights');
}

// Test 5: scoreBatch preserves order
{
    const examples = [
        { id: 's1', features: { edgeEstimate: 1.0 } },
        { id: 's2', features: { edgeEstimate: 2.0 } },
        { id: 's3', features: { edgeEstimate: 3.0 } }
    ];

    const results = scoreBatch(examples, { mode: 'baseline' });

    assert.strictEqual(results.length, 3, 'Should return same number of results');
    assert.strictEqual(results[0].id, 's1', 'Order should be preserved');
    assert.strictEqual(results[1].id, 's2', 'Order should be preserved');
    assert.strictEqual(results[2].id, 's3', 'Order should be preserved');
    assert.strictEqual(results[0].score, 1.0, 'Scores should match');
    assert.strictEqual(results[1].score, 2.0, 'Scores should match');
    assert.strictEqual(results[2].score, 3.0, 'Scores should match');

    console.log('✓ Test 5: scoreBatch preserves order');
}

// Test 6: deterministic behavior
{
    const example = {
        id: 'test6',
        features: {
            edgeEstimate: 2.5,
            bookAvgLagMs: 250,
            marketVolatilityScore: 75
        }
    };

    const result1 = scoreExample(example, { mode: 'edge_plus_latency' });
    const result2 = scoreExample(example, { mode: 'edge_plus_latency' });
    const result3 = scoreExample(example, { mode: 'edge_plus_latency' });

    assert.strictEqual(result1.score, result2.score, 'Should be deterministic');
    assert.strictEqual(result2.score, result3.score, 'Should be deterministic');

    console.log('✓ Test 6: deterministic behavior');
}

console.log('\n=== All model adapter tests passed ===\n');
