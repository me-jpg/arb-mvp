/**
 * tests/server/wsMetricsServer.test.js
 */

const assert = require('assert');
const { buildMetricsPayload } = require('../../src/server/wsMetricsServer');

console.log('=== wsMetricsServer.test.js ===\n');

// Test 1: buildMetricsPayload structure
{
    const payload = buildMetricsPayload({
        hfSummary: {
            topVolatileMarkets: [
                { eventId: 'e1', marketType: 'moneyline', volatilityScore: 43.2, totalMoves: 12 }
            ]
        },
        latencyAnomalies: {
            anomalies: [
                { book: 'draftkings', zScore: 4.2, observedLagMs: 820 }
            ]
        },
        executionSummary: { filled: 5, blocked: 2 }
    });

    assert.ok(payload.ts, 'Should have timestamp');
    assert.ok(payload.hf, 'Should have hf section');
    assert.ok(payload.latency, 'Should have latency section');
    assert.ok(payload.execution, 'Should have execution section');

    assert.strictEqual(payload.hf.topVolatileMarkets.length, 1, 'Should have 1 market');
    assert.strictEqual(payload.latency.anomalies.length, 1, 'Should have 1 anomaly');
    assert.strictEqual(payload.execution.filled, 5, 'Execution summary preserved');

    console.log('✓ Test 1: buildMetricsPayload structure');
}

// Test 2: Empty data handling
{
    const payload = buildMetricsPayload({});

    assert.ok(payload.ts, 'Should have timestamp');
    assert.deepStrictEqual(payload.hf, { topVolatileMarkets: [] }, 'Empty HF summary');
    assert.deepStrictEqual(payload.latency, { anomalies: [] }, 'Empty latency anomalies');
    assert.deepStrictEqual(payload.execution, {}, 'Empty execution summary');

    console.log('✓ Test 2: Empty data handling');
}

// Test 3: Timestamp format
{
    const payload = buildMetricsPayload({});

    const ts = new Date(payload.ts);
    assert.ok(!isNaN(ts.getTime()), 'Timestamp should be valid ISO date');

    console.log('✓ Test 3: Timestamp format');
}

// Test 4: HF summary with multiple markets
{
    const markets = [
        { eventId: 'e1', marketType: 'moneyline', volatilityScore: 100, totalMoves: 20 },
        { eventId: 'e2', marketType: 'spread', volatilityScore: 75, totalMoves: 15 },
        { eventId: 'e3', marketType: 'total', volatilityScore: 50, totalMoves: 10 }
    ];

    const payload = buildMetricsPayload({
        hfSummary: { topVolatileMarkets: markets }
    });

    assert.strictEqual(payload.hf.topVolatileMarkets.length, 3, 'Should have 3 markets');
    assert.strictEqual(payload.hf.topVolatileMarkets[0].eventId, 'e1', 'First market correct');

    console.log('✓ Test 4: HF summary with multiple markets');
}

// Test 5: Latency anomalies with multiple entries
{
    const anomalies = [
        { book: 'draftkings', zScore: 4.2, observedLagMs: 820, severity: 'critical' },
        { book: 'betmgm', zScore: 3.5, observedLagMs: 650, severity: 'warn' }
    ];

    const payload = buildMetricsPayload({
        latencyAnomalies: { anomalies }
    });

    assert.strictEqual(payload.latency.anomalies.length, 2, 'Should have 2 anomalies');
    assert.strictEqual(payload.latency.anomalies[0].book, 'draftkings', 'First anomaly correct');

    console.log('✓ Test 5: Latency anomalies with multiple entries');
}

console.log('\n=== All WebSocket metrics server tests passed ===\n');
