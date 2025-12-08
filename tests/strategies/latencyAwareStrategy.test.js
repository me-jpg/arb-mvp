/**
 * tests/strategies/latencyAwareStrategy.test.js
 * 
 * Verifies that the strategy engine correctly uses latency stats to filter
 * or prioritize signals when configured.
 */

const assert = require('assert');
const { applyStrategy } = require('../../src/signals/strategyEngine');

console.log('=== latencyAwareStrategy.test.js ===\n');

// Mock Data
const mockSignals = [
    { id: 1, type: 'pure_arb', eventId: 'E1', primaryBook: 'fastBook', edgeEstimate: 0.05, confidence: 0.9 },
    { id: 2, type: 'pure_arb', eventId: 'E1', primaryBook: 'slowBook', edgeEstimate: 0.051, confidence: 0.9 }, // slightly better edge
    { id: 3, type: 'pure_arb', eventId: 'E2', primaryBook: 'laggyBook', edgeEstimate: 0.04, confidence: 0.8 },
    { id: 4, type: 'pure_arb', eventId: 'E3', primaryBook: 'fastBook', edgeEstimate: 0.03, confidence: 0.9 }
];

const mockLatencyStats = {
    fastBook: { avgLagMs: 10, sampleCount: 100 },
    slowBook: { avgLagMs: 200, sampleCount: 100 },
    laggyBook: { avgLagMs: 1000, sampleCount: 50 },
    unknown: { avgLagMs: 0, sampleCount: 0 }
};

// Test 1: Baseline (No Latency Awareness)
// Should pick slowBook for E1 because edge is higher (0.051 > 0.05)
{
    const config = {
        latencyAware: false,
        maxSignalsPerEvent: 1
    };

    const result = applyStrategy(mockSignals, config);
    const e1Signal = result.selectedSignals.find(s => s.eventId === 'E1');

    assert(e1Signal, 'Should select a signal for E1');
    assert.strictEqual(e1Signal.primaryBook, 'slowBook',
        `Baseline should pick higher edge (slowBook) but got ${e1Signal.primaryBook}`);

    console.log('✓ Test 1: Baseline behavior (highest edge wins)');
}

// Test 2: Max Allowed Lag Filtering
// Should reject laggyBook (1000ms) if limit is 500ms
{
    const config = {
        latencyAware: true,
        maxAllowedLagMs: 500,
        injectedLatencyStats: mockLatencyStats
    };

    const result = applyStrategy(mockSignals, config);

    // laggyBook (E2) should be rejected
    const e2Signal = result.selectedSignals.find(s => s.eventId === 'E2');
    assert(!e2Signal, 'Should reject laggyBook due to >500ms lag');

    // fastBook (E3) should be kept (10ms < 500ms)
    const e3Signal = result.selectedSignals.find(s => s.eventId === 'E3');
    assert(e3Signal, 'Should keep fastBook');

    console.log('✓ Test 2: Max allowed lag filtering');
}

// Test 3: Prefer Fast Books (Reordering)
// E1: slowBook (0.051, 200ms) vs fastBook (0.05, 10ms)
// Edges are close (diff 0.001 < 0.005). Prefer fastBook.
{
    const config = {
        latencyAware: true,
        preferFastBooks: true,
        maxSignalsPerEvent: 1,
        injectedLatencyStats: mockLatencyStats
    };

    const result = applyStrategy(mockSignals, config);
    const e1Signal = result.selectedSignals.find(s => s.eventId === 'E1');

    assert(e1Signal, 'Should select a signal for E1');
    assert.strictEqual(e1Signal.primaryBook, 'fastBook',
        `Should prefer fastBook when edges are similar. Got ${e1Signal.primaryBook}`);

    console.log('✓ Test 3: Prefer fast books reordering');
}

// Test 4: Prefer Fast Books (Significant Edge Override)
// If slowBook had HUGE edge, it should still win.
{
    const hugeEdgeSignals = [
        { id: 1, type: 'pure_arb', eventId: 'E1', primaryBook: 'fastBook', edgeEstimate: 0.05 },
        { id: 2, type: 'pure_arb', eventId: 'E1', primaryBook: 'slowBook', edgeEstimate: 0.10 } // +5% edge
    ];

    const config = {
        latencyAware: true,
        preferFastBooks: true,
        maxSignalsPerEvent: 1,
        injectedLatencyStats: mockLatencyStats
    };

    const result = applyStrategy(hugeEdgeSignals, config);
    const e1Signal = result.selectedSignals.find(s => s.eventId === 'E1');

    assert.strictEqual(e1Signal.primaryBook, 'slowBook',
        `Should still pick slowBook if edge difference is large (0.05 vs 0.10). Got ${e1Signal.primaryBook}`);

    console.log('✓ Test 4: Significant edge overrides speed preference');
}

console.log('\n=== All Latency Strategy tests passed ===\n');
