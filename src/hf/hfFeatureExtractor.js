/**
 * src/hf/hfFeatureExtractor.js
 * 
 * Pure module to extract features from a stream/list of line change events.
 * Used for downstream analysis or ML model training.
 * 
 * PERFORMANCE: Uses index-based windowing (O(N)) instead of shift() (O(N²)).
 */

/**
 * Safely parse timestamp from event, returns null if invalid.
 * @param {Object} event 
 * @returns {number|null}
 */
function safeTimestamp(event) {
    if (!event) return null;
    const raw = event.timestamp || event.detected_at;
    if (raw === undefined || raw === null) return null;
    const ts = typeof raw === 'number' ? raw : new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : null;
}

/**
 * Extracts features from a list of events.
 * @param {Array<Object>} events - List of line change events.
 * @param {Object} options
 * @param {number} options.windowMs - Rolling window size in ms (default 60000).
 * @returns {Array<Object>} Array of feature objects.
 */
function extractFeatures(events, { windowMs = 60000 } = {}) {
    if (!Array.isArray(events) || events.length === 0) return [];

    // Ensure sorted by time (filter out invalid timestamps)
    const sortedEvents = events
        .map(e => ({ ...e, _ts: safeTimestamp(e) }))
        .filter(e => e._ts !== null)
        .sort((a, b) => a._ts - b._ts);

    if (sortedEvents.length === 0) return [];

    const features = [];

    // Track previous event per market key for time-since calculation
    // Key: eventId:marketType:marketKey:book (tracking by specific book-line stream)
    const prevEventMap = new Map();

    // O(N) Rolling Window using index pointers
    let windowStart = 0;

    for (let i = 0; i < sortedEvents.length; i++) {
        const event = sortedEvents[i];
        const ts = event._ts;

        // Advance windowStart to exclude expired events
        while (windowStart < i && sortedEvents[windowStart]._ts < ts - windowMs) {
            windowStart++;
        }

        // Window is [windowStart, i] inclusive
        let sumAbsDelta = 0;
        const booksInWindow = new Set();

        for (let j = windowStart; j <= i; j++) {
            const wEvent = sortedEvents[j];
            const d = getDelta(wEvent);
            sumAbsDelta += Math.abs(d);
            booksInWindow.add(wEvent.book);
        }

        const windowCount = i - windowStart + 1;
        const avgAbsDelta = windowCount > 0 ? sumAbsDelta / windowCount : 0;

        // Current Event Features
        const currentDelta = getDelta(event);
        const key = `${event.eventId}:${event.marketType}:${event.marketKey}:${event.book}`;
        const prevTs = prevEventMap.get(key);

        const feat = {
            eventId: event.eventId,
            marketType: event.marketType,
            marketKey: event.marketKey,
            book: event.book,
            delta: currentDelta,
            absDelta: Math.abs(currentDelta),
            isIncrease: currentDelta > 0,
            timeSincePrevMs: prevTs !== undefined ? ts - prevTs : null,
            windowRollup: {
                count: windowCount,
                avgAbsDelta: parseFloat(avgAbsDelta.toFixed(4)),
                booksInWindow: Array.from(booksInWindow)
            },
            timestamp: ts
        };

        features.push(feat);

        // Update state
        prevEventMap.set(key, ts);
    }

    return features;
}

/**
 * Helper to get numeric delta from event.
 * Priority: price change, then line change.
 */
function getDelta(event) {
    let valNew = event.newPrice;
    let valOld = event.oldPrice;

    if (valNew === undefined || valNew === null) {
        valNew = event.newLine;
        valOld = event.oldLine;
    }

    if (valNew === undefined || valNew === null || valOld === undefined || valOld === null) {
        return 0;
    }

    return Number(valNew) - Number(valOld);
}

module.exports = {
    extractFeatures,
    safeTimestamp // Exported for use by other modules
};
