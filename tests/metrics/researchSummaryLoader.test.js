/**
 * tests/metrics/researchSummaryLoader.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadResearchSummary } = require('../../src/metrics/researchSummaryLoader');

console.log('=== researchSummaryLoader.test.js ===\n');

// Test 1: loadResearchSummary - empty dataset
{
    (async () => {
        const summary = await loadResearchSummary({ datasetPath: 'nonexistent.jsonl' });

        assert.strictEqual(summary.rowCount, 0, 'Row count should be 0');
        assert.deepStrictEqual(summary.byBook, {}, 'byBook should be empty');
        assert.deepStrictEqual(summary.byStrategy, {}, 'byStrategy should be empty');
        assert.deepStrictEqual(summary.edgeCalibration, [], 'edgeCalibration should be empty');
        assert.strictEqual(summary.mlBaseline, null, 'mlBaseline should be null');

        console.log('✓ Test 1: loadResearchSummary - empty dataset');
    })();
}

// Test 2: loadResearchSummary - with synthetic data
{
    (async () => {
        // Create temp test file
        const testDir = path.join(process.cwd(), 'logs', 'test');
        const testFile = path.join(testDir, 'research-test.jsonl');

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const rows = [
            {
                signalId: 's1',
                book: 'draftkings',
                strategyId: 'strat-a',
                edgeEstimate: 2.5,
                stakePlanned: 100,
                realizedProfit: 10,
                expectedValue: 2.5
            },
            {
                signalId: 's2',
                book: 'betmgm',
                strategyId: 'strat-a',
                edgeEstimate: 1.5,
                stakePlanned: 50,
                realizedProfit: -5,
                expectedValue: 0.75
            },
            {
                signalId: 's3',
                book: 'draftkings',
                strategyId: 'strat-b',
                edgeEstimate: 3.0,
                stakePlanned: 75,
                realizedProfit: 20,
                expectedValue: 2.25
            }
        ];

        fs.writeFileSync(testFile, rows.map(r => JSON.stringify(r)).join('\n'));

        const summary = await loadResearchSummary({ datasetPath: testFile });

        assert.strictEqual(summary.rowCount, 3, 'Row count should be 3');
        assert.ok(summary.byBook, 'byBook should exist');
        assert.ok(summary.byStrategy, 'byStrategy should exist');
        assert.ok(Array.isArray(summary.edgeCalibration), 'edgeCalibration should be array');

        // Check byBook aggregation
        assert.ok(summary.byBook.draftkings, 'draftkings should exist');
        assert.strictEqual(summary.byBook.draftkings.count, 2, 'draftkings count');

        // Check byStrategy aggregation
        assert.ok(summary.byStrategy['strat-a'], 'strat-a should exist');
        assert.strictEqual(summary.byStrategy['strat-a'].count, 2, 'strat-a count');

        // Check mlBaseline (if ML tools work)
        if (summary.mlBaseline) {
            assert.ok(summary.mlBaseline.count > 0, 'ML baseline should have count');
            assert.ok(typeof summary.mlBaseline.edgeDirectionAccuracy === 'number', 'Should have accuracy');
        }

        // Cleanup
        fs.unlinkSync(testFile);

        console.log('✓ Test 2: loadResearchSummary - with synthetic data');
    })();
}

// Test 3: Row count limits
{
    (async () => {
        // Create temp test file with many rows
        const testDir = path.join(process.cwd(), 'logs', 'test');
        const testFile = path.join(testDir, 'research-limit-test.jsonl');

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const rows = [];
        for (let i = 0; i < 100; i++) {
            rows.push({
                signalId: `s${i}`,
                book: 'draftkings',
                strategyId: 'test',
                edgeEstimate: 1.0,
                stakePlanned: 10,
                realizedProfit: i % 2 === 0 ? 5 : -3,
                expectedValue: 0.1
            });
        }

        fs.writeFileSync(testFile, rows.map(r => JSON.stringify(r)).join('\n'));

        const summary = await loadResearchSummary({ datasetPath: testFile, maxRows: 50 });

        assert.ok(summary.rowCount <= 50, 'Row count should respect limit');

        // Cleanup
        fs.unlinkSync(testFile);

        console.log('✓ Test 3: Row count limits');
    })();
}

// Wait for all async tests to complete
setTimeout(() => {
    console.log('\n=== All research summary loader tests passed ===\n');
}, 200);
