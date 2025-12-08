/**
 * src/research/researchPipeline.js
 * 
 * Orchestrates the full research pipeline:
 * 1. Build dataset from logs
 * 2. Generate reports
 * 3. Export to CSV
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { loadSignals } = require('../signals/signalLoader');
const { loadResults } = require('../results/resultsLoader');
const { buildResearchDataset } = require('./datasetBuilder');
const { summarizeByBook, summarizeByStrategy, summarizeEdgeCalibration } = require('./reportGenerator');
const { filterRows, toCsv } = require('./datasetExporter');

// Default CSV fields
const DEFAULT_CSV_FIELDS = [
    'eventId', 'signalId', 'orderId', 'book', 'marketType', 'marketKey',
    'edgeEstimate', 'expectedValue', 'stakePlanned', 'filledStake',
    'avgFillPrice', 'fillStatus', 'realizedProfit', 'outcome',
    'strategyId', 'signalType', 'bookAvgLagMs', 'bookMedianLagMs',
    'marketVolatilityScore', 'signalTimestamp', 'executionTimestamp'
];

/**
 * Stream-read a JSONL file.
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
            // Skip malformed lines
        }
    }

    return results;
}

/**
 * Run the full research pipeline.
 * @param {Object} options
 * @param {string} options.signalsPath - Path to signals JSONL
 * @param {string} options.executionPath - Path to execution events JSONL
 * @param {string} options.hfPath - Path to HF line changes JSONL
 * @param {string} options.resultsPath - Path to results directory
 * @param {string} options.datasetPath - Output path for dataset JSONL
 * @param {string} options.csvPath - Output path for CSV export
 * @param {number} options.limit - Optional limit on input rows
 * @param {Object} options.filterOptions - Filter options for CSV export
 * @returns {Object} Summary of pipeline execution
 */
async function runResearchPipeline(options = {}) {
    // Resolve paths with defaults
    const DEFAULT_LOGS = path.join(process.cwd(), 'logs');
    const signalsPath = options.signalsPath || path.join(DEFAULT_LOGS, 'signals.jsonl');
    const executionPath = options.executionPath || path.join(DEFAULT_LOGS, 'execution', 'execution-events.jsonl');
    const hfPath = options.hfPath || path.join(DEFAULT_LOGS, 'line-changes.jsonl');
    const resultsPath = options.resultsPath || path.join(process.cwd(), 'results');
    const datasetPath = options.datasetPath || path.join(DEFAULT_LOGS, 'research', 'dataset.jsonl');
    const csvPath = options.csvPath || path.join(DEFAULT_LOGS, 'research', 'dataset.csv');

    const limit = options.limit || 0;

    // 1. Load data sources
    const signals = loadSignals({ filepath: signalsPath, limit: limit || 10000 });
    const executions = await streamReadJsonl(executionPath, 0);
    const hfLimit = limit > 0 ? limit * 100 : 0;
    const hfEvents = await streamReadJsonl(hfPath, hfLimit);
    const results = loadResults({ resultsPath });

    // 2. Build dataset
    const rows = buildResearchDataset({
        signals,
        executions,
        hfEvents,
        results
    });

    // 3. Generate reports
    const byBook = summarizeByBook(rows);
    const byStrategy = summarizeByStrategy(rows);
    const edgeCalibration = summarizeEdgeCalibration(rows);

    // 4. Apply filters and export to CSV
    const filterOptions = options.filterOptions || { hasExecution: true, hasResult: true };
    const filteredRows = filterRows(rows, filterOptions);
    const csv = toCsv(filteredRows, DEFAULT_CSV_FIELDS);

    // 5. Write outputs
    // Ensure directories exist
    const datasetDir = path.dirname(datasetPath);
    if (!fs.existsSync(datasetDir)) {
        fs.mkdirSync(datasetDir, { recursive: true });
    }

    // Write JSONL dataset
    const jsonlLines = rows.map(row => JSON.stringify(row)).join('\n');
    fs.writeFileSync(datasetPath, jsonlLines, 'utf8');

    // Write CSV export
    fs.writeFileSync(csvPath, csv, 'utf8');

    // 6. Return summary
    return {
        rowCount: rows.length,
        filteredRowCount: filteredRows.length,
        report: {
            byBook,
            byStrategy,
            edgeCalibration
        },
        output: {
            datasetPath,
            csvPath
        }
    };
}

module.exports = {
    runResearchPipeline
};
