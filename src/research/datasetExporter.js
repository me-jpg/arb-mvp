/**
 * src/research/datasetExporter.js
 * 
 * Filter and export research dataset to CSV for external analysis.
 */

/**
 * Filter dataset rows based on criteria.
 * @param {Array<Object>} rows - Dataset rows
 * @param {Object} options - Filter options
 * @param {Array<string>} options.books - Keep only these books
 * @param {Array<string>} options.strategies - Keep only these strategies
 * @param {number} options.minEdge - Minimum edge estimate
 * @param {boolean} options.hasExecution - Require non-null filledStake
 * @param {boolean} options.hasResult - Require non-null realizedProfit
 * @returns {Array<Object>} Filtered rows
 */
function filterRows(rows, options = {}) {
    let filtered = rows;

    // Filter by books
    if (options.books && Array.isArray(options.books) && options.books.length > 0) {
        const bookSet = new Set(options.books);
        filtered = filtered.filter(row => bookSet.has(row.book));
    }

    // Filter by strategies
    if (options.strategies && Array.isArray(options.strategies) && options.strategies.length > 0) {
        const strategySet = new Set(options.strategies);
        filtered = filtered.filter(row => strategySet.has(row.strategyId));
    }

    // Filter by minimum edge
    if (options.minEdge !== undefined && options.minEdge !== null) {
        filtered = filtered.filter(row => {
            const edge = row.edgeEstimate;
            return edge !== null && edge !== undefined && edge >= options.minEdge;
        });
    }

    // Filter by execution presence
    if (options.hasExecution === true) {
        filtered = filtered.filter(row => {
            return row.filledStake !== null && row.filledStake !== undefined && row.filledStake > 0;
        });
    }

    // Filter by result presence
    if (options.hasResult === true) {
        filtered = filtered.filter(row => {
            return row.realizedProfit !== null && row.realizedProfit !== undefined;
        });
    }

    return filtered;
}

/**
 * Escape a CSV field value.
 * Quotes the field if it contains comma, quote, or newline.
 * Doubles quotes inside the field.
 */
function escapeCsvField(value) {
    if (value === null || value === undefined) return '';

    const str = String(value);

    // Check if escaping is needed
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        // Double any quotes and wrap in quotes
        return '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
}

/**
 * Convert rows to CSV format.
 * @param {Array<Object>} rows - Dataset rows
 * @param {Array<string>} fields - Field names to include in order
 * @returns {string} CSV string with header and data rows
 */
function toCsv(rows, fields) {
    if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error('fields array is required');
    }

    const lines = [];

    // Header row
    lines.push(fields.map(escapeCsvField).join(','));

    // Data rows
    for (const row of rows) {
        const values = fields.map(field => {
            const value = row[field];
            return escapeCsvField(value);
        });
        lines.push(values.join(','));
    }

    return lines.join('\n');
}

module.exports = {
    filterRows,
    toCsv
};
