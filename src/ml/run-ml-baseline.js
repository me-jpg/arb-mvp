/**
 * src/ml/run-ml-baseline.js
 * 
 * CLI to run ML baseline evaluation.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { buildLabelsFromRows } = require('./labelBuilder');
const { trainTestSplit } = require('./trainTestSplitter');
const { evaluateBaseline } = require('./baselineEvaluator');
const { filterRows } = require('../research/datasetExporter');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};

args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const DATASET_PATH = kwargs.dataset || path.join(process.cwd(), 'logs', 'research', 'dataset.jsonl');
const LABEL_TYPE = kwargs.labelType || 'binary_win';
const MIN_STAKE = kwargs.minStake ? parseFloat(kwargs.minStake) : null;
const TEST_RATIO = kwargs.testRatio ? parseFloat(kwargs.testRatio) : 0.2;

// Filter options
const filterOptions = {};
if (kwargs.books) {
    filterOptions.books = kwargs.books.split(',').map(b => b.trim());
}
if (kwargs.strategies) {
    filterOptions.strategies = kwargs.strategies.split(',').map(s => s.trim());
}

/**
 * Stream-read JSONL file.
 */
async function streamReadJsonl(filePath) {
    const results = [];
    if (!fs.existsSync(filePath)) return results;

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            results.push(JSON.parse(line));
        } catch (e) {
            // Skip malformed
        }
    }

    return results;
}

async function run() {
    console.log('=== ML BASELINE REPORT ===');

    // Load dataset
    let rows = await streamReadJsonl(DATASET_PATH);
    console.log(`Dataset rows: ${rows.length}`);

    if (rows.length === 0) {
        console.log('No data found. Run `npm run research:pipeline` first.');
        process.exit(0);
    }

    // Apply filters
    if (Object.keys(filterOptions).length > 0) {
        rows = filterRows(rows, filterOptions);
    }

    // Build labeled examples
    const examples = buildLabelsFromRows(rows, {
        labelType: LABEL_TYPE,
        minStake: MIN_STAKE
    });

    console.log(`Examples after filtering: ${examples.length}`);

    if (examples.length === 0) {
        console.log('No valid examples after labeling and filtering.');
        process.exit(0);
    }

    // Split train/test
    const { train, test } = trainTestSplit(examples, { testRatio: TEST_RATIO });
    console.log(`Train: ${train.length}, Test: ${test.length}`);
    console.log('');

    // Evaluate on train set
    const trainMetrics = evaluateBaseline(train);
    console.log('Train:');
    console.log(`  count: ${trainMetrics.count}`);
    console.log(`  avgEdge: ${trainMetrics.avgEdge !== null ? trainMetrics.avgEdge.toFixed(4) : 'N/A'}`);
    console.log(`  positiveRate: ${trainMetrics.positiveRate !== null ? trainMetrics.positiveRate.toFixed(4) : 'N/A'}`);
    console.log(`  edgeDirectionAccuracy: ${trainMetrics.edgeDirectionAccuracy !== null ? trainMetrics.edgeDirectionAccuracy.toFixed(4) : 'N/A'}`);
    console.log('');

    // Evaluate on test set
    const testMetrics = evaluateBaseline(test);
    console.log('Test:');
    console.log(`  count: ${testMetrics.count}`);
    console.log(`  avgEdge: ${testMetrics.avgEdge !== null ? testMetrics.avgEdge.toFixed(4) : 'N/A'}`);
    console.log(`  positiveRate: ${testMetrics.positiveRate !== null ? testMetrics.positiveRate.toFixed(4) : 'N/A'}`);
    console.log(`  edgeDirectionAccuracy: ${testMetrics.edgeDirectionAccuracy !== null ? testMetrics.edgeDirectionAccuracy.toFixed(4) : 'N/A'}`);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
