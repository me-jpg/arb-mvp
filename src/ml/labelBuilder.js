/**
 * src/ml/labelBuilder.js
 * 
 * Derives ML-friendly labels from research dataset rows.
 */

/**
 * Build labeled examples from research dataset rows.
 * @param {Array<Object>} rows - Research dataset rows
 * @param {Object} options
 * @param {string} options.labelType - "binary_win" or "edge_sign"
 * @param {number} options.minStake - Minimum stake filter
 * @returns {Array<Object>} Array of labeled examples
 */
function buildLabelsFromRows(rows, { labelType = 'binary_win', minStake = null } = {}) {
    const examples = [];

    for (const row of rows) {
        // Filter by minStake if specified
        if (minStake !== null && minStake !== undefined) {
            const stake = row.stakePlanned || row.filledStake || 0;
            if (stake < minStake) continue;
        }

        // Derive label based on labelType
        let label = null;

        if (labelType === 'binary_win') {
            const profit = row.realizedProfit;
            if (profit === null || profit === undefined) {
                continue; // Skip if no profit data
            }
            if (profit > 0) {
                label = 1;
            } else if (profit < 0) {
                label = 0;
            } else {
                continue; // Skip pushes (profit === 0)
            }
        } else if (labelType === 'edge_sign') {
            const edge = row.edgeEstimate;
            if (edge === null || edge === undefined) {
                continue; // Skip if no edge
            }
            if (edge > 0) {
                label = 1;
            } else if (edge < 0) {
                label = -1;
            } else {
                label = 0;
            }
        } else {
            throw new Error(`Unknown labelType: ${labelType}`);
        }

        // Skip if label is null
        if (label === null) continue;

        // Build example with numeric features
        const example = {
            id: row.signalId || row.orderId || row.eventId || `unknown_${examples.length}`,
            features: {
                edgeEstimate: typeof row.edgeEstimate === 'number' ? row.edgeEstimate : null,
                bookAvgLagMs: typeof row.bookAvgLagMs === 'number' ? row.bookAvgLagMs : null,
                bookMedianLagMs: typeof row.bookMedianLagMs === 'number' ? row.bookMedianLagMs : null,
                marketVolatilityScore: typeof row.marketVolatilityScore === 'number' ? row.marketVolatilityScore : null,
                stakePlanned: typeof row.stakePlanned === 'number' ? row.stakePlanned : null,
                filledStake: typeof row.filledStake === 'number' ? row.filledStake : null,
                expectedValue: typeof row.expectedValue === 'number' ? row.expectedValue : null
            },
            label
        };

        examples.push(example);
    }

    return examples;
}

module.exports = {
    buildLabelsFromRows
};
