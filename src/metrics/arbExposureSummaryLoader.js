/**
 * src/metrics/arbExposureSummaryLoader.js
 * 
 * Read-only loader for arb exposure summary.
 * Uses arbExposureAnalyzer to compute hedged vs unhedged metrics.
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { analyzeArbExposure } = require('../execution/arbExposureAnalyzer');

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
 * Load arb exposure summary.
 * @param {Object} options
 * @param {string} options.signalsPath - Path to signals JSONL
 * @param {string} options.executionPath - Path to execution events JSONL
 * @param {number} options.limitSignals - Max signals to load
 * @param {number} options.limitExec - Max execution events to load
 * @returns {Promise<Object>} Arb exposure summary
 */
async function loadArbExposureSummary({
    signalsPath = null,
    executionPath = null,
    limitSignals = 5000,
    limitExec = 5000
} = {}) {
    const defaultSignalsPath = path.join(process.cwd(), 'logs', 'signals.jsonl');
    const defaultExecutionPath = path.join(process.cwd(), 'logs', 'execution', 'execution-events.jsonl');

    const sigPath = signalsPath || defaultSignalsPath;
    const execPath = executionPath || defaultExecutionPath;

    try {
        const signals = await streamReadJsonl(sigPath, limitSignals);
        const executionEvents = await streamReadJsonl(execPath, limitExec);

        if (signals.length === 0) {
            return {
                groups: 0,
                pairs: 0,
                fullyHedged: 0,
                unhedgedSingleLeg: 0,
                noFill: 0,
                totalUnhedgedExposure: 0,
                byBook: {},
                worstUnhedged: []
            };
        }

        const analysis = analyzeArbExposure({ signals, executionEvents });

        return {
            groups: analysis.totals.groups,
            pairs: analysis.totals.pairs,
            fullyHedged: analysis.totals.fullyHedged,
            unhedgedSingleLeg: analysis.totals.unhedgedSingleLeg,
            noFill: analysis.totals.noFill,
            totalUnhedgedExposure: analysis.totals.totalUnhedgedExposure,
            byBook: analysis.byBook,
            worstUnhedged: analysis.worstUnhedged
        };
    } catch (err) {
        console.error('[arbExposureSummaryLoader] Failed to load arb exposure:', err.message);
        return {
            groups: 0,
            pairs: 0,
            fullyHedged: 0,
            unhedgedSingleLeg: 0,
            noFill: 0,
            totalUnhedgedExposure: 0,
            byBook: {},
            worstUnhedged: []
        };
    }
}

module.exports = {
    loadArbExposureSummary
};
