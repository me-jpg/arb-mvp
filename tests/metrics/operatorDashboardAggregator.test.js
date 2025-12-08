/**
 * tests/metrics/operatorDashboardAggregator.test.js
 * 
 * Unit tests for operator dashboard aggregator.
 */

const assert = require('assert');
const { buildOperatorDashboardSnapshot, aggregateExecutionStats, aggregateRiskMetrics, aggregateHealthAdvisories } = require('../../src/metrics/operatorDashboardAggregator');

console.log('=== Operator Dashboard Aggregator Tests ===\\n');

/**
 * Test: Empty inputs
 */
{
    const result = buildOperatorDashboardSnapshot({});

    assert.ok(result.timestamp);
    assert.strictEqual(result.execution.stats.totalArbs, 0);
    assert.strictEqual(result.execution.stats.completed, 0);
    assert.deepStrictEqual(result.risk.totalExposureByBook, {});
    assert.strictEqual(result.risk.maxPerBookExposure, null);
    assert.strictEqual(result.health.lastAdvisoryLevel, null);
    assert.strictEqual(result.health.advisoriesLastHour, 0);
    console.log('✓ Empty inputs: safe defaults');
}

/**
 * Test: Mixed arb results
 */
{
    const recentArbResults = [
        { arbId: 'arb1', overallStatus: 'completed', legs: [{ book: 'draftkings' }, { book: 'fanduel' }] },
        { arbId: 'arb2', overallStatus: 'partial', legs: [{ book: 'betmgm' }] },
        { arbId: 'arb3', overallStatus: 'failed', legs: [{ book: 'draftkings' }] },
        { arbId: 'arb4', overallStatus: 'skipped', notes: ['latency_guard_blocked'], legs: [] },
        { arbId: 'arb5', overallStatus: 'blocked_by_safety_gate', notes: ['safety_gate_blocked'], legs: [] }
    ];

    const execution = aggregateExecutionStats(recentArbResults, {});

    assert.strictEqual(execution.stats.totalArbs, 5);
    assert.strictEqual(execution.stats.completed, 1);
    assert.strictEqual(execution.stats.partial, 1);
    assert.strictEqual(execution.stats.failed, 1);
    assert.strictEqual(execution.stats.skipped, 1);
    assert.strictEqual(execution.stats.blockedByLatency, 1);
    assert.strictEqual(execution.stats.blockedBySafety, 1);
    assert.strictEqual(execution.recentArbs.length, 5);
    console.log('✓ Mixed arb results: correct stats');
}

/**
 * Test: Books aggregation
 */
{
    const recentArbResults = [
        {
            arbId: 'arb1',
            overallStatus: 'completed',
            legs: [
                { book: 'draftkings' },
                { book: 'fanduel' },
                { book: 'betmgm' }
            ]
        }
    ];

    const execution = aggregateExecutionStats(recentArbResults, {});

    assert.ok(execution.recentArbs[0].books.length === 3);
    console.log('✓ Books aggregation: unique books extracted');
}

/**
 * Test: Risk summary aggregation
 */
{
    const riskSummary = {
        exposureEntries: [
            { book: 'draftkings', exposure: 500 },
            { book: 'fanduel', exposure: 300 },
            { book: 'draftkings', exposure: 200 }  // Same book, should aggregate
        ],
        maxPerBookExposure: 1000,
        maxDailyLoss: -500,
        currentDailyPnL: 150
    };

    const risk = aggregateRiskMetrics(riskSummary);

    assert.strictEqual(risk.totalExposureByBook.draftkings, 700);
    assert.strictEqual(risk.totalExposureByBook.fanduel, 300);
    assert.strictEqual(risk.maxPerBookExposure, 1000);
    assert.strictEqual(risk.maxDailyLoss, -500);
    assert.strictEqual(risk.currentDailyPnL, 150);
    console.log('✓ Risk summary: exposure aggregated by book');
}

/**
 * Test: Health advisories - last hour
 */
{
    const nowMs = Date.now();
    const recentHealthAdvisories = [
        { timestamp: new Date(nowMs - 30 * 60 * 1000).toISOString(), level: 'ok' },          // 30 min ago
        { timestamp: new Date(nowMs - 90 * 60 * 1000).toISOString(), level: 'degraded' },   // 90 min ago (outside window)
        { timestamp: new Date(nowMs - 10 * 60 * 1000).toISOString(), level: 'warning' }     // 10 min ago (most recent)
    ];

    const health = aggregateHealthAdvisories(recentHealthAdvisories);

    assert.strictEqual(health.lastAdvisoryLevel, 'warning');
    assert.ok(health.lastAdvisoryAt);
    assert.strictEqual(health.advisoriesLastHour, 2);  // Only 2 within last hour
    console.log('✓ Health advisories: last hour count correct');
}

/**
 * Test: Hedging plan and execution flags
 */
{
    const recentArbResults = [
        {
            arbId: 'arb1',
            overallStatus: 'partial',
            legs: [],
            hedgingPlan: { hedges: [{ hedgeId: 'h1' }] },
            hedgeExecutionResult: { status: 'hedges_executed' }
        },
        {
            arbId: 'arb2',
            overallStatus: 'partial',
            legs: [],
            hedgingPlan: { hedges: [] }  // Empty hedges
        }
    ];

    const execution = aggregateExecutionStats(recentArbResults, {});

    assert.strictEqual(execution.recentArbs[0].hasHedgingPlan, true);
    assert.strictEqual(execution.recentArbs[0].hasHedgeExecution, true);
    assert.strictEqual(execution.recentArbs[1].hasHedgingPlan, false);
    assert.strictEqual(execution.recentArbs[1].hasHedgeExecution, false);
    console.log('✓ Hedging flags: detected correctly');
}

/**
 * Test: Mode summary
 */
{
    const modeSummary = { mode: 'live' };
    const execution = aggregateExecutionStats([], modeSummary);

    assert.strictEqual(execution.mode, 'live');
    console.log('✓ Mode summary: propagated correctly');
}

/**
 * Test: Determinism
 */
{
    const input = {
        recentArbResults: [
            { arbId: 'arb1', overallStatus: 'completed', legs: [] }
        ],
        riskSummary: {},
        recentHealthAdvisories: []
    };

    const result1 = buildOperatorDashboardSnapshot(input);
    const result2 = buildOperatorDashboardSnapshot(input);

    // Timestamps will differ, but stats should be identical
    assert.strictEqual(result1.execution.stats.totalArbs, result2.execution.stats.totalArbs);
    assert.strictEqual(result1.execution.stats.completed, result2.execution.stats.completed);
    console.log('✓ Determinism: consistent stats from same input');
}

console.log('\\n=== All operator dashboard aggregator tests passed ===\\n');
