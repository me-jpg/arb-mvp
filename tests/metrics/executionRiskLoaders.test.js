/**
 * tests/metrics/executionRiskLoaders.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadExecutionSummary, loadRiskSummary } = require('../../src/metrics/executionRiskLoaders');

console.log('=== executionRiskLoaders.test.js ===\n');

// Test 1: loadExecutionSummary - empty log
{
    (async () => {
        const summary = await loadExecutionSummary({ logPath: 'nonexistent.jsonl' });

        assert.strictEqual(summary.totalOrders, 0, 'Total orders should be 0');
        assert.strictEqual(summary.filled, 0, 'Filled should be 0');
        assert.strictEqual(summary.fillRate, 0, 'Fill rate should be 0');
        assert.deepStrictEqual(summary.books, {}, 'Books should be empty');

        console.log('✓ Test 1: loadExecutionSummary - empty log');
    })();
}

// Test 2: loadExecutionSummary - with data
{
    (async () => {
        // Create temp test file
        const testDir = path.join(process.cwd(), 'logs', 'test');
        const testFile = path.join(testDir, 'execution-test.jsonl');

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const events = [
            { status: 'filled', book: 'draftkings', timestamp: new Date().toISOString() },
            { status: 'filled', book: 'betmgm', timestamp: new Date().toISOString() },
            { status: 'rejected', book: 'draftkings', timestamp: new Date().toISOString() },
            { status: 'blocked', book: 'espnbet', timestamp: new Date().toISOString() }
        ];

        fs.writeFileSync(testFile, events.map(e => JSON.stringify(e)).join('\n'));

        const summary = await loadExecutionSummary({ logPath: testFile });

        assert.strictEqual(summary.totalOrders, 4, 'Total orders should be 4');
        assert.strictEqual(summary.filled, 2, 'Filled should be 2');
        assert.strictEqual(summary.rejected, 1, 'Rejected should be 1');
        assert.strictEqual(summary.blocked, 1, 'Blocked should be 1');
        assert.ok(Math.abs(summary.fillRate - 0.5) < 0.01, 'Fill rate should be ~0.5');

        assert.ok(summary.books.draftkings, 'draftkings should exist');
        assert.strictEqual(summary.books.draftkings.count, 2, 'draftkings count');
        assert.strictEqual(summary.books.draftkings.filled, 1, 'draftkings filled');
        assert.strictEqual(summary.books.draftkings.rejected, 1, 'draftkings rejected');

        // Cleanup
        fs.unlinkSync(testFile);

        console.log('✓ Test 2: loadExecutionSummary - with data');
    })();
}

// Test 3: loadRiskSummary - empty log
{
    (async () => {
        const summary = await loadRiskSummary({ logPath: 'nonexistent.jsonl' });

        assert.strictEqual(summary.snapshotCount, 0, 'Snapshot count should be 0');
        assert.strictEqual(summary.latest.bankroll, null, 'Bankroll should be null');
        assert.strictEqual(summary.latest.exposureTotal, null, 'Exposure should be null');
        assert.deepStrictEqual(summary.latest.exposureByBook, {}, 'Exposure by book should be empty');

        console.log('✓ Test 3: loadRiskSummary - empty log');
    })();
}

// Test 4: loadRiskSummary - with data
{
    (async () => {
        // Create temp test file
        const testDir = path.join(process.cwd(), 'logs', 'test');
        const testFile = path.join(testDir, 'risk-test.jsonl');

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const snapshots = [
            { bankroll: 1000, exposureTotal: 100, exposureByBook: { draftkings: 50, betmgm: 50 }, currentDayLoss: -20, mode: 'normal' },
            { bankroll: 980, exposureTotal: 150, exposureByBook: { draftkings: 75, betmgm: 75 }, currentDayLoss: -40, mode: 'normal' }
        ];

        fs.writeFileSync(testFile, snapshots.map(s => JSON.stringify(s)).join('\n'));

        const summary = await loadRiskSummary({ logPath: testFile });

        assert.strictEqual(summary.snapshotCount, 2, 'Snapshot count should be 2');
        assert.strictEqual(summary.latest.bankroll, 980, 'Latest bankroll should be 980');
        assert.strictEqual(summary.latest.exposureTotal, 150, 'Latest exposure should be 150');
        assert.strictEqual(summary.latest.currentDayLoss, -40, 'Latest loss should be -40');
        assert.strictEqual(summary.latest.mode, 'normal', 'Mode should be normal');
        assert.strictEqual(summary.latest.exposureByBook.draftkings, 75, 'draftkings exposure');

        // Cleanup
        fs.unlinkSync(testFile);

        console.log('✓ Test 4: loadRiskSummary - with data');
    })();
}

// Wait for all async tests to complete
setTimeout(() => {
    console.log('\n=== All execution/risk loader tests passed ===\n');
}, 100);
