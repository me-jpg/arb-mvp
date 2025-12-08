/**
 * src/metrics/latencyHistoryBuffer.js
 * 
 * In-memory rolling history buffer for latency summaries.
 * Metrics-only, caller-driven, no side effects.
 */

/**
 * Create a latency history buffer.
 * @param {Object} options - Buffer options
 * @param {number} options.maxPoints - Maximum number of snapshots to keep
 * @param {number} options.minIntervalMs - Minimum time between snapshots
 * @returns {Object} Buffer instance
 */
function createLatencyHistoryBuffer(options) {
    const { maxPoints = 60, minIntervalMs = 30000 } = options;

    return {
        maxPoints,
        minIntervalMs,
        points: []
    };
}

/**
 * Add a latency snapshot to the buffer.
 * @param {Object} buffer - Buffer instance
 * @param {Object} latencySummary - Latency summary from summarizeLatencyByBook
 * @param {number} nowMs - Current timestamp in ms
 */
function addLatencySnapshot(buffer, latencySummary, nowMs) {
    // Skip if summary is empty or invalid
    if (!latencySummary ||
        !latencySummary.global ||
        latencySummary.global.totalEvents === 0 ||
        !Array.isArray(latencySummary.perBook) ||
        latencySummary.perBook.length === 0) {
        return;
    }

    // Check throttling: if last point is recent enough, skip
    if (buffer.points.length > 0) {
        const lastPoint = buffer.points[buffer.points.length - 1];
        if (nowMs - lastPoint.timestampMs < buffer.minIntervalMs) {
            return; // Too soon, skip
        }
    }

    // Clone latency summary to avoid mutation
    const clonedSummary = {
        perBook: latencySummary.perBook.map(book => ({ ...book })),
        global: { ...latencySummary.global }
    };

    // Add new point
    buffer.points.push({
        timestampMs: nowMs,
        latencySummary: clonedSummary
    });

    // Trim to maxPoints
    if (buffer.points.length > buffer.maxPoints) {
        buffer.points = buffer.points.slice(buffer.points.length - buffer.maxPoints);
    }
}

/**
 * Get latency history from buffer.
 * @param {Object} buffer - Buffer instance
 * @param {number} nowMs - Current timestamp in ms (unused, for consistency)
 * @returns {Array} Array of {timestampMs, latencySummary} points
 */
function getLatencyHistory(buffer, nowMs) {
    // Filter out invalid entries and return
    return buffer.points.filter(point =>
        point &&
        typeof point.timestampMs === 'number' &&
        point.latencySummary
    );
}

module.exports = {
    createLatencyHistoryBuffer,
    addLatencySnapshot,
    getLatencyHistory
};
