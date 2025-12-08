/**
 * tests/execution/executionScenarioHarness.test.js
 * 
 * Unit tests for execution scenario harness.
 */

const assert = require('assert');
const { runExecutionScenario, mergeConfig, createLegSimulator } = require('../../src/execution/executionScenarioHarness');

console.log('=== Execution Scenario Harness Tests ===\\n');

/**
 * Test: mergeConfig
 */
{
    const base = {
        execution: { mode: 'simulation', retry: { maxAttempts: 3 } },
        other: 'value'
    };

    const overrides = {
        execution: { mode: 'live' }
    };

    const merged = mergeConfig(base, overrides);

    assert.strictEqual(merged.execution.mode, 'live', 'Should override mode');
    assert.strictEqual(merged.execution.retry.maxAttempts, 3, 'Should preserve non-overridden values');
    console.log('✓ mergeConfig: merges overrides correctly');
}

/**
 * Test: Simple full-fill scenario
 */
{
    const scenario = {
        id: 'test-simple',
        mode: 'simulation',
        arbs: [
            {
                arbId: 'arb1',
                legs: [
                    { legId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
                    { legId: 'leg2', book: 'fanduel', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
                ]
            }
        ]
    };

    const baseConfig = {
        execution: { mode: 'paper', arbExecution: { strategy: 'sequential_conservative', maxLegsPerArb: 4 } }
    };

    const result = runExecutionScenario(scenario, baseConfig);

    assert.strictEqual(result.scenarioId, 'test-simple');
    assert.strictEqual(result.mode, 'simulation');
    assert.strictEqual(result.arbs.length, 1);
    assert.strictEqual(result.arbs[0].arbId, 'arb1');
    assert.strictEqual(result.arbs[0].executionResult.legs.length, 2);
    console.log('✓ Simple full-fill scenario: executes without errors');
}

/**
 * Test: Scripted partial + reject scenario
 */
{
    const scenario = {
        id: 'test-partial-reject',
        mode: 'live_simulated',
        arbs: [
            {
                arbId: 'arb2',
                legs: [
                    {
                        legId: 'leg1',
                        book: 'draftkings',
                        eventId: 'evt2',
                        marketType: 'spread',
                        side: 'home',
                        price: -110,
                        stake: 100,
                        behavior: {
                            attempts: [
                                { status: 'partial_filled', filledStake: 50 },
                                { status: 'filled', filledStake: 50 }
                            ]
                        }
                    },
                    {
                        legId: 'leg2',
                        book: 'fanduel',
                        eventId: 'evt2',
                        marketType: 'spread',
                        side: 'away',
                        price: +105,
                        stake: 105,
                        behavior: {
                            attempts: [
                                { status: 'rejected', errorCode: 'LIMIT', filledStake: 0 }
                            ]
                        }
                    }
                ]
            }
        ]
    };

    const baseConfig = {
        execution: { arbExecution: { strategy: 'sequential_conservative' } }
    };

    const result = runExecutionScenario(scenario, baseConfig);

    assert.strictEqual(result.arbs[0].executionResult.overallStatus, 'partial', 'Should be partial status');
    assert.strictEqual(result.arbs[0].executionResult.legs[0].status, 'filled', 'Leg1 should eventually fill');
    assert.strictEqual(result.arbs[0].executionResult.legs[1].status, 'rejected', 'Leg2 should be rejected');
    console.log('✓ Scripted partial + reject: respects behavior.attempts');
}

/**
 * Test: Determinism
 */
{
    const scenario = {
        id: 'test-determinism',
        mode: 'simulation',
        arbs: [
            {
                arbId: 'arb3',
                legs: [
                    { legId: 'leg1', book: 'draftkings', eventId: 'evt3', marketType: 'total', side: 'over', price: -110, stake: 100 }
                ]
            }
        ]
    };

    const baseConfig = {
        execution: { mode: 'simulation' }
    };

    const result1 = runExecutionScenario(scenario, baseConfig);
    const result2 = runExecutionScenario(scenario, baseConfig);

    assert.deepStrictEqual(result1.scenarioId, result2.scenarioId);
    assert.deepStrictEqual(result1.arbs.length, result2.arbs.length);
    assert.deepStrictEqual(result1.arbs[0].arbId, result2.arbs[0].arbId);
    console.log('✓ Determinism: same scenario produces consistent results');
}

/**
 * Test: createLegSimulator with no behavior
 */
{
    const leg = {
        legId: 'leg1',
        stake: 100
    };

    const simulator = createLegSimulator(leg);
    const result = simulator({}, {});

    assert.strictEqual(result.status, 'filled');
    assert.strictEqual(result.filled, 100);
    assert.strictEqual(result.remaining, 0);
    console.log('✓ createLegSimulator: defaults to full fill');
}

/**
 * Test: createLegSimulator with scripted behavior
 */
{
    const leg = {
        legId: 'leg1',
        stake: 100,
        behavior: {
            attempts: [
                { status: 'partial_filled', filledStake: 30 },
                { status: 'partial_filled', filledStake: 40 },
                { status: 'filled', filledStake: 30 }
            ]
        }
    };

    const simulator = createLegSimulator(leg);

    const result1 = simulator({}, {});
    assert.strictEqual(result1.status, 'partial_filled');
    assert.strictEqual(result1.filled, 30);

    const result2 = simulator({}, {});
    assert.strictEqual(result2.status, 'partial_filled');
    assert.strictEqual(result2.filled, 40);

    const result3 = simulator({}, {});
    assert.strictEqual(result3.status, 'filled');
    assert.strictEqual(result3.filled, 30);

    console.log('✓ createLegSimulator: follows scripted attempts');
}

/**
 * Test: Mode override
 */
{
    const scenario = {
        id: 'test-mode',
        mode: 'paper',
        arbs: [
            {
                arbId: 'arb4',
                legs: [
                    { legId: 'leg1', book: 'draftkings', eventId: 'evt4', marketType: 'moneyline', side: 'home', price: -110, stake: 100 }
                ]
            }
        ]
    };

    const baseConfig = {
        execution: { mode: 'simulation' }
    };

    const result = runExecutionScenario(scenario, baseConfig);

    assert.strictEqual(result.configSnapshot.execution.mode, 'paper', 'Should override to paper mode');
    console.log('✓ Mode override: scenario.mode overrides config');
}

console.log('\\n=== All scenario harness tests passed ===\\n');
