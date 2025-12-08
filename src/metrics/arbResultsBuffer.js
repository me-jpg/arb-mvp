/**
 * src/metrics/arbResultsBuffer.js
 * 
 * Rolling in-memory buffer for recent arbitrage results.
 * Pure logic - caller-driven, no timers or intervals.
 */

/**
 * Create a new arb results buffer.
 * @param {Object} options - Buffer configuration
 * @param {number} options.maxSize - Maximum number of entries
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {Object} Buffer state
 */
function createArbResultsBuffer(options = {}) {
    const maxSize = options.maxSize || 200;
    const windowMs = options.windowMs || 300000; // 5 minutes

    return {
        maxSize,
        windowMs,
        entries: []
    };
}

/**
 * Add an arb result to the buffer.
 * @param {Object} buffer - Buffer state
 * @param {Object} arbResult - Arb result to add
 * @param {number} nowMs - Current timestamp in ms
 */
function addArbResult(buffer, arbResult, nowMs) {
    // Store shallow clone to avoid mutations
    const entry = {
        eventId: arbResult.eventId || null,
        books: Array.isArray(arbResult.books) ? [...arbResult.books] : [],
        edge: arbResult.edge || 0,
        marketType: arbResult.marketType || 'unknown',
        createdAtMs: arbResult.createdAtMs || nowMs
    };

    buffer.entries.push(entry);

    // Trim old entries (outside window)
    const cutoff = nowMs - buffer.windowMs;
    buffer.entries = buffer.entries.filter(e => e.createdAtMs >= cutoff);

    // Trim by size (keep most recent maxSize)
    if (buffer.entries.length > buffer.maxSize) {
        buffer.entries.sort((a, b) => b.createdAtMs - a.createdAtMs);
        buffer.entries = buffer.entries.slice(0, buffer.maxSize);
    }
}

/**
 * Get recent arb results from buffer.
 * @param {Object} buffer - Buffer state
 * @param {number} nowMs - Current timestamp in ms
 * @returns {Array} Recent entries, sorted descending by timestamp
 */
function getRecentArbResults(buffer, nowMs) {
    const cutoff = nowMs - buffer.windowMs;

    return buffer.entries
        .filter(e => e.createdAtMs >= cutoff)
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

module.exports = {
    createArbResultsBuffer,
    addArbResult,
    getRecentArbResults
};
