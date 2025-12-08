/**
 * src/hf/run-market-state.js
 * 
 * CLI to analyze market state from HF logs.
 * Pipeline: Logs -> extractFeatures -> buildMarketState -> Summary
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const config = require('../../config');
const { extractFeatures } = require('./hfFeatureExtractor');
const { buildMarketState } = require('./marketStateEngine');

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
const LIMIT = parseInt(kwargs.limit) || 5000;
const WINDOW_MS = parseInt(kwargs.windowMs) || 60000;

async function run() {
    console.log('=== MARKET STATE SNAPSHOT ===');
    const absolutePath = path.isAbsolute(LOG_FILE)
        ? LOG_FILE
        : path.resolve(process.cwd(), LOG_FILE);

    if (!fs.existsSync(absolutePath)) {
        console.error(`Log file not found: ${absolutePath}`);
        // Not an error per requirements, just exit 0
        process.exit(0);
    }

    // 1. Read Events
    const events = [];
    try {
        const fileStream = fs.createReadStream(absolutePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let count = 0;
        // We want the LAST N events usually for "current" state
        // But reading file backwards is hard. 
        // We'll read all (up to a safe limit?) or just read first N and sort?
        // For a CLI "snapshot", usually we want the *latest* data.
        // If the file is huge, reading from start is bad.
        // But hfFeatureExtractor needs sorted time.
        // Let's just read first N for now as requested by user logic "limit=N" typical behavior.

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const e = JSON.parse(line);
                events.push(e);
                count++;
                // If we have too many, we might process too much. 
                // In a real system we'd `tail` the file. 
                // Here we respect limit on *input events*.
                if (LIMIT && count >= LIMIT) break;
            } catch (err) { }
        }
    } catch (err) {
        console.error('Error reading logs:', err.message);
        process.exit(1);
    }

    // 2. Extract Features
    const features = extractFeatures(events, { windowMs: WINDOW_MS });

    // 3. Build Market State
    const marketStates = buildMarketState(features, { windowMs: WINDOW_MS });
    const marketIds = Object.keys(marketStates);

    console.log(`Markets analyzed: ${marketIds.length}`);

    if (marketIds.length > 0) {
        // Show top volatile
        const sortedByVol = marketIds.sort((a, b) => marketStates[b].volatilityScore - marketStates[a].volatilityScore);

        console.log('\nTop Volatile Markets:');
        const topN = sortedByVol.slice(0, 3);

        for (const id of topN) {
            const m = marketStates[id];
            console.log(`  ${id}:`);
            console.log(`    totalMoves: ${m.totalMoves}`);
            console.log(`    avgDelta: ${m.avgDelta}`);
            console.log(`    volatility: ${m.volatilityScore}`);
            console.log(`    booksActive: [${m.booksActive.join(', ')}]`);
            console.log(`    booksFastestReactors: [${(m.booksFastestReactors || []).join(', ')}]`);
            console.log(`    lastMoveMsAgo: ${m.lastMoveMsAgo}`);
        }
    } else {
        console.log('No markets found.');
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
