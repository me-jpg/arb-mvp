/**
 * src/metrics/researchSummaryLoader.js
 * 
 * Read-only loader for research dataset summaries.
 * Aggregates edge quality metrics per-book, per-strategy, and ML baseline.
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

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
 * Load research summary from dataset.
 * @param {Object} options
 * @param {string} options.datasetPath - Path to dataset JSONL
 * @param {number} options.maxRows - Max rows to load
 * @returns {Promise<Object>} Research summary
 */
async function loadResearchSummary({ datasetPath = null, maxRows = 10000 } = {}) {
    const defaultPath = path.join(process.cwd(), 'logs', 'research', 'dataset.jsonl');
    const filepath = datasetPath || defaultPath;

    try {
        const rows = await streamReadJsonl(filepath, maxRows);

        if (rows.length === 0) {
            return {
                rowCount: 0,
                byBook: {},
                byStrategy: {},
                edgeCalibration: [],
                mlBaseline: null
            };
        }

        // Use existing research tools
        const { summarizeByBook, summarizeByStrategy, summarizeEdgeCalibration } = require('../research/reportGenerator');

        const byBook = summarizeByBook(rows);
        const byStrategy = summarizeByStrategy(rows);
        const edgeCalibration = summarizeEdgeCalibration(rows);

        // Compute ML baseline
        let mlBaseline = null;
        try {
            const { buildLabelsFromRows } = require('../ml/labelBuilder');
            const { evaluateBaseline } = require('../ml/baselineEvaluator');

            const examples = buildLabelsFromRows(rows, { labelType: 'binary_win' });

            if (examples.length > 0) {
                const baseline = evaluateBaseline(examples);
                mlBaseline = {
                    count: baseline.count,
                    avgEdge: baseline.avgEdge,
                    positiveRate: baseline.positiveRate,
                    edgeDirectionAccuracy: baseline.edgeDirectionAccuracy
                };
            }
        } catch (err) {
            console.error('[researchSummaryLoader] Failed to compute ML baseline:', err.message);
        }

        return {
            rowCount: rows.length,
            byBook,
            byStrategy,
            edgeCalibration,
            mlBaseline
        };
    } catch (err) {
        console.error('[researchSummaryLoader] Failed to load research summary:', err.message);
        return {
            rowCount: 0,
            byBook: {},
            byStrategy: {},
            edgeCalibration: [],
            mlBaseline: null
        };
    }
}

module.exports = {
    loadResearchSummary
};
