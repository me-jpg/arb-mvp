/**
 * src/research/reportGenerator.js
 * 
 * Pure aggregation functions for research dataset analysis.
 * Produces summaries by book, strategy, and edge calibration.
 */

/**
 * Aggregate dataset rows by book.
 * @param {Array<Object>} rows - Dataset rows from datasetBuilder
 * @returns {Object} Map of book -> stats
 */
function summarizeByBook(rows) {
    const bookStats = {};

    for (const row of rows) {
        const book = row.book;
        if (!book || !row.stakePlanned || row.stakePlanned <= 0) continue;

        if (!bookStats[book]) {
            bookStats[book] = {
                count: 0,
                totalStake: 0,
                realizedProfit: 0,
                expectedValue: 0,
                totalEdge: 0,
                edgeCount: 0
            };
        }

        const stats = bookStats[book];
        stats.count++;
        stats.totalStake += row.stakePlanned || 0;
        stats.realizedProfit += row.realizedProfit || 0;
        stats.expectedValue += row.expectedValue || 0;

        if (row.edgeEstimate !== null && row.edgeEstimate !== undefined) {
            stats.totalEdge += row.edgeEstimate;
            stats.edgeCount++;
        }
    }

    // Compute derived metrics
    const result = {};
    for (const [book, stats] of Object.entries(bookStats)) {
        result[book] = {
            count: stats.count,
            totalStake: stats.totalStake,
            realizedProfit: stats.realizedProfit,
            expectedValue: stats.expectedValue > 0 ? stats.expectedValue : null,
            avgEdge: stats.edgeCount > 0 ? stats.totalEdge / stats.edgeCount : null,
            roi: stats.totalStake > 0 ? (stats.realizedProfit / stats.totalStake) * 100 : null
        };
    }

    return result;
}

/**
 * Aggregate dataset rows by strategy.
 * @param {Array<Object>} rows - Dataset rows from datasetBuilder
 * @returns {Object} Map of strategyId -> stats
 */
function summarizeByStrategy(rows) {
    const strategyStats = {};

    for (const row of rows) {
        const strategy = row.strategyId || 'unknown';
        if (!row.stakePlanned || row.stakePlanned <= 0) continue;

        if (!strategyStats[strategy]) {
            strategyStats[strategy] = {
                count: 0,
                totalStake: 0,
                realizedProfit: 0,
                expectedValue: 0,
                totalEdge: 0,
                edgeCount: 0
            };
        }

        const stats = strategyStats[strategy];
        stats.count++;
        stats.totalStake += row.stakePlanned || 0;
        stats.realizedProfit += row.realizedProfit || 0;
        stats.expectedValue += row.expectedValue || 0;

        if (row.edgeEstimate !== null && row.edgeEstimate !== undefined) {
            stats.totalEdge += row.edgeEstimate;
            stats.edgeCount++;
        }
    }

    // Compute derived metrics
    const result = {};
    for (const [strategy, stats] of Object.entries(strategyStats)) {
        result[strategy] = {
            count: stats.count,
            totalStake: stats.totalStake,
            realizedProfit: stats.realizedProfit,
            expectedValue: stats.expectedValue > 0 ? stats.expectedValue : null,
            avgEdge: stats.edgeCount > 0 ? stats.totalEdge / stats.edgeCount : null,
            roi: stats.totalStake > 0 ? (stats.realizedProfit / stats.totalStake) * 100 : null
        };
    }

    return result;
}

/**
 * Bucket rows by edge estimate and compute calibration stats.
 * @param {Array<Object>} rows - Dataset rows
 * @param {Object} options
 * @param {Array<number>} options.buckets - Bucket boundaries
 * @returns {Array<Object>} Array of bucket stats
 */
function summarizeEdgeCalibration(rows, { buckets = [-999, -5, -2, 0, 1, 2, 5, 10, 999] } = {}) {
    // Initialize buckets
    const bucketStats = [];
    for (let i = 0; i < buckets.length - 1; i++) {
        const lower = buckets[i];
        const upper = buckets[i + 1];

        let label;
        if (lower === -999) label = `< ${upper}`;
        else if (upper === 999) label = `>= ${lower}`;
        else label = `[${lower},${upper})`;

        bucketStats.push({
            bucketLabel: label,
            lower,
            upper,
            count: 0,
            totalEdge: 0,
            totalEV: 0,
            totalRealized: 0
        });
    }

    // Bucket rows (only those with valid stake, consistent with other summaries)
    for (const row of rows) {
        const edge = row.edgeEstimate;
        if (edge === null || edge === undefined) continue;
        if (!row.stakePlanned || row.stakePlanned <= 0) continue;

        // Find bucket
        for (const bucket of bucketStats) {
            if (edge >= bucket.lower && edge < bucket.upper) {
                bucket.count++;
                bucket.totalEdge += edge;
                bucket.totalEV += row.expectedValue || 0;
                bucket.totalRealized += row.realizedProfit || 0;
                break;
            }
        }
    }

    // Compute averages
    return bucketStats.map(b => ({
        bucketLabel: b.bucketLabel,
        count: b.count,
        avgEdge: b.count > 0 ? parseFloat((b.totalEdge / b.count).toFixed(2)) : null,
        avgEV: b.count > 0 ? parseFloat((b.totalEV / b.count).toFixed(2)) : null,
        avgRealized: b.count > 0 ? parseFloat((b.totalRealized / b.count).toFixed(2)) : null
    }));
}

module.exports = {
    summarizeByBook,
    summarizeByStrategy,
    summarizeEdgeCalibration
};
