/**
 * src/execution/run-arb-exposure-report.js
 * 
 * CLI tool to analyze arb pairs and unhedged exposure.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { analyzeArbExposure } = require('./arbExposureAnalyzer');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};

args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const SIGNALS_PATH = kwargs.signals || path.join(process.cwd(), 'logs', 'signals.jsonl');
const EXECUTION_PATH = kwargs.execution || path.join(process.cwd(), 'logs', 'execution', 'execution-events.jsonl');
const LIMIT_SIGNALS = kwargs.limitSignals ? parseInt(kwargs.limitSignals, 10) : Infinity;
const LIMIT_EXEC = kwargs.limitExec ? parseInt(kwargs.limitExec, 10) : Infinity;

/**
 * Stream-read JSONL file.
 */
async function streamReadJsonl(filePath, limit = Infinity) {
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
            if (count >= limit) break;
        } catch (e) {
            // Skip malformed
        }
    }

    return results;
}

async function run() {
    console.log('=== ARB EXPOSURE REPORT ===\n');

    // Load signals
    const signals = await streamReadJsonl(SIGNALS_PATH, LIMIT_SIGNALS);
    console.log(`Loaded ${signals.length} signals from ${SIGNALS_PATH}`);

    // Load execution events
    const executionEvents = await streamReadJsonl(EXECUTION_PATH, LIMIT_EXEC);
    console.log(`Loaded ${executionEvents.length} execution events from ${EXECUTION_PATH}`);
    console.log('');

    if (signals.length === 0) {
        console.log('No signals found. Cannot analyze arb pairs.');
        process.exit(0);
    }

    // Analyze
    const analysis = analyzeArbExposure({ signals, executionEvents });

    // Print report
    console.log(`Groups: ${analysis.totals.groups} | Pairs: ${analysis.totals.pairs}\n`);
    console.log(`Fully hedged pairs:     ${analysis.totals.fullyHedged}`);
    console.log(`Unhedged single-leg:    ${analysis.totals.unhedgedSingleLeg}`);
    console.log(`No-fill pairs:          ${analysis.totals.noFill}\n`);
    console.log(`Total unhedged exposure (stake): $${analysis.totals.totalUnhedgedExposure.toFixed(2)}\n`);

    if (Object.keys(analysis.byBook).length > 0) {
        console.log('By book:');
        for (const [book, stats] of Object.entries(analysis.byBook)) {
            console.log(`  ${book.padEnd(15)} unhedged pairs ${stats.unhedgedPairs.toString().padStart(3)}, exposure $${stats.unhedgedExposure.toFixed(2).padStart(10)}`);
        }
        console.log('');
    }

    if (analysis.worstUnhedged.length > 0) {
        console.log('Worst unhedged (top 5):');
        for (const item of analysis.worstUnhedged.slice(0, 5)) {
            console.log(`  ${item.groupId.padEnd(40)} exposure $${item.exposure.toFixed(2).padStart(8)}  books: [${item.books.join(', ')}]`);
        }
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
