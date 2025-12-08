/**
 * src/research/run-export-dataset.js
 * 
 * CLI to export filtered research dataset to CSV.
 * 
 * Default fields exported:
 * - eventId, signalId, orderId
 * - book, marketType, marketKey
 * - edgeEstimate, expectedValue
 * - stakePlanned, filledStake, avgFillPrice, fillStatus
 * - realizedProfit, outcome
 * - strategyId, signalType
 * - bookAvgLagMs, bookMedianLagMs
 * - marketVolatilityScore
 * - signalTimestamp, executionTimestamp
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { filterRows, toCsv } = require('./datasetExporter');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};
const flags = new Set();

args.forEach(arg => {
    if (arg.startsWith('--')) {
        const parts = arg.slice(2).split('=');
        if (parts.length === 2) {
            kwargs[parts[0]] = parts[1];
        } else {
            flags.add(parts[0]);
        }
    }
});

const DEFAULT_LOGS = path.join(process.cwd(), 'logs', 'research');
const DATASET_PATH = kwargs.dataset || path.join(DEFAULT_LOGS, 'dataset.jsonl');
const OUT_PATH = kwargs.out || path.join(DEFAULT_LOGS, 'dataset.csv');

// Parse filter options
const filterOptions = {};

if (kwargs.books) {
    filterOptions.books = kwargs.books.split(',').map(b => b.trim());
}

if (kwargs.strategies) {
    filterOptions.strategies = kwargs.strategies.split(',').map(s => s.trim());
}

if (kwargs.minEdge !== undefined) {
    filterOptions.minEdge = parseFloat(kwargs.minEdge);
}

if (flags.has('hasExecution')) {
    filterOptions.hasExecution = true;
}

if (flags.has('hasResult')) {
    filterOptions.hasResult = true;
}

// Default fields to export
const DEFAULT_FIELDS = [
    'eventId',
    'signalId',
    'orderId',
    'book',
    'marketType',
    'marketKey',
    'edgeEstimate',
    'expectedValue',
    'stakePlanned',
    'filledStake',
    'avgFillPrice',
    'fillStatus',
    'realizedProfit',
    'outcome',
    'strategyId',
    'signalType',
    'bookAvgLagMs',
    'bookMedianLagMs',
    'marketVolatilityScore',
    'signalTimestamp',
    'executionTimestamp'
];

/**
 * Load dataset rows from JSONL file (streaming).
 */
async function loadDataset(filePath) {
    const rows = [];
    if (!fs.existsSync(filePath)) {
        console.error(`Dataset not found: ${filePath}`);
        return rows;
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            rows.push(JSON.parse(line));
        } catch (e) {
            // Skip malformed lines
        }
    }

    return rows;
}

async function run() {
    console.log('=== RESEARCH DATASET EXPORT ===');

    // Load dataset
    const rows = await loadDataset(DATASET_PATH);
    console.log(`Input rows: ${rows.length}`);

    if (rows.length === 0) {
        console.log('No dataset rows found. Run `npm run research:dataset` first.');
        process.exit(0);
    }

    // Apply filters
    const filtered = filterRows(rows, filterOptions);
    console.log(`Filtered rows: ${filtered.length}`);

    // Convert to CSV
    const csv = toCsv(filtered, DEFAULT_FIELDS);

    // Write output
    const outDir = path.dirname(OUT_PATH);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(OUT_PATH, csv, 'utf8');
    console.log(`Output: ${OUT_PATH}`);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
