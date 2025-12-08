/**
 * src/metrics/executionHealthLoader.js
 * 
 * Load and analyze execution health from logs.
 * Hardened with MAX_LIMIT and proper resource cleanup.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
// ARCH_TEST_IGNORE: metrics uses execution health processing functions for data analysis only
// TODO: Consider moving computeFillRates, classifyFailures, detectSystemicFailPatterns to /metrics/healthProcessors.js
const {
    computeFillRates,
    classifyFailures,
    detectSystemicFailPatterns
} = require('../execution/executionHealthMonitor');

// ARCH_TEST_IGNORE: OOM protection guard, not a business tunable
const MAX_LIMIT = 50000;

/**
 * Stream-read JSONL file with proper cleanup.
 * @param {string} filePath - Path to JSONL file
 * @param {number} limit - Max rows to read
 * @returns {Promise<Array>} Parsed rows
 */
async function streamReadJsonl(filePath, limit = 10000) {
    const results = [];
    if (!fs.existsSync(filePath)) return results;

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;

    try {
        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                results.push(JSON.parse(line));
                count++;
                if (limit && count >= limit) break;
            } catch (e) {
                // Skip malformed lines
            }
        }
    } finally {
        // Ensure resources are cleaned up even on early break
        rl.close();
        fileStream.destroy();
    }

    return results;
}

/**
 * Load execution health summary.
 * Never throws - returns safe fallback on error.
 * @param {Object} options - Load options
 * @returns {Promise<Object>} Health summary
 */
async function loadExecutionHealth(options = {}) {
    const {
        limit = 5000,
        windowMinutes = 30,
        filePath = path.join(process.cwd(), 'logs', 'execution-events.jsonl')
    } = options;

    // Clamp limit to MAX_LIMIT to prevent OOM
    const effectiveLimit = Math.min(limit || MAX_LIMIT, MAX_LIMIT);

    try {
        // Load executions with clamped limit
        const executions = await streamReadJsonl(filePath, effectiveLimit);

        if (executions.length === 0) {
            return {
                perBook: [],
                global: {
                    fills: 0,
                    rejects: 0,
                    partials: 0,
                    unknown: 0,
                    total: 0,
                    fillRate: 0,
                    rejectRate: 0,
                    partialRate: 0
                },
                failureModes: [],
                systemicAlerts: []
            };
        }

        // Compute metrics
        const { global, perBook } = computeFillRates(executions);
        const failureModes = classifyFailures(executions);
        const systemicAlerts = detectSystemicFailPatterns(executions, { windowMinutes });

        return {
            perBook,
            global,
            failureModes,
            systemicAlerts
        };
    } catch (err) {
        // Log once here - caller should not wrap in try/catch
        console.error('[executionHealthLoader] Error:', err.message);
        return {
            perBook: [],
            global: {
                fills: 0,
                rejects: 0,
                partials: 0,
                unknown: 0,
                total: 0,
                fillRate: 0,
                rejectRate: 0,
                partialRate: 0
            },
            failureModes: [],
            systemicAlerts: [],
            error: err.message
        };
    }
}

module.exports = {
    loadExecutionHealth,
    MAX_LIMIT  // Export for testing
};
