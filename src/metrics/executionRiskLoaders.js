/**
 * src/metrics/executionRiskLoaders.js
 * 
 * Read-only helpers to load execution and risk summaries from logs.
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
 * Load execution summary from execution events log.
 * @param {Object} options
 * @param {number} options.limit - Max events to read
 * @param {number} options.lookbackMs - Only consider recent events
 * @param {string} options.logPath - Path to execution events log
 * @returns {Promise<Object>} Execution summary
 */
async function loadExecutionSummary({ limit = 10000, lookbackMs = null, logPath = null } = {}) {
    const defaultPath = path.join(process.cwd(), 'logs', 'execution', 'execution-events.jsonl');
    const filepath = logPath || defaultPath;

    try {
        const events = await streamReadJsonl(filepath, limit);

        if (events.length === 0) {
            return {
                totalOrders: 0,
                filled: 0,
                partial: 0,
                rejected: 0,
                blocked: 0,
                fillRate: 0,
                books: {}
            };
        }

        // Filter by lookback if specified
        let filteredEvents = events;
        if (lookbackMs !== null) {
            const cutoff = Date.now() - lookbackMs;
            filteredEvents = events.filter(e => {
                const ts = new Date(e.timestamp || e.at).getTime();
                return !isNaN(ts) && ts >= cutoff;
            });
        }

        // Aggregate
        let totalOrders = 0;
        let filled = 0;
        let partial = 0;
        let rejected = 0;
        let blocked = 0;
        const bookStats = {};

        for (const event of filteredEvents) {
            totalOrders++;
            const status = event.status || event.orderStatus;
            const book = event.book;

            // Initialize book stats
            if (book && !bookStats[book]) {
                bookStats[book] = { count: 0, filled: 0, rejected: 0 };
            }

            if (book) {
                bookStats[book].count++;
            }

            if (status === 'filled') {
                filled++;
                if (book) bookStats[book].filled++;
            } else if (status === 'partial') {
                partial++;
            } else if (status === 'rejected') {
                rejected++;
                if (book) bookStats[book].rejected++;
            } else if (status === 'blocked' || status === 'risk-blocked') {
                blocked++;
            }
        }

        const fillRate = totalOrders > 0 ? filled / totalOrders : 0;

        return {
            totalOrders,
            filled,
            partial,
            rejected,
            blocked,
            fillRate: parseFloat(fillRate.toFixed(4)),
            books: bookStats
        };
    } catch (err) {
        console.error('[executionRiskLoaders] Failed to load execution summary:', err.message);
        return {
            totalOrders: 0,
            filled: 0,
            partial: 0,
            rejected: 0,
            blocked: 0,
            fillRate: 0,
            books: {}
        };
    }
}

/**
 * Load risk summary from risk snapshots log.
 * @param {Object} options
 * @param {number} options.limit - Max snapshots to read
 * @param {string} options.logPath - Path to risk snapshots log
 * @returns {Promise<Object>} Risk summary
 */
async function loadRiskSummary({ limit = 5000, logPath = null } = {}) {
    const defaultPath = path.join(process.cwd(), 'logs', 'risk', 'risk-snapshots.jsonl');
    const filepath = logPath || defaultPath;

    try {
        const snapshots = await streamReadJsonl(filepath, limit);

        if (snapshots.length === 0) {
            return {
                snapshotCount: 0,
                latest: {
                    bankroll: null,
                    exposureTotal: null,
                    exposureByBook: {},
                    currentDayLoss: null,
                    mode: null
                }
            };
        }

        // Get the latest snapshot (last one in file)
        const latest = snapshots[snapshots.length - 1];

        return {
            snapshotCount: snapshots.length,
            latest: {
                bankroll: typeof latest.bankroll === 'number' ? latest.bankroll : null,
                exposureTotal: typeof latest.exposureTotal === 'number' ? latest.exposureTotal : null,
                exposureByBook: latest.exposureByBook || {},
                currentDayLoss: typeof latest.currentDayLoss === 'number' ? latest.currentDayLoss : null,
                mode: latest.mode || latest.riskMode || null
            }
        };
    } catch (err) {
        console.error('[executionRiskLoaders] Failed to load risk summary:', err.message);
        return {
            snapshotCount: 0,
            latest: {
                bankroll: null,
                exposureTotal: null,
                exposureByBook: {},
                currentDayLoss: null,
                mode: null
            }
        };
    }
}

module.exports = {
    loadExecutionSummary,
    loadRiskSummary
};
