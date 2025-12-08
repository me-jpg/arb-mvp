/**
 * tests/research/datasetBuilder.test.js
 */

const assert = require('assert');
const { buildResearchDataset } = require('../../src/research/datasetBuilder');

console.log('=== datasetBuilder.test.js ===\n');

// Mock Data
const mockSignals = [
    {
        id: 'sig1',
        eventId: 'e1',
        primaryBook: 'bookA',
        marketType: 'moneyline',
        marketKey: 'k1',
        edgeEstimate: 0.05,
        createdAt: '2025-01-01T12:00:00Z'
    },
    {
        id: 'sig2',
        eventId: 'e2',
        primaryBook: 'bookB',
        marketType: 'spread',
        marketKey: 'k2',
        createdAt: '2025-01-01T12:05:00Z'
    }
];

const mockExecutions = [
    {
        signalId: 'sig1',
        orderId: 'ord1',
        amount: 50,
        filledAmount: 50,
        avgFillPrice: -110,
        status: 'filled',
        timestamp: '2025-01-01T12:00:01Z'
    }
];

const mockHfEvents = [
    { eventId: 'e1', book: 'bookA', timestamp: 1000, marketType: 'moneyline', marketKey: 'k1', oldPrice: 100, newPrice: 105 },
    { eventId: 'e1', book: 'bookC', timestamp: 200, marketType: 'moneyline', marketKey: 'k1', oldPrice: 100, newPrice: 105 }
];

const mockResults = new Map();
mockResults.set('e1', { final: { homeScore: 20, awayScore: 10 } });

// Test 1: Basic Join
{
    const rows = buildResearchDataset({
        signals: mockSignals,
        executions: mockExecutions,
        hfEvents: mockHfEvents,
        results: mockResults
    });

    assert.strictEqual(rows.length, 2, 'Should match signal count');

    // Row 1 (Full join)
    const r1 = rows.find(r => r.signalId === 'sig1');
    assert.ok(r1, 'Row for sig1 exists');
    assert.strictEqual(r1.filledStake, 50, 'Exec filled amount joined');
    assert.strictEqual(r1.fillStatus, 'filled');
    assert.strictEqual(r1.book, 'bookA');

    // Row 2 (No execution)
    const r2 = rows.find(r => r.signalId === 'sig2');
    assert.strictEqual(r2.filledStake, 0, 'No execution -> 0 filled');
    assert.strictEqual(r2.fillStatus, 'none');

    console.log('✓ Test 1: Signal+Execution Join');
}

// Test 2: Missing marketType/marketKey
{
    const signalsWithMissing = [
        { id: 'sig3', eventId: 'e3', primaryBook: 'bookX', createdAt: '2025-01-01T12:00:00Z' }
        // No marketType, no marketKey
    ];

    const rows = buildResearchDataset({
        signals: signalsWithMissing,
        executions: [],
        hfEvents: [],
        results: new Map()
    });

    assert.strictEqual(rows.length, 1);
    const r = rows[0];
    assert.strictEqual(r.marketType, null, 'Missing marketType should be null');
    assert.strictEqual(r.marketKey, null, 'Missing marketKey should be null');
    assert.strictEqual(r.marketVolatilityScore, null, 'No HF match -> null');

    console.log('✓ Test 2: Missing marketType/marketKey handling');
}

// Test 3: Invalid timestamps
{
    const signalsWithBadTimestamps = [
        { id: 'sig4', eventId: 'e4', primaryBook: 'bookY', createdAt: undefined },
        { id: 'sig5', eventId: 'e5', primaryBook: 'bookZ', createdAt: 'not-a-date' }
    ];

    // Should not throw
    const rows = buildResearchDataset({
        signals: signalsWithBadTimestamps,
        executions: [],
        hfEvents: [],
        results: new Map()
    });

    assert.strictEqual(rows.length, 2, 'Should still produce rows');
    assert.strictEqual(rows[0].signalTimestamp, null, 'Undefined timestamp -> null');
    assert.strictEqual(rows[1].signalTimestamp, 'not-a-date', 'Preserves original string');

    console.log('✓ Test 3: Invalid timestamp handling');
}

// Test 4: Missing latency stats for book
{
    const signals = [
        { id: 'sig6', eventId: 'e6', primaryBook: 'unknownBook', marketType: 'm', marketKey: 'k', createdAt: '2025-01-01T12:00:00Z' }
    ];

    const rows = buildResearchDataset({
        signals,
        executions: [],
        hfEvents: mockHfEvents, // bookA and bookC only
        results: new Map()
    });

    assert.strictEqual(rows[0].bookAvgLagMs, null, 'Unknown book -> null lag');
    assert.strictEqual(rows[0].bookMedianLagMs, null, 'Unknown book -> null lag');

    console.log('✓ Test 4: Missing latency stats for book');
}

// Test 5: Empty signals
{
    const rows = buildResearchDataset({
        signals: [],
        executions: mockExecutions,
        hfEvents: mockHfEvents,
        results: mockResults
    });

    assert.strictEqual(rows.length, 0, 'Empty signals -> empty rows');
    console.log('✓ Test 5: Empty signals handling');
}

console.log('\n=== All dataset builder tests passed ===\n');
