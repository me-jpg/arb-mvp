/**
 * tests/research/reportGenerator.test.js
 */

const assert = require('assert');
const { summarizeByBook, summarizeByStrategy, summarizeEdgeCalibration } = require('../../src/research/reportGenerator');

console.log('=== reportGenerator.test.js ===\n');

// Mock dataset rows
const mockRows = [
    // Book A, Strategy 1, positive edge
    { book: 'bookA', strategyId: 'strat1', stakePlanned: 100, realizedProfit: 5, expectedValue: 4, edgeEstimate: 2.5 },
    { book: 'bookA', strategyId: 'strat1', stakePlanned: 100, realizedProfit: 6, expectedValue: 5, edgeEstimate: 3.0 },

    // Book B, Strategy 2, negative edge
    { book: 'bookB', strategyId: 'strat2', stakePlanned: 50, realizedProfit: -2, expectedValue: -1, edgeEstimate: -1.5 },

    // Book A, unknown strategy, no edge
    { book: 'bookA', strategyId: null, stakePlanned: 75, realizedProfit: 2, expectedValue: 0, edgeEstimate: null },

    // No stake (should be ignored)
    { book: 'bookC', strategyId: 'strat3', stakePlanned: 0, realizedProfit: 100, expectedValue: 100, edgeEstimate: 10 }
];

// Test 1: summarizeByBook
{
    const result = summarizeByBook(mockRows);

    // Book A: 3 rows, stake=275, profit=13
    assert.ok(result.bookA, 'bookA exists');
    assert.strictEqual(result.bookA.count, 3);
    assert.strictEqual(result.bookA.totalStake, 275);
    assert.strictEqual(result.bookA.realizedProfit, 13);
    assert.ok(Math.abs(result.bookA.roi - (13 / 275) * 100) < 0.1, 'ROI calculation');

    // avgEdge for bookA: (2.5 + 3.0) / 2 = 2.75 (third row has null edge)
    assert.ok(Math.abs(result.bookA.avgEdge - 2.75) < 0.01, 'avgEdge calculation');

    // Book B: 1 row
    assert.ok(result.bookB, 'bookB exists');
    assert.strictEqual(result.bookB.count, 1);
    assert.strictEqual(result.bookB.realizedProfit, -2);

    // Book C should not exist (zero stake)
    assert.strictEqual(result.bookC, undefined, 'bookC with zero stake ignored');

    console.log('✓ Test 1: summarizeByBook aggregation');
}

// Test 2: summarizeByStrategy
{
    const result = summarizeByStrategy(mockRows);

    // strat1: 2 rows
    assert.ok(result.strat1, 'strat1 exists');
    assert.strictEqual(result.strat1.count, 2);
    assert.strictEqual(result.strat1.totalStake, 200);
    assert.strictEqual(result.strat1.realizedProfit, 11);

    // strat2: 1 row
    assert.ok(result.strat2, 'strat2 exists');
    assert.strictEqual(result.strat2.count, 1);

    // unknown: 1 row (null strategyId)
    assert.ok(result.unknown, 'unknown strategy exists');
    assert.strictEqual(result.unknown.count, 1);
    assert.strictEqual(result.unknown.totalStake, 75);

    console.log('✓ Test 2: summarizeByStrategy aggregation');
}

// Test 3: summarizeEdgeCalibration
{
    const buckets = [-999, -2, 0, 2, 5, 999];
    const result = summarizeEdgeCalibration(mockRows, { buckets });

    // Check bucket structure
    assert.ok(Array.isArray(result), 'Returns array');
    assert.strictEqual(result.length, buckets.length - 1, 'Correct number of buckets');

    // Find [-2,0) bucket (should have edgeEstimate -1.5)
    const negBucket = result.find(b => b.bucketLabel === '[-2,0)');
    assert.ok(negBucket, 'Found negative bucket');
    assert.strictEqual(negBucket.count, 1);
    assert.strictEqual(negBucket.avgEdge, -1.5);

    // Find [2,5) bucket (should have 2.5 and 3.0)
    const posBucket = result.find(b => b.bucketLabel === '[2,5)');
    assert.ok(posBucket, 'Found positive bucket');
    assert.strictEqual(posBucket.count, 2);
    assert.ok(Math.abs(posBucket.avgEdge - 2.75) < 0.01, 'avgEdge in bucket');

    // Empty buckets should have count 0
    const emptyBucket = result.find(b => b.bucketLabel === '[5,999)' || b.bucketLabel === '>= 5');
    assert.strictEqual(emptyBucket.count, 0, 'Empty bucket count is 0');

    console.log('✓ Test 3: summarizeEdgeCalibration bucketing');
}

// Test 4: Edge cases - empty rows
{
    const result = summarizeByBook([]);
    assert.deepStrictEqual(result, {}, 'Empty input -> empty output');

    console.log('✓ Test 4: Empty input handling');
}

// Test 5: Missing fields
{
    const rowsWithMissing = [
        { book: 'bookX', stakePlanned: 100 }, // No profit, EV, edge
        { book: 'bookX', stakePlanned: 50, realizedProfit: null, expectedValue: null, edgeEstimate: undefined }
    ];

    const result = summarizeByBook(rowsWithMissing);
    assert.ok(result.bookX, 'bookX exists');
    assert.strictEqual(result.bookX.count, 2);
    assert.strictEqual(result.bookX.realizedProfit, 0, 'Missing profit treated as 0');
    assert.strictEqual(result.bookX.avgEdge, null, 'No edge data -> null avgEdge');

    console.log('✓ Test 5: Missing fields handling');
}

console.log('\n=== All report generator tests passed ===\n');
