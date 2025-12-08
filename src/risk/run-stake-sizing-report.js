/**
 * src/risk/run-stake-sizing-report.js
 * 
 * CLI tool to analyze stake sizing performance.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { analyzeStakeSizingFromExecutions } = require('./stakeSizingAnalyzer');

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
const RESULTS_PATH = kwargs.results || path.join(process.cwd(), 'results', 'results.jsonl');
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

/**
 * Load results into eventId map.
 */
async function loadResults(filePath) {
    const resultsMap = {};
    if (!fs.existsSync(filePath)) return resultsMap;

    const rows = await streamReadJsonl(filePath, Infinity);
    for (const row of rows) {
        if (row.eventId) {
            resultsMap[row.eventId] = row;
        }
    }

    return resultsMap;
}

async function run() {
    console.log('=== STAKE SIZING PERFORMANCE REPORT ===\n');

    // Load data
    const signals = await streamReadJsonl(SIGNALS_PATH, LIMIT_SIGNALS);
    console.log(`Loaded ${signals.length} signals`);

    const executionEvents = await streamReadJsonl(EXECUTION_PATH, LIMIT_EXEC);
    console.log(`Loaded ${executionEvents.length} execution events`);

    const results = await loadResults(RESULTS_PATH);
    console.log(`Loaded ${Object.keys(results).length} results\n`);

    if (executionEvents.length === 0) {
        console.log('No execution events found.');
        process.exit(0);
    }

    // Analyze
    const analysis = analyzeStakeSizingFromExecutions({ signals, executionEvents, results });

    // Print overall
    console.log(`Fills analyzed: ${analysis.overall.count}`);
    console.log(`Total stake: $${analysis.overall.totalStake.toFixed(2)}`);
    console.log(`Realized profit: ${analysis.overall.realizedProfit >= 0 ? '+' : ''}$${analysis.overall.realizedProfit.toFixed(2)} (ROI ${(analysis.overall.roi * 100).toFixed(1)}%)\n`);

    // Print by mode
    if (Object.keys(analysis.modes).length > 0) {
        console.log('By stake sizing mode:');

        // Sort by count descending
        const sorted = Object.entries(analysis.modes).sort((a, b) => b[1].count - a[1].count);

        for (const [mode, stats] of sorted) {
            console.log(`  ${mode}:`);
            console.log(`    fills: ${stats.count}`);
            console.log(`    total stake: $${stats.totalStake.toFixed(2)}`);
            console.log(`    profit: ${stats.realizedProfit >= 0 ? '+' : ''}$${stats.realizedProfit.toFixed(2)}   (ROI ${(stats.roi * 100).toFixed(1)}%)`);
            console.log(`    avg stake: $${stats.avgStake.toFixed(2)}`);
            console.log(`    hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
            if (stats.avgEdge !== null) {
                console.log(`    avg edge: ${(stats.avgEdge * 100).toFixed(2)}%`);
            }
            if (stats.avgMlScore !== null) {
                console.log(`    avg ML score: ${stats.avgMlScore.toFixed(3)}`);
            }
            console.log('');
        }
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
