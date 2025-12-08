/**
 * src/risk/stakeSizingAnalyzer.js
 * 
 * Offline analyzer for stake sizing performance.
 * Read-only analysis of execution logs + P&L results.
 */

/**
 * Analyze stake sizing performance from executions.
 * @param {Object} params
 * @param {Array} params.signals - Signal array
 * @param {Array} params.executionEvents - Execution events
 * @param {Object} params.results - Results map (eventId -> outcome)
 * @returns {Object} Performance analysis by mode
 */
function analyzeStakeSizingFromExecutions({ signals = [], executionEvents = [], results = {} } = {}) {
    // Build signal lookup
    const signalMap = {};
    for (const sig of signals) {
        const id = sig.id || sig.signalId;
        if (id) signalMap[id] = sig;
    }

    // Analyze each execution
    const byMode = {};
    let totalFills = 0;

    for (const event of executionEvents) {
        const status = event.status || event.orderStatus;

        // Only analyze filled/partial orders
        if (status !== 'filled' && status !== 'partial') continue;

        totalFills++;

        // Extract stake sizing metadata
        const stakeSizingMeta = event.metadata?.stakeSizing || event.stakeSizing;
        const mode = stakeSizingMeta?.mode || 'unknown';

        // Get stake
        const stake = event.filledStake || event.stake || 0;

        // Get source signal for edge/mlScore
        const sourceSignalId = event.sourceSignalId || event.signalId;
        const sourceSignal = signalMap[sourceSignalId] || {};

        // Get result/outcome
        const eventId = event.eventId;
        const outcome = results[eventId] || {};

        // Calculate realized profit
        // Simple approach: use realizedProfit if available, otherwise estimate from outcome
        let realizedProfit = 0;
        if (typeof event.realizedProfit === 'number') {
            realizedProfit = event.realizedProfit;
        } else if (outcome.score !== undefined) {
            // If score is 1 (win), profit ≈ stake * (price - 1)
            // If score is 0 (loss), profit ≈ -stake
            const price = event.avgFillPrice || event.price || 2.0;
            if (outcome.score === 1) {
                realizedProfit = stake * (price - 1);
            } else if (outcome.score === 0) {
                realizedProfit = -stake;
            } else if (outcome.score === 0.5) {
                realizedProfit = 0; // Push/void
            }
        }

        // Initialize mode group if needed
        if (!byMode[mode]) {
            byMode[mode] = {
                count: 0,
                totalStake: 0,
                realizedProfit: 0,
                wins: 0,
                losses: 0,
                pushes: 0,
                edgeSum: 0,
                mlScoreSum: 0,
                mlScoreCount: 0
            };
        }

        const group = byMode[mode];
        group.count++;
        group.totalStake += stake;
        group.realizedProfit += realizedProfit;

        // Track wins/losses
        if (realizedProfit > 0) group.wins++;
        else if (realizedProfit < 0) group.losses++;
        else group.pushes++;

        // Accumulate edge/mlScore if available
        if (typeof sourceSignal.edgeEstimate === 'number') {
            group.edgeSum += sourceSignal.edgeEstimate;
        }
        if (typeof sourceSignal.mlScore === 'number') {
            group.mlScoreSum += sourceSignal.mlScore;
            group.mlScoreCount++;
        }
    }

    // Compute derived metrics for each mode
    const modes = {};
    let overallCount = 0;
    let overallStake = 0;
    let overallProfit = 0;

    for (const [mode, data] of Object.entries(byMode)) {
        const avgStake = data.count > 0 ? data.totalStake / data.count : 0;
        const roi = data.totalStake > 0 ? data.realizedProfit / data.totalStake : 0;
        const hitRate = data.count > 0 ? data.wins / data.count : 0;
        const avgEdge = data.count > 0 ? data.edgeSum / data.count : null;
        const avgMlScore = data.mlScoreCount > 0 ? data.mlScoreSum / data.mlScoreCount : null;

        modes[mode] = {
            count: data.count,
            totalStake: data.totalStake,
            realizedProfit: data.realizedProfit,
            avgStake,
            roi,
            hitRate,
            avgEdge,
            avgMlScore
        };

        overallCount += data.count;
        overallStake += data.totalStake;
        overallProfit += data.realizedProfit;
    }

    const overallRoi = overallStake > 0 ? overallProfit / overallStake : 0;

    return {
        modes,
        overall: {
            count: overallCount,
            totalStake: overallStake,
            realizedProfit: overallProfit,
            roi: overallRoi
        }
    };
}

module.exports = {
    analyzeStakeSizingFromExecutions
};
