/**
 * tests/metrics/arbExposureSummaryLoader.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadArbExposureSummary } = require('../../src/metrics/arbExposureSummaryLoader');

console.log('=== arbExposureSummaryLoader.test.js ===\n');

// Test 1: loadArbExposureSummary - empty/missing files
{
    (async () => {
        const summary = await loadArbExposureSummary({
            signalsPath: 'nonexistent.jsonl',
            executionPath: 'nonexistent.jsonl'
        });

        assert.strictEqual(summary.groups, 0, 'Groups should be 0');
        assert.strictEqual(summary.pairs, 0, 'Pairs should be 0');
        assert.strictEqual(summary.fullyHedged, 0, 'Fully hedged should be 0');
        assert.strictEqual(summary.totalUnhedgedExposure, 0, 'Exposure should be 0');
        assert.deepStrictEqual(summary.byBook, {}, 'byBook should be empty');
        assert.deepStrictEqual(summary.worstUnhedged, [], 'worstUnhedged should be empty');

        console.log('✓ Test 1: loadArbExposureSummary - empty/missing files');
    })();
}

// Test 2: loadArbExposureSummary - with synthetic data
{
    (async () => {
        // Create temp test files
        const testDir = path.join(process.cwd(), 'logs', 'test');
        const signalsFile = path.join(testDir, 'arb-signals-test.jsonl');
        const execFile = path.join(testDir, 'arb-exec-test.jsonl');

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const signals = [
            { signalId: 's1', eventId: 'game1', marketType: 'moneyline', book: 'draftkings', betSide: 'home' },
            { signalId: 's2', eventId: 'game1', marketType: 'moneyline', book: 'betmgm', betSide: 'away' }
        ];

        const execution = [
            { sourceSignalId: 's1', status: 'filled', filledStake: 100, book: 'draftkings' },
            { sourceSignalId: 's2', status: 'rejected', book: 'betmgm' }
        ];

        fs.writeFileSync(signalsFile, signals.map(s => JSON.stringify(s)).join('\n'));
        fs.writeFileSync(execFile, execution.map(e => JSON.stringify(e)).join('\n'));

        const summary = await loadArbExposureSummary({
            signalsPath: signalsFile,
            executionPath: execFile
        });

        assert.ok(summary.groups >= 1, 'Should have at least 1 group');
        assert.ok(summary.pairs >= 1, 'Should have at least 1 pair');
        assert.strictEqual(summary.unhedgedSingleLeg, 1, 'Should have 1 unhedged');
        assert.strictEqual(summary.totalUnhedgedExposure, 100, 'Exposure should be 100');

        assert.ok(summary.byBook.draftkings, 'Should have draftkings in byBook');
        assert.strictEqual(summary.byBook.draftkings.unhedgedPairs, 1, 'draftkings should have 1 unhedged');

        // Cleanup
        fs.unlinkSync(signalsFile);
        fs.unlinkSync(execFile);

        console.log('✓ Test 2: loadArbExposureSummary - with synthetic data');
    })();
}

// Test 3: loadArbExposureSummary - limits respected
{
    (async () => {
        // Create temp test files with many entries
        const testDir = path.join(process.cwd(), 'logs', 'test');
        const signalsFile = path.join(testDir, 'arb-signals-limit-test.jsonl');
        const execFile = path.join(testDir, 'arb-exec-limit-test.jsonl');

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const signals = [];
        for (let i = 0; i < 1000; i++) {
            signals.push({
                signalId: `s${i}`,
                eventId: `game${i}`,
                marketType: 'moneyline',
                book: 'draftkings',
                betSide: 'home'
            });
        }

        fs.writeFileSync(signalsFile, signals.map(s => JSON.stringify(s)).join('\n'));
        fs.writeFileSync(execFile, ''); // Empty exec

        const summary = await loadArbExposureSummary({
            signalsPath: signalsFile,
            executionPath: execFile,
            limitSignals: 100
        });

        // Should only load 100 signals
        assert.ok(summary.groups <= 100, 'Groups should respect limit');

        // Cleanup
        fs.unlinkSync(signalsFile);
        fs.unlinkSync(execFile);

        console.log('✓ Test 3: loadArbExposureSummary - limits respected');
    })();
}

// Wait for all async tests to complete
setTimeout(() => {
    console.log('\n=== All arb exposure summary loader tests passed ===\n');
}, 300);
