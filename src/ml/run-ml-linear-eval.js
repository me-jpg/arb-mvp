/**
 * src/ml/run-ml-linear-eval.js
 * 
 * CLI to evaluate a linear model against the research dataset.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { scoreExample } = require('./modelAdapter');
const { buildLabelsFromRows } = require('./labelBuilder');
const { trainTestSplit } = require('./trainTestSplitter');

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
const MODEL_PATH = kwargs.model || path.join(process.cwd(), 'models', 'linear-model.json');
const LABEL_TYPE = kwargs.labelType || 'binary_win';
const TEST_RATIO = kwargs.testRatio ? parseFloat(kwargs.testRatio) : 0.2;
const MIN_STAKE = kwargs.minStake ? parseFloat(kwargs.minStake) : 0;

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

/**
 * Calculate correlation between two arrays.
 */
function correlation(arr1, arr2) {
    if (arr1.length !== arr2.length || arr1.length === 0) return 0;

    const mean1 = arr1.reduce((sum, v) => sum + v, 0) / arr1.length;
    const mean2 = arr2.reduce((sum, v) => sum + v, 0) / arr2.length;

    let num = 0, den1 = 0, den2 = 0;
    for (let i = 0; i < arr1.length; i++) {
        const diff1 = arr1[i] - mean1;
        const diff2 = arr2[i] - mean2;
        num += diff1 * diff2;
        den1 += diff1 * diff1;
        den2 += diff2 * diff2;
    }

    if (den1 === 0 || den2 === 0) return 0;
    return num / Math.sqrt(den1 * den2);
}

async function run() {
    console.log('=== ML LINEAR MODEL EVAL ===\n');

    // Load dataset
    const rows = await streamReadJsonl(DATASET_PATH);
    console.log(`Dataset rows: ${rows.length}`);

    if (rows.length === 0) {
        console.log('No dataset found.');
        process.exit(0);
    }

    // Build labeled examples
    const labeledExamples = buildLabelsFromRows(rows, { labelType: LABEL_TYPE, minStake: MIN_STAKE });
    console.log(`Labeled examples: ${labeledExamples.length}`);

    if (labeledExamples.length === 0) {
        console.log('No labeled examples after filtering.');
        process.exit(0);
    }

    // Split train/test
    const { train, test } = trainTestSplit(labeledExamples, { testRatio: TEST_RATIO, seed: 42 });
    console.log(`Train: ${train.length}, Test: ${test.length}\n`);

    // Score test examples
    const scoredTest = test.map(ex => {
        const scored = scoreExample(ex, { mode: 'linear_model', modelPath: MODEL_PATH });
        return {
            ...scored,
            label: ex.label
        };
    });

    // Compute metrics
    const scores = scoredTest.map(s => s.score);
    const labels = scoredTest.map(s => s.label);

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const avgLabel = labels.reduce((sum, l) => sum + l, 0) / labels.length;
    const corr = correlation(scores, labels);

    console.log('Test metrics:');
    console.log(`  avgScore: ${avgScore.toFixed(3)}`);
    console.log(`  avgLabel: ${avgLabel.toFixed(3)}`);
    console.log(`  corr(score, label): ${corr.toFixed(3)}\n`);

    // Compute bucketed performance
    const buckets = [
        { min: 0.0, max: 0.2, count: 0, labelSum: 0 },
        { min: 0.2, max: 0.4, count: 0, labelSum: 0 },
        { min: 0.4, max: 0.6, count: 0, labelSum: 0 },
        { min: 0.6, max: 0.8, count: 0, labelSum: 0 },
        { min: 0.8, max: 1.0, count: 0, labelSum: 0 }
    ];

    for (const item of scoredTest) {
        for (const bucket of buckets) {
            if (item.score >= bucket.min && item.score < bucket.max) {
                bucket.count++;
                bucket.labelSum += item.label;
                break;
            } else if (item.score === 1.0 && bucket.max === 1.0) {
                bucket.count++;
                bucket.labelSum += item.label;
                break;
            }
        }
    }

    console.log('  Buckets (by score):');
    for (const bucket of buckets) {
        const avgLabel = bucket.count > 0 ? bucket.labelSum / bucket.count : 0;
        const range = bucket.max === 1.0 ? `[${bucket.min.toFixed(1)},${bucket.max.toFixed(1)}]` : `[${bucket.min.toFixed(1)},${bucket.max.toFixed(1)})`;
        console.log(`    ${range}: count ${bucket.count}, avgLabel ${avgLabel.toFixed(2)}`);
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
