/**
 * src/hf/run-hf-features.js
 * 
 * CLI to extract features from line changes.
 * Usage: node src/hf/run-hf-features.js --limit=5000 --windowMs=60000
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const config = require('../../config');
const { extractFeatures } = require('./hfFeatureExtractor');

// Args
const args = process.argv.slice(2);
const kwargs = {};
args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const LOG_FILE = kwargs.file || config.logs?.lineChanges || 'logs/line-changes.jsonl';
const LIMIT = parseInt(kwargs.limit) || 1000;
const WINDOW_MS = parseInt(kwargs.windowMs) || 60000;

async function run() {
    console.log('=== HF FEATURE SUMMARY ===');
    const absolutePath = path.isAbsolute(LOG_FILE)
        ? LOG_FILE
        : path.resolve(process.cwd(), LOG_FILE);

    if (!fs.existsSync(absolutePath)) {
        console.error(`Log file not found: ${absolutePath}`);
        process.exit(1);
    }

    const events = [];
    try {
        const fileStream = fs.createReadStream(absolutePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let count = 0;
        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const e = JSON.parse(line);
                events.push(e);
                count++;
                if (LIMIT && count >= LIMIT) break;
            } catch (err) { }
        }
    } catch (err) {
        console.error('Error reading logs:', err.message);
        process.exit(1);
    }

    console.log(`Events input: ${events.length}`);
    console.log(`Window: ${WINDOW_MS}ms`);

    const features = extractFeatures(events, { windowMs: WINDOW_MS });

    console.log(`Features produced: ${features.length}`);

    if (features.length > 0) {
        console.log('Example feature:');
        // Print last feature as it likely has fuller window history
        const example = features[features.length - 1];
        console.log(JSON.stringify(example, null, 2));
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
