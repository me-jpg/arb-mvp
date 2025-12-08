/**
 * src/hf/hfStreamEngine.js
 * 
 * Simulated HF streaming layer for incremental log replay.
 * Maintains rolling window state and computes features + market state incrementally.
 */

const { safeTimestamp } = require('./hfFeatureExtractor');
const { buildMarketId } = require('./marketStateEngine');

/**
 * Get delta from event.
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

/**
 * Create an HF stream engine that processes events incrementally.
 * @param {Object} options
 * @param {number} options.windowMs - Rolling window size
 * @param {Function} options.onTick - Called for each event ({ event, feature, marketState })
 * @param {Function} options.onBatchEnd - Called at end ({ count, lastTimestamp })
 * @returns {Object} Engine with processEvent method
 */
function createHfStreamEngine({
    windowMs = 60000,
    onTick,
    onBatchEnd
} = {}) {
    // State tracking
    const marketStates = new Map(); // marketId -> { features: [...], maxTs, stats }
    const prevEventMap = new Map(); // key -> timestamp for timeSincePrev
    let eventCount = 0;
    let lastTimestamp = null;

    function processEvent(event) {
        const ts = safeTimestamp(event);
        if (ts === null) return;

        eventCount++;
        lastTimestamp = ts;

        const marketId = buildMarketId({
            eventId: event.eventId,
            marketType: event.marketType,
            marketKey: event.marketKey
        });

        if (!marketId) return;

        // Initialize market state if needed
        if (!marketStates.has(marketId)) {
            marketStates.set(marketId, {
                id: marketId,
                eventId: event.eventId,
                marketType: event.marketType,
                marketKey: event.marketKey,
                features: [],
                maxTs: 0,
                booksActiveSet: new Set(),
                bookStats: {} // book -> { count, sumLag, sumDelta, sumSqDelta }
            });
        }

        const mState = marketStates.get(marketId);

        // Compute feature for this event
        const currentDelta = getDelta(event);
        const key = `${event.eventId}:${event.marketType}:${event.marketKey}:${event.book}`;
        const prevTs = prevEventMap.get(key);

        // Update window - remove old features
        const cutoffTime = ts - windowMs;
        mState.features = mState.features.filter(f => f.timestamp >= cutoffTime);

        // Compute window stats for feature
        const windowCount = mState.features.length + 1; // +1 for current
        const booksInWindow = new Set([...mState.features.map(f => f.book), event.book]);
        let sumAbsDelta = currentDelta !== undefined ? Math.abs(currentDelta) : 0;
        for (const f of mState.features) {
            sumAbsDelta += f.absDelta || 0;
        }
        const avgAbsDelta = windowCount > 0 ? sumAbsDelta / windowCount : 0;

        const feature = {
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

        // Add feature to market's history
        mState.features.push(feature);
        mState.maxTs = Math.max(mState.maxTs, ts);
        mState.booksActiveSet.add(event.book);

        // Update book stats for market state
        if (!mState.bookStats[event.book]) {
            mState.bookStats[event.book] = { count: 0, sumLag: 0, sumDelta: 0, sumSqDelta: 0 };
        }
        const bStat = mState.bookStats[event.book];
        bStat.count++;
        bStat.sumDelta += currentDelta;
        bStat.sumSqDelta += currentDelta * currentDelta;
        if (feature.timeSincePrevMs !== null && feature.timeSincePrevMs >= 0) {
            bStat.sumLag += feature.timeSincePrevMs;
        }

        // Update prev timestamp
        prevEventMap.set(key, ts);

        // Compute market state for this market
        const totalMoves = mState.features.length;
        let sumDelta = 0;
        let sumAbsDeltaTotal = 0;

        for (const f of mState.features) {
            sumDelta += f.delta;
            sumAbsDeltaTotal += f.absDelta;
        }

        const avgDelta = totalMoves > 0 ? sumDelta / totalMoves : 0;
        const avgAbsDeltaTotal = totalMoves > 0 ? sumAbsDeltaTotal / totalMoves : 0;

        // Variance and stdDelta
        let sumSqDiff = 0;
        for (const f of mState.features) {
            const diff = f.delta - avgDelta;
            sumSqDiff += diff * diff;
        }
        const variance = totalMoves > 0 ? sumSqDiff / totalMoves : 0;
        const stdDelta = Math.sqrt(variance);

        // Volatility score
        const volatilityScore = parseFloat((stdDelta * totalMoves).toFixed(2));

        // Books fastest reactors
        const bookRankings = Object.entries(mState.bookStats)
            .filter(([, s]) => s.count > 0 && s.sumLag > 0)
            .map(([book, s]) => ({ book, avgLag: s.sumLag / s.count }))
            .sort((a, b) => a.avgLag - b.avgLag)
            .map(b => b.book);

        const marketState = {
            eventId: mState.eventId,
            marketType: mState.marketType,
            marketKey: mState.marketKey,
            totalMoves,
            avgDelta: parseFloat(avgDelta.toFixed(3)),
            avgAbsDelta: parseFloat(avgAbsDeltaTotal.toFixed(3)),
            stdDelta: parseFloat(stdDelta.toFixed(3)),
            volatilityScore,
            booksActive: Array.from(mState.booksActiveSet),
            booksFastestReactors: bookRankings.slice(0, 3),
            lastMoveMsAgo: 0 // Always 0 since this is the "current" market
        };

        // Call onTick callback
        if (onTick) {
            onTick({ event, feature, marketState });
        }
    }

    function finish() {
        if (onBatchEnd) {
            onBatchEnd({ count: eventCount, lastTimestamp });
        }
    }

    return {
        processEvent,
        finish
    };
}

/**
 * Run HF stream from a list of events.
 * @param {Array<Object>} events - HF events
 * @param {Object} options - Same as createHfStreamEngine options
 */
function runHfStreamFromEvents(events, options = {}) {
    // Sort by timestamp
    const sorted = [...events]
        .map(e => ({ ...e, _ts: safeTimestamp(e) }))
        .filter(e => e._ts !== null)
        .sort((a, b) => a._ts - b._ts);

    const engine = createHfStreamEngine(options);

    for (const event of sorted) {
        engine.processEvent(event);
    }

    engine.finish();
}

module.exports = {
    createHfStreamEngine,
    runHfStreamFromEvents
};
