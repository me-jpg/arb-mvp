/**
 * src/research/run-build-dataset.js
 * 
 * CLI to build the research dataset.
 * Loads signals, executions, HF logs, and results, then merges them.
 * 
 * FIXES:
 * - Streaming JSONL reader for large files (no OOM on 200MB+)
 * - Removed unused simulatePnL import
 * - Proper write stream handling with finish event
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { loadSignals } = require('../signals/signalLoader');
const { loadResults } = require('../results/resultsLoader');
const { buildResearchDataset } = require('./datasetBuilder');

// TODO: Future integration - simulatePnL could enrich rows with realizedProfit/EV
// const { simulatePnL } = require('../results/pnlSimulator');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};
args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

// Paths
const DEFAULT_LOGS = path.join(process.cwd(), 'logs');
const SIGNALS_PATH = kwargs.signals || path.join(DEFAULT_LOGS, 'signals.jsonl');
const EXEC_PATH = kwargs.execution || path.join(DEFAULT_LOGS, 'execution', 'execution-events.jsonl');
const HF_PATH = kwargs.hf || path.join(DEFAULT_LOGS, 'line-changes.jsonl');
const RESULTS_PATH = kwargs.results || path.join(process.cwd(), 'results');
const OUT_PATH = kwargs.out || path.join(DEFAULT_LOGS, 'research', 'dataset.jsonl');

const LIMIT = parseInt(kwargs.limit) || 0;

/**
 * Stream-read a JSONL file, respecting a limit.
 * Memory efficient for large files.
 */
async function streamReadJsonl(filePath, limit = 0) {
    const results = [];
    if (!fs.existsSync(filePath)) return results;

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            results.push(JSON.parse(line));
            count++;
            if (limit > 0 && count >= limit) break;
        } catch (e) {
            // Skip malformed JSON lines
        }
    }

    return results;
}

async function run() {
    console.log('Building Research Dataset...');
    console.log(`Signals: ${SIGNALS_PATH}`);
    console.log(`Execution: ${EXEC_PATH}`);
    console.log(`HF: ${HF_PATH}`);

    // 1. Load Signals (signalLoader already handles limits)
    const signals = loadSignals({ filepath: SIGNALS_PATH, limit: LIMIT || 10000 });
    console.log(`Loaded ${signals.length} signals`);

    // 2. Load Executions (streaming)
    const executions = await streamReadJsonl(EXEC_PATH, 0); // No limit on executions
    console.log(`Loaded ${executions.length} execution events`);

    // 3. Load HF Events (streaming with optional limit)
    // HF logs can be huge, so we apply limit here if specified
    const hfLimit = LIMIT > 0 ? LIMIT * 100 : 0; // Allow more HF context
    const hfEvents = await streamReadJsonl(HF_PATH, hfLimit);
    console.log(`Loaded ${hfEvents.length} HF line changes`);

    // 4. Load Results
    const resultMap = loadResults({ resultsPath: RESULTS_PATH });
    console.log(`Loaded results for ${resultMap.size} events`);

    // 5. Build Dataset
    const rows = buildResearchDataset({
        signals,
        executions,
        hfEvents,
        results: resultMap
    });

    // 6. Write Output (with proper stream handling)
    const outDir = path.dirname(OUT_PATH);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    await new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(OUT_PATH);
        let execCount = 0;

        for (const row of rows) {
            if (row.filledStake > 0) execCount++;
            stream.write(JSON.stringify(row) + '\n');
        }

        stream.end();
        stream.on('finish', () => {
            console.log(`\n=== RESEARCH DATASET BUILT ===`);
            console.log(`Rows: ${rows.length}`);
            console.log(`Signals with execution: ${execCount}`);
            console.log(`Output: ${OUT_PATH}`);
            resolve();
        });
        stream.on('error', reject);
    });
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
