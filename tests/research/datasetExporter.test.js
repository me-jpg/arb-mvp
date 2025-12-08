/**
 * tests/research/datasetExporter.test.js
 */

const assert = require('assert');
const { filterRows, toCsv } = require('../../src/research/datasetExporter');

console.log('=== datasetExporter.test.js ===\n');

// Mock dataset rows
const mockRows = [
    {
        eventId: 'e1',
        signalId: 's1',
        book: 'draftkings',
        strategyId: 'strat1',
        edgeEstimate: 2.5,
        filledStake: 100,
        realizedProfit: 5
    },
    {
        eventId: 'e2',
        signalId: 's2',
        book: 'betmgm',
        strategyId: 'strat2',
        edgeEstimate: -1.0,
        filledStake: 50,
        realizedProfit: -2
    },
    {
        eventId: 'e3',
        signalId: 's3',
        book: 'draftkings',
        strategyId: 'strat1',
        edgeEstimate: 1.0,
        filledStake: 0,
        realizedProfit: null
    },
    {
        eventId: 'e4',
        signalId: 's4',
        book: 'espnbet',
        strategyId: 'strat3',
        edgeEstimate: null,
        filledStake: 75,
        realizedProfit: 3
    }
];

// Test 1: Filter by books
{
    const result = filterRows(mockRows, { books: ['draftkings'] });
    assert.strictEqual(result.length, 2, 'Should filter to draftkings only');
    assert.ok(result.every(r => r.book === 'draftkings'), 'All rows should be draftkings');

    const multiBook = filterRows(mockRows, { books: ['draftkings', 'betmgm'] });
    assert.strictEqual(multiBook.length, 3, 'Should include both books');

    console.log('✓ Test 1: Filter by books');
}

// Test 2: Filter by strategies
{
    const result = filterRows(mockRows, { strategies: ['strat1'] });
    assert.strictEqual(result.length, 2, 'Should filter to strat1 only');
    assert.ok(result.every(r => r.strategyId === 'strat1'), 'All rows should be strat1');

    console.log('✓ Test 2: Filter by strategies');
}

// Test 3: Filter by minEdge
{
    const result = filterRows(mockRows, { minEdge: 1.0 });
    assert.strictEqual(result.length, 2, 'Should include edges >= 1.0');
    assert.ok(result.every(r => r.edgeEstimate >= 1.0), 'All edges should be >= 1.0');

    console.log('✓ Test 3: Filter by minEdge');
}

// Test 4: Filter by hasExecution
{
    const result = filterRows(mockRows, { hasExecution: true });
    assert.strictEqual(result.length, 3, 'Should require non-zero filledStake');
    assert.ok(result.every(r => r.filledStake > 0), 'All should have execution');

    console.log('✓ Test 4: Filter by hasExecution');
}

// Test 5: Filter by hasResult
{
    const result = filterRows(mockRows, { hasResult: true });
    assert.strictEqual(result.length, 3, 'Should require non-null realizedProfit');
    assert.ok(result.every(r => r.realizedProfit !== null), 'All should have result');

    console.log('✓ Test 5: Filter by hasResult');
}

// Test 6: Combined filters
{
    const result = filterRows(mockRows, {
        books: ['draftkings'],
        hasExecution: true,
        minEdge: 2.0
    });
    assert.strictEqual(result.length, 1, 'Should apply all filters');
    assert.strictEqual(result[0].signalId, 's1', 'Should be the correct row');

    console.log('✓ Test 6: Combined filters');
}

// Test 7: CSV header generation
{
    const fields = ['eventId', 'book', 'edgeEstimate'];
    const csv = toCsv(mockRows.slice(0, 1), fields);
    const lines = csv.split('\n');

    assert.strictEqual(lines[0], 'eventId,book,edgeEstimate', 'Header should match fields');
    assert.strictEqual(lines.length, 2, 'Should have header + 1 data row');

    console.log('✓ Test 7: CSV header generation');
}

// Test 8: CSV null handling
{
    const fields = ['signalId', 'realizedProfit'];
    const csv = toCsv([mockRows[2]], fields); // Row with null realizedProfit
    const lines = csv.split('\n');

    assert.strictEqual(lines[1], 's3,', 'Null should be empty cell');

    console.log('✓ Test 8: CSV null handling');
}

// Test 9: CSV escaping - commas
{
    const testRows = [{
        eventId: 'e1',
        description: 'Game on Dec 1, 2024'
    }];
    const csv = toCsv(testRows, ['eventId', 'description']);
    const lines = csv.split('\n');

    assert.ok(lines[1].includes('"Game on Dec 1, 2024"'), 'Should quote field with comma');

    console.log('✓ Test 9: CSV escaping - commas');
}

// Test 10: CSV escaping - quotes
{
    const testRows = [{
        eventId: 'e1',
        description: 'Team "Eagles" vs Team "Hawks"'
    }];
    const csv = toCsv(testRows, ['eventId', 'description']);
    const lines = csv.split('\n');

    // Quotes should be doubled and field quoted
    assert.ok(lines[1].includes('""Eagles""'), 'Should double quotes inside field');

    console.log('✓ Test 10: CSV escaping - quotes');
}

// Test 11: Empty filter (no filtering)
{
    const result = filterRows(mockRows, {});
    assert.strictEqual(result.length, mockRows.length, 'No filters should return all rows');

    console.log('✓ Test 11: Empty filter');
}

console.log('\n=== All dataset exporter tests passed ===\n');
