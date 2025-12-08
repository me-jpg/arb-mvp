/**
 * src/research/datasetBuilder.js
 * 
 * Assembles a unified research dataset by joining:
 * - Signals (Opportunity/Forecast)
 * - Execution (Action taken)
 * - High-Frequency Features (Context at time of signal)
 * - Latency Stats (System context)
 * - Results (Outcome)
 * 
 * FIXES:
 * - Safe timestamp parsing (no NaN)
 * - buildMarketId helper for consistent ID generation
 * - Correct latency field names from bookLatencyModel
 */

const { extractFeatures, safeTimestamp } = require('../hf/hfFeatureExtractor');
const { buildMarketState, buildMarketId } = require('../hf/marketStateEngine');
const { buildBookLatencyStats } = require('../latency/bookLatencyModel');

/**
 * Safely parse a timestamp, returning null if invalid.
 */
function safeParseDatetime(value) {
    if (value === undefined || value === null) return null;
    const ts = typeof value === 'number' ? value : new Date(value).getTime();
    return Number.isFinite(ts) ? ts : null;
}

/**
 * Builds the research dataset rows.
 * @param {Object} options
 * @param {Array<Object>} options.signals - Signals log
 * @param {Array<Object>} options.executions - Execution events log
 * @param {Array<Object>} options.hfEvents - Raw line change events
 * @param {Map<string, Object>} options.results - EventId -> Result map
 * @returns {Array<Object>} Array of joined rows
 */
function buildResearchDataset({ signals = [], executions = [], hfEvents = [], results = new Map() }) {
    if (!Array.isArray(signals) || signals.length === 0) return [];

    // Sort signals by time (skip those with invalid timestamps, put at end)
    const sortedSignals = [...signals].sort((a, b) => {
        const tA = safeParseDatetime(a.createdAt);
        const tB = safeParseDatetime(b.createdAt);
        if (tA === null && tB === null) return 0;
        if (tA === null) return 1;
        if (tB === null) return -1;
        return tA - tB;
    });

    // Index Executions by signalId
    const execMap = new Map();
    for (const ex of executions) {
        if (ex.signalId) {
            execMap.set(ex.signalId, ex);
        }
    }

    // Pre-compute global HF stats (simplified approach for offline research)
    // For accurate time-travel, each signal would need its own windowed context.
    let marketStates = {};
    let latencyStats = {};

    if (hfEvents.length > 0) {
        const globalHfFeatures = extractFeatures(hfEvents, { windowMs: 60000 });
        marketStates = buildMarketState(globalHfFeatures, { windowMs: 60000 });
        const latencyResult = buildBookLatencyStats(hfEvents);
        latencyStats = latencyResult.byBook || {};
    }

    const rows = [];

    for (const sig of sortedSignals) {
        const signalTs = safeParseDatetime(sig.createdAt);

        // Build market ID safely
        const marketId = buildMarketId({
            eventId: sig.eventId,
            marketType: sig.marketType,
            marketKey: sig.marketKey
        });

        // Basic Signal Info
        const row = {
            eventId: sig.eventId || null,
            signalId: sig.id || null,
            orderId: null,
            book: sig.primaryBook || null,
            marketType: sig.marketType || null,
            marketKey: sig.marketKey || null,

            edgeEstimate: sig.edgeEstimate || 0,
            signalType: sig.type || 'unknown',
            strategyId: sig.strategyId || null,
            stakePlanned: null,

            // Execution defaults
            filledStake: 0,
            avgFillPrice: null,
            fillStatus: 'none',
            simRunId: null,
            fillQuality: null,

            // HF defaults
            bookAvgLagMs: null,
            bookMedianLagMs: null,
            marketVolatilityScore: null,
            booksFastestReactors: null,

            // Results
            realizedProfit: null,
            expectedValue: null,
            outcome: null,

            // Times
            signalTimestamp: sig.createdAt || null,
            executionTimestamp: null
        };

        // 1. Join Execution
        const exec = execMap.get(sig.id);
        if (exec) {
            row.orderId = exec.orderId || null;
            row.stakePlanned = exec.amount || exec.plannedAmount || null;
            row.filledStake = exec.filledAmount || exec.filledStake || 0;
            row.avgFillPrice = exec.filledPrice || exec.avgFillPrice || null;
            row.fillStatus = exec.status || 'unknown';
            row.simRunId = exec.simRunId || null;
            row.fillQuality = exec.fillQuality || null;
            row.executionTimestamp = exec.timestamp || null;
        }

        // 2. Join HF / Market State
        if (marketId && marketStates[marketId]) {
            const mState = marketStates[marketId];
            row.marketVolatilityScore = mState.volatilityScore;
            row.booksFastestReactors = mState.booksFastestReactors;
        }

        // 3. Join Latency Stats (correct field names from bookLatencyModel)
        const book = sig.primaryBook;
        if (book && latencyStats[book]) {
            const bStat = latencyStats[book];
            row.bookAvgLagMs = bStat.avgLagMs ?? null;
            row.bookMedianLagMs = bStat.medianLagMs ?? null;
        }

        // 4. Join Results (basic - just attach score info)
        if (sig.eventId && results.has(sig.eventId)) {
            const res = results.get(sig.eventId);
            if (res && res.final) {
                // Basic attachment; actual P&L calculation would require grading logic
                row.outcome = 'scored'; // Placeholder - real grading needs bet details
            }
        }

        rows.push(row);
    }

    return rows;
}

module.exports = {
    buildResearchDataset
};
