/**
 * tests/research/researchPipeline.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== researchPipeline.test.js ===\n');

// Import pipeline (will use real modules for integration test)
const { runResearchPipeline } = require('../../src/research/researchPipeline');

// Test 1: Pipeline wiring and output structure
{
    // We'll do a light integration test with the actual modules
    // using minimal synthetic data that already exists

    const testOutputDir = path.join(process.cwd(), 'logs', 'research', 'test');
    const testDatasetPath = path.join(testOutputDir, 'test-dataset.jsonl');
    const testCsvPath = path.join(testOutputDir, 'test-dataset.csv');

    // Clean up any existing test outputs
    if (fs.existsSync(testDatasetPath)) fs.unlinkSync(testDatasetPath);
    if (fs.existsSync(testCsvPath)) fs.unlinkSync(testCsvPath);

    async function testPipeline() {
        try {
            // Run pipeline with existing logs (will be small/empty, that's ok)
            const summary = await runResearchPipeline({
                datasetPath: testDatasetPath,
                csvPath: testCsvPath,
                limit: 10,
                filterOptions: {} // No filters for this test
            });

            // Check summary structure
            assert.ok(summary.rowCount !== undefined, 'rowCount should exist');
            assert.ok(summary.filteredRowCount !== undefined, 'filteredRowCount should exist');
            assert.ok(summary.report, 'report should exist');
            assert.ok(summary.report.byBook, 'byBook should exist');
            assert.ok(summary.report.byStrategy, 'byStrategy should exist');
            assert.ok(Array.isArray(summary.report.edgeCalibration), 'edgeCalibration should be array');
            assert.ok(summary.output.datasetPath, 'datasetPath should exist');
            assert.ok(summary.output.csvPath, 'csvPath should exist');

            // Check outputs were created
            assert.ok(fs.existsSync(testDatasetPath), 'Dataset JSONL should be created');
            assert.ok(fs.existsSync(testCsvPath), 'CSV should be created');

            // CSV should have header
            const csvContent = fs.readFileSync(testCsvPath, 'utf8');
            assert.ok(csvContent.includes('eventId'), 'CSV should have header with eventId');
            assert.ok(csvContent.includes('book'), 'CSV should have header with book');

            console.log('✓ Test 1: Pipeline wiring and output structure');

            // Cleanup
            if (fs.existsSync(testDatasetPath)) fs.unlinkSync(testDatasetPath);
            if (fs.existsSync(testCsvPath)) fs.unlinkSync(testCsvPath);

        } catch (e) {
            console.error('Test 1 failed:', e.message);
            throw e;
        }
    }

    // Run async test
    testPipeline().then(() => {
        console.log('\n=== All research pipeline tests passed ===\n');
    }).catch(e => {
        console.error('Pipeline test failed:', e);
        process.exit(1);
    });
}
