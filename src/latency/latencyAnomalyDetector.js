/**
 * src/latency/latencyAnomalyDetector.js
 * 
 * Detects abnormal book delays vs historical baselines.
 * Uses statistical analysis (mean, std dev, z-scores) to flag anomalies.
 */

const { buildBookLatencyStats } = require('./bookLatencyModel');

/**
 * Build latency baselines for each book.
 * @param {Array<Object>} events - HF/latency events
 * @param {Object} options
 * @param {number} options.lookbackMs - Time window for baseline (default 86400000 = 24h)
 * @param {number} options.minSamples - Minimum samples required (default 100)
 * @returns {Object} Baselines by book
 */
function buildLatencyBaselines(events, { lookbackMs = 86400000, minSamples = 100 } = {}) {
    if (!Array.isArray(events) || events.length === 0) {
        return { byBook: {} };
    }

    // We need the raw lags to compute std dev, so we'll recompute them
    // Sort events by timestamp
    const sortedEvents = events.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp || e.detected_at).getTime()
    })).filter(e => !isNaN(e.timestamp)).sort((a, b) => a.timestamp - b.timestamp);

    // Group by market and find lags (simplified from bookLatencyModel)
    const perBookLags = {}; // { book: [lag1, lag2, ...] }

    // Simple clustering: group events by eventId+marketType
    const eventGroups = {};
    for (const e of sortedEvents) {
        const key = `${e.eventId}:${e.marketType}:${e.side || 'na'}:${e.marketKey || ''}`;
        if (!eventGroups[key]) eventGroups[key] = [];
        eventGroups[key].push(e);
    }

    // For each group, compute lags
    for (const events of Object.values(eventGroups)) {
        if (events.length < 2) continue;

        // Simple approach: find first timestamp, compute lags for all
        const firstTs = Math.min(...events.map(e => e.timestamp));
        const booksInCluster = new Set();

        for (const e of events) {
            if (booksInCluster.has(e.book)) continue; // Only count first reaction per book
            booksInCluster.add(e.book);

            const lag = e.timestamp - firstTs;
            if (!perBookLags[e.book]) perBookLags[e.book] = [];
            perBookLags[e.book].push(lag);
        }
    }

    // Compute baselines from lags
    const baselines = { byBook: {} };

    for (const [book, lags] of Object.entries(perBookLags)) {
        if (lags.length < minSamples) {
            continue;
        }

        // Calculate mean
        const sum = lags.reduce((a, b) => a + b, 0);
        const mean = sum / lags.length;

        // Calculate std deviation
        let sumSqDiff = 0;
        for (const lag of lags) {
            const diff = lag - mean;
            sumSqDiff += diff * diff;
        }
        const variance = sumSqDiff / lags.length;
        const stdLagMs = Math.sqrt(variance);

        baselines.byBook[book] = {
            avgLagMs: Math.round(mean),
            stdLagMs: parseFloat(stdLagMs.toFixed(2)),
            sampleCount: lags.length
        };
    }

    return baselines;
}

/**
 * Detect latency anomalies by comparing current lags to baselines.
 * @param {Array<Object>} events - Recent events to analyze
 * @param {Object} baselines - Output from buildLatencyBaselines
 * @param {Object} options
 * @param {number} options.thresholdStdDevs - Z-score threshold (default 3)
 * @param {number} options.minSamples - Skip if baseline has < this many samples
 * @returns {Array<Object>} Array of anomaly objects
 */
function detectLatencyAnomalies(events, baselines, { thresholdStdDevs = 3, minSamples = 100 } = {}) {
    if (!Array.isArray(events) || events.length === 0) {
        return [];
    }

    if (!baselines || !baselines.byBook) {
        return [];
    }

    const anomalies = [];

    // Compute current lags for each event
    // We'll use the same clustering logic as bookLatencyModel
    const currentStats = buildBookLatencyStats(events);

    // For each book with current data, compare to baseline
    for (const [book, stats] of Object.entries(currentStats.byBook || {})) {
        const baseline = baselines.byBook[book];

        if (!baseline) {
            // No baseline for this book
            continue;
        }

        if (baseline.sampleCount < minSamples) {
            // Skip - not enough historical data
            continue;
        }

        // Check if current lag is anomalous
        const observedLagMs = stats.avgLagMs;
        const baselineAvgLagMs = baseline.avgLagMs;
        const baselineStdLagMs = baseline.stdLagMs;

        // Handle zero std dev case
        if (baselineStdLagMs === 0) {
            // If std is 0, any deviation is anomalous
            if (Math.abs(observedLagMs - baselineAvgLagMs) > 0.1) {
                anomalies.push({
                    book,
                    eventId: null, // We don't have specific event context here
                    marketType: null,
                    marketKey: null,
                    observedLagMs,
                    baselineAvgLagMs,
                    baselineStdLagMs: 0,
                    zScore: Infinity,
                    at: null,
                    severity: 'critical'
                });
            }
            continue;
        }

        // Calculate z-score
        const zScore = Math.abs(observedLagMs - baselineAvgLagMs) / baselineStdLagMs;

        if (zScore >= thresholdStdDevs) {
            // Determine severity
            let severity = 'warn';
            if (zScore >= thresholdStdDevs + 1) {
                severity = 'critical';
            }

            anomalies.push({
                book,
                eventId: null,
                marketType: null,
                marketKey: null,
                observedLagMs,
                baselineAvgLagMs,
                baselineStdLagMs,
                zScore: parseFloat(zScore.toFixed(2)),
                at: null,
                severity
            });
        }
    }

    return anomalies;
}

module.exports = {
    buildLatencyBaselines,
    detectLatencyAnomalies
};
