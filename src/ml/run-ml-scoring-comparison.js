/**
 * src/ml/run-ml-scoring-comparison.js
 * 
 * CLI to compare multiple ML scoring modes.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { compareScoringModes } = require('./scoringComparison');

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
const TEST_RATIO = kwargs.testRatio ? parseFloat(kwargs.testRatio) : 0.2;
const MIN_STAKE = kwargs.minStake ? parseFloat(kwargs.minStake) : 0;
const MODES_STR = kwargs.modes || 'baseline,edge_plus_latency,linear_model';
const MODEL_PATH = kwargs.model || path.join(process.cwd(), 'models', 'linear-model.json');

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
    console.log('=== ML SCORING COMPARISON ===\n');

    // Load dataset
    const rows = await streamReadJsonl(DATASET_PATH);
    console.log(`Dataset rows: ${rows.length}`);

    if (rows.length === 0) {
        console.log('No dataset found.');
        process.exit(0);
    }

    // Build modes array
    const modeNames = MODES_STR.split(',').map(m => m.trim());
    const modes = modeNames.map(modeName => {
        if (modeName === 'linear_model') {
            return {
                id: 'linear_model',
                mode: 'linear_model',
                modelPath: MODEL_PATH
            };
        } else {
            return {
                id: modeName,
                mode: modeName
            };
        }
    });

    // Run comparison
    const result = await compareScoringModes(rows, {
        labelType: LABEL_TYPE,
        minStake: MIN_STAKE,
        testRatio: TEST_RATIO,
        modes
    });

    // Print results
    console.log(`Labeled examples: ${result.dataset.labeled}`);
    console.log(`Train: ${result.dataset.trainCount}, Test: ${result.dataset.testCount}\n`);

    if (result.modes.length === 0) {
        console.log('No modes evaluated.');
        process.exit(0);
    }

    for (const mode of result.modes) {
        console.log(`Mode: ${mode.id}`);

        if (mode.error) {
            console.log(`  Error: ${mode.error}\n`);
            continue;
        }

        console.log(`  avgScore: ${mode.avgScore.toFixed(3)}`);
        console.log(`  avgLabel: ${mode.avgLabel.toFixed(3)}`);
        console.log(`  corr(score,label): ${mode.correlation.toFixed(3)}`);
        console.log('  Buckets:');

        for (const bucket of mode.buckets) {
            const range = bucket.to === 1.0
                ? `[${bucket.from.toFixed(1)},${bucket.to.toFixed(1)}]`
                : `[${bucket.from.toFixed(1)},${bucket.to.toFixed(1)})`;
            console.log(`    ${range}: count ${bucket.count}, avgLabel ${bucket.avgLabel.toFixed(2)}`);
        }

        console.log('');
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
