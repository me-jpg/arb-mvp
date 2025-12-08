/**
 * src/hf/marketStateEngine.js
 * 
 * Aggregates high-frequency features into market-level state statistics.
 * Helps identify volatile markets and fast-reacting books.
 * 
 * MATH FIX: Uses consistent raw delta for mean and std dev calculation.
 * NAMING FIX: `booksFastestReactors` clarifies the semantics (lowest timeSincePrevMs).
 */

/**
 * Builds market state from features.
 * @param {Array<Object>} features - Output from hfFeatureExtractor.
 * @param {Object} options
 * @param {number} options.windowMs - Window size for volatility normalization (default 60000).
 * @returns {Object} Map of marketID -> MarketState
 */
function buildMarketState(features, { windowMs = 60000 } = {}) {
    if (!Array.isArray(features) || features.length === 0) return {};

    const markets = {};

    // 1. Group by Market ID
    for (const feat of features) {
        const marketId = buildMarketId(feat);
        if (!marketId) continue;

        if (!markets[marketId]) {
            markets[marketId] = {
                id: marketId,
                eventId: feat.eventId,
                marketType: feat.marketType,
                marketKey: feat.marketKey,
                features: [],
                maxTs: 0
            };
        }

        markets[marketId].features.push(feat);
        if (feat.timestamp && feat.timestamp > markets[marketId].maxTs) {
            markets[marketId].maxTs = feat.timestamp;
        }
    }

    // Find global max timestamp
    let globalMaxTs = 0;
    for (const f of features) {
        if (f.timestamp > globalMaxTs) globalMaxTs = f.timestamp;
    }

    const marketStates = {};

    // 2. Aggregate per Market
    for (const [id, data] of Object.entries(markets)) {
        const feats = data.features;
        const count = feats.length;

        // --- CORRECTED MATH ---
        // Using RAW delta (signed) for mean and std dev.
        // This captures directional volatility.
        let sumDelta = 0;
        let sumAbsDelta = 0;
        const bookStats = {}; // book -> { count, sumLag }
        const booksActiveSet = new Set();

        for (const f of feats) {
            sumDelta += f.delta;
            sumAbsDelta += f.absDelta;
            booksActiveSet.add(f.book);

            // Track reaction time (timeSincePrevMs)
            // Lower = faster reactor
            if (f.timeSincePrevMs !== null && f.timeSincePrevMs >= 0) {
                if (!bookStats[f.book]) bookStats[f.book] = { count: 0, sumLag: 0 };
                bookStats[f.book].count++;
                bookStats[f.book].sumLag += f.timeSincePrevMs;
            }
        }

        const avgDelta = sumDelta / count;
        const avgAbsDelta = sumAbsDelta / count;

        // Variance of raw delta: Var(X) = E[(X - μ)²]
        // Two-pass for numerical stability on small datasets
        let sumSqDiff = 0;
        for (const f of feats) {
            const diff = f.delta - avgDelta;
            sumSqDiff += diff * diff;
        }
        const variance = sumSqDiff / count;
        const stdDelta = Math.sqrt(variance);

        // Volatility Score: stdDelta * frequency (moves per minute equivalent)
        // Higher std + more moves = more volatile
        const volatilityScore = parseFloat((stdDelta * count).toFixed(2));

        // Rank Books by FASTEST REACTION TIME (lowest avg timeSincePrevMs)
        // These are "fast reactors", NOT necessarily "initiators/leaders".
        const bookRankings = Object.entries(bookStats)
            .filter(([, s]) => s.count > 0)
            .map(([book, s]) => ({ book, avgLag: s.sumLag / s.count }))
            .sort((a, b) => a.avgLag - b.avgLag)
            .map(b => b.book);

        marketStates[id] = {
            eventId: data.eventId,
            marketType: data.marketType,
            marketKey: data.marketKey,
            totalMoves: count,
            avgDelta: parseFloat(avgDelta.toFixed(3)),
            avgAbsDelta: parseFloat(avgAbsDelta.toFixed(3)),
            stdDelta: parseFloat(stdDelta.toFixed(3)),
            volatilityScore,
            booksActive: Array.from(booksActiveSet),
            booksFastestReactors: bookRankings.slice(0, 3), // Top 3, renamed for clarity
            lastMoveMsAgo: globalMaxTs - data.maxTs
        };
    }

    return marketStates;
}

/**
 * Safely build a market ID from a feature or signal.
 * Returns null if required fields are missing.
 */
function buildMarketId(obj) {
    if (!obj || !obj.eventId) return null;
    const mt = obj.marketType || 'unknown';
    const mk = obj.marketKey || 'default';
    return `${obj.eventId}_${mt}_${mk}`;
}

module.exports = {
    buildMarketState,
    buildMarketId // Exported for use by datasetBuilder
};
