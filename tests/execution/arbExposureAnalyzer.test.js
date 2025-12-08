/**
 * tests/execution/arbExposureAnalyzer.test.js
 */

const assert = require('assert');
const { buildArbGroupsFromSignals, analyzeArbExposure } = require('../../src/execution/arbExposureAnalyzer');

console.log('=== arbExposureAnalyzer.test.js ===\n');

// Test 1: buildArbGroupsFromSignals - basic grouping
{
    const signals = [
        { signalId: 's1', eventId: 'game1', marketType: 'moneyline', book: 'draftkings', betSide: 'home', line: null },
        { signalId: 's2', eventId: 'game1', marketType: 'moneyline', book: 'betmgm', betSide: 'away', line: null }
    ];

    const result = buildArbGroupsFromSignals(signals);

    assert.ok(result.groups, 'Should have groups');
    const groupKeys = Object.keys(result.groups);
    assert.ok(groupKeys.length > 0, 'Should have at least one group');

    const group = result.groups[groupKeys[0]];
    assert.strictEqual(group.signals.length, 2, 'Group should have 2 signals');
    assert.strictEqual(group.pairs.length, 1, 'Should form 1 pair');
    assert.strictEqual(group.pairs[0].legs.length, 2, 'Pair should have 2 legs');

    console.log('✓ Test 1: buildArbGroupsFromSignals - basic grouping');
}

// Test 2: analyzeArbExposure - both legs filled (fully hedged)
{
    const signals = [
        { signalId: 's1', eventId: 'game1', marketType: 'moneyline', book: 'draftkings', betSide: 'home' },
        { signalId: 's2', eventId: 'game1', marketType: 'moneyline', book: 'betmgm', betSide: 'away' }
    ];

    const executionEvents = [
        { sourceSignalId: 's1', status: 'filled', filledStake: 100, book: 'draftkings' },
        { sourceSignalId: 's2', status: 'filled', filledStake: 100, book: 'betmgm' }
    ];

    const result = analyzeArbExposure({ signals, executionEvents });

    assert.strictEqual(result.totals.pairs, 1, 'Should have 1 pair');
    assert.strictEqual(result.totals.fullyHedged, 1, 'Should have 1 fully hedged pair');
    assert.strictEqual(result.totals.unhedgedSingleLeg, 0, 'Should have 0 unhedged');
    assert.strictEqual(result.totals.totalUnhedgedExposure, 0, 'Unhedged exposure should be 0');

    console.log('✓ Test 2: analyzeArbExposure - both legs filled (fully hedged)');
}

// Test 3: analyzeArbExposure - one leg filled, one rejected (unhedged)
{
    const signals = [
        { signalId: 's1', eventId: 'game1', marketType: 'moneyline', book: 'draftkings', betSide: 'home' },
        { signalId: 's2', eventId: 'game1', marketType: 'moneyline', book: 'betmgm', betSide: 'away' }
    ];

    const executionEvents = [
        { sourceSignalId: 's1', status: 'filled', filledStake: 150, book: 'draftkings' },
        { sourceSignalId: 's2', status: 'rejected', book: 'betmgm' }
    ];

    const result = analyzeArbExposure({ signals, executionEvents });

    assert.strictEqual(result.totals.pairs, 1, 'Should have 1 pair');
    assert.strictEqual(result.totals.fullyHedged, 0, 'Should have 0 fully hedged');
    assert.strictEqual(result.totals.unhedgedSingleLeg, 1, 'Should have 1 unhedged');
    assert.strictEqual(result.totals.totalUnhedgedExposure, 150, 'Unhedged exposure should be 150');

    assert.ok(result.byBook.draftkings, 'Should have draftkings in byBook');
    assert.strictEqual(result.byBook.draftkings.unhedgedPairs, 1, 'draftkings should have 1 unhedged pair');
    assert.strictEqual(result.byBook.draftkings.unhedgedExposure, 150, 'draftkings exposure should be 150');

    console.log('✓ Test 3: analyzeArbExposure - one leg filled, one rejected (unhedged)');
}

// Test 4: analyzeArbExposure - no fills (no-fill pair)
{
    const signals = [
        { signalId: 's1', eventId: 'game1', marketType: 'moneyline', book: 'draftkings', betSide: 'home' },
        { signalId: 's2', eventId: 'game1', marketType: 'moneyline', book: 'betmgm', betSide: 'away' }
    ];

    const executionEvents = [
        { sourceSignalId: 's1', status: 'rejected', book: 'draftkings' },
        { sourceSignalId: 's2', status: 'blocked', book: 'betmgm' }
    ];

    const result = analyzeArbExposure({ signals, executionEvents });

    assert.strictEqual(result.totals.pairs, 1, 'Should have 1 pair');
    assert.strictEqual(result.totals.fullyHedged, 0, 'Should have 0 fully hedged');
    assert.strictEqual(result.totals.unhedgedSingleLeg, 0, 'Should have 0 unhedged');
    assert.strictEqual(result.totals.noFill, 1, 'Should have 1 no-fill pair');
    assert.strictEqual(result.totals.totalUnhedgedExposure, 0, 'Unhedged exposure should be 0');

    console.log('✓ Test 4: analyzeArbExposure - no fills (no-fill pair)');
}

// Test 5: Missing sourceSignalId (ignored in analysis)
{
    const signals = [
        { signalId: 's1', eventId: 'game1', marketType: 'moneyline', book: 'draftkings', betSide: 'home' },
        { signalId: 's2', eventId: 'game1', marketType: 'moneyline', book: 'betmgm', betSide: 'away' }
    ];

    const executionEvents = [
        { status: 'filled', filledStake: 100, book: 'draftkings' }, // Missing sourceSignalId
        { sourceSignalId: 's2', status: 'filled', filledStake: 100, book: 'betmgm' }
    ];

    const result = analyzeArbExposure({ signals, executionEvents });

    // s1 has no matching execution (ignored event), s2 filled
    assert.strictEqual(result.totals.unhedgedSingleLeg, 1, 'Should have 1 unhedged (s2 filled, s1 no exec)');
    assert.strictEqual(result.totals.totalUnhedgedExposure, 100, 'Exposure should be 100');

    console.log('✓ Test 5: Missing sourceSignalId (ignored in analysis)');
}

// Test 6: worstUnhedged sorted by exposure
{
    const signals = [
        { signalId: 's1', eventId: 'game1', marketType: 'moneyline', book: 'draftkings', betSide: 'home' },
        { signalId: 's2', eventId: 'game1', marketType: 'moneyline', book: 'betmgm', betSide: 'away' },
        { signalId: 's3', eventId: 'game2', marketType: 'moneyline', book: 'draftkings', betSide: 'home' },
        { signalId: 's4', eventId: 'game2', marketType: 'moneyline', book: 'espnbet', betSide: 'away' }
    ];

    const executionEvents = [
        { sourceSignalId: 's1', status: 'filled', filledStake: 200, book: 'draftkings' },
        { sourceSignalId: 's2', status: 'rejected', book: 'betmgm' },
        { sourceSignalId: 's3', status: 'filled', filledStake: 500, book: 'draftkings' },
        { sourceSignalId: 's4', status: 'blocked', book: 'espnbet' }
    ];

    const result = analyzeArbExposure({ signals, executionEvents });

    assert.strictEqual(result.totals.unhedgedSingleLeg, 2, 'Should have 2 unhedged');
    assert.strictEqual(result.worstUnhedged.length, 2, 'Should have 2 in worstUnhedged');
    assert.ok(result.worstUnhedged[0].exposure >= result.worstUnhedged[1].exposure, 'Should be sorted by exposure');
    assert.strictEqual(result.worstUnhedged[0].exposure, 500, 'Highest exposure should be 500');

    console.log('✓ Test 6: worstUnhedged sorted by exposure');
}

console.log('\n=== All arb exposure analyzer tests passed ===\n');
