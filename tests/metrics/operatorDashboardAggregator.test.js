/**
 * tests/metrics/operatorDashboardAggregator.test.js
 * 
 * Unit tests for operator dashboard aggregator.
 */

const assert = require('assert');
const { buildOperatorDashboardSnapshot, recordArbResult } = require('../../src/metrics/operatorDashboardAggregator');

console.log('=== Operator Dashboard Aggregator Tests ===\\n');

/**
 * Test: Basic snapshot shape
 */
{
    const nowMs = 1234567890000;
    const result = buildOperatorDashboardSnapshot({}, nowMs);

    assert.strictEqual(result.timestamp, new Date(nowMs).toISOString());
    assert.ok(typeof result.execution === 'object');
    assert.ok(typeof result.risk === 'object');
    assert.ok(typeof result.health === 'object');
    assert.ok(Array.isArray(result.recentArbitrageEvents));
    console.log('✓ Basic snapshot shape: all fields present');
}

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
    assert.ok(Array.isArray(result.recentArbitrageEvents));
    console.log('✓ Empty inputs: safe defaults');
}

/**
 * Test: Execution aggregation
 */
{
    const recentArbResults = [
        { arbId: 'arb1', overallStatus: 'completed', legs: [{ book: 'draftkings' }, { book: 'fanduel' }] },
        { arbId: 'arb2', overallStatus: 'partial', legs: [{ book: 'betmgm' }] },
        { arbId: 'arb3', overallStatus: 'failed', legs: [{ book: 'draftkings' }] },
        { arbId: 'arb4', overallStatus: 'skipped', notes: ['latency_guard_blocked'], legs: [] },
        { arbId: 'arb5', overallStatus: 'blocked_by_safety_gate', notes: ['safety_gate_blocked'], legs: [] }
    ];

    const result = buildOperatorDashboardSnapshot({ recentArbResults });

    assert.strictEqual(result.execution.stats.totalArbs, 5);
    assert.strictEqual(result.execution.stats.completed, 1);
    assert.strictEqual(result.execution.stats.partial, 1);
    assert.strictEqual(result.execution.stats.failed, 1);
    assert.strictEqual(result.execution.stats.skipped, 1);
    assert.strictEqual(result.execution.stats.blockedByLatency, 1);
    assert.strictEqual(result.execution.stats.blockedBySafety, 1);
    console.log('✓ Execution aggregation: correct stats');
}

/**
 * Test: Risk aggregation
 */
{
    const riskSummary = {
        exposureEntries: [
            { book: 'draftkings', exposure: 500 },
            { book: 'fanduel', exposure: 300 },
            { book: 'draftkings', exposure: 200 }
        ],
        maxPerBookExposure: 1000,
        maxDailyLoss: -500,
        currentDailyPnL: 150
    };

    const result = buildOperatorDashboardSnapshot({ riskSummary });

    assert.strictEqual(result.risk.totalExposureByBook.draftkings, 700);
    assert.strictEqual(result.risk.totalExposureByBook.fanduel, 300);
    assert.strictEqual(result.risk.maxPerBookExposure, 1000);
    assert.strictEqual(result.risk.maxDailyLoss, -500);
    assert.strictEqual(result.risk.currentDailyPnL, 150);
    console.log('✓ Risk aggregation: exposure by book');
}

/**
 * Test: Health aggregation
 */
{
    const nowMs = Date.now();
    const recentHealthAdvisories = [
        { timestamp: new Date(nowMs - 30 * 60 * 1000).toISOString(), level: 'ok' },
        { timestamp: new Date(nowMs - 90 * 60 * 1000).toISOString(), level: 'degraded' },
        { timestamp: new Date(nowMs - 10 * 60 * 1000).toISOString(), level: 'warning' }
    ];

    const result = buildOperatorDashboardSnapshot({ recentHealthAdvisories }, nowMs);

    assert.strictEqual(result.health.lastAdvisoryLevel, 'warning');
    assert.ok(result.health.lastAdvisoryAt);
    assert.strictEqual(result.health.advisoriesLastHour, 2);
    console.log('✓ Health aggregation: last hour count');
}

/**
 * Test: Arb buffer - empty
 */
{
    const result = buildOperatorDashboardSnapshot({});

    assert.ok(Array.isArray(result.recentArbitrageEvents));
    console.log('✓ Arb buffer empty: array present');
}

/**
 * Test: Arb buffer - with entries
 */
{
    recordArbResult({
        eventId: 'evt1',
        books: ['draftkings', 'fanduel'],
        edge: 2.5,
        marketType: 'moneyline'
    });

    recordArbResult({
        eventId: 'evt2',
        books: ['betmgm'],
        edge: 1.8,
        marketType: 'spread'
    });

    const result = buildOperatorDashboardSnapshot({});

    assert.ok(Array.isArray(result.recentArbitrageEvents));
    assert.ok(result.recentArbitrageEvents.length >= 2);

    const evt = result.recentArbitrageEvents.find(e => e.eventId === 'evt1');
    assert.ok(evt);
    assert.strictEqual(evt.edge, 2.5);
    assert.deepStrictEqual(evt.books, ['draftkings', 'fanduel']);
    assert.strictEqual(evt.marketType, 'moneyline');
    assert.ok(typeof evt.createdAtMs === 'number');
    console.log('✓ Arb buffer with entries: structure validated');
}

/**
 * Test: Backward compatibility
 */
{
    const result = buildOperatorDashboardSnapshot({});

    assert.ok(result.timestamp);
    assert.ok(result.execution);
    assert.ok(result.risk);
    assert.ok(result.health);
    assert.ok(result.recentArbitrageEvents);
    console.log('✓ Backward compatibility: all top-level fields present');
}

console.log('\\n=== All operator dashboard aggregator tests passed ===\\n');
