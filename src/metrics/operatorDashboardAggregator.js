/**
 * src/metrics/operatorDashboardAggregator.js
 * 
 * Backend aggregation layer for operator dashboard.
 * Pure aggregation logic: array-in → object-out.
 */

const { createArbResultsBuffer, addArbResult, getRecentArbResults } = require('./arbResultsBuffer');
const { getArbResultsBufferConfig } = require('../../config');

// Single in-memory buffer instance at module scope
const arbResultsBuffer = createArbResultsBuffer(getArbResultsBufferConfig());

/**
 * Build operator dashboard snapshot from input data.
 * 
 * @param {Object} input - Input data
 * @param {Array} input.recentArbResults - Latest arbResult objects
 * @param {Array} input.recentHedgeResults - Hedge execution results
 * @param {Array} input.recentHealthAdvisories - Health advisory log entries
 * @param {Object} input.riskSummary - Exposure, caps, PnL data
 * @param {Object} input.modeSummary - Execution mode, safety flags
 * @returns {Object} Consolidated dashboard snapshot
 */
function buildOperatorDashboardSnapshot(input = {}) {
    const {
        recentArbResults = [],
        recentHedgeResults = [],
        recentHealthAdvisories = [],
        riskSummary = {},
        modeSummary = {}
    } = input;

    // Aggregate execution stats
    const execution = aggregateExecutionStats(recentArbResults, modeSummary);

    // Aggregate risk metrics
    const risk = aggregateRiskMetrics(riskSummary);

    // Aggregate health advisories
    const health = aggregateHealthAdvisories(recentHealthAdvisories);

    return {
        timestamp: new Date().toISOString(),
        execution,
        risk,
        health
    };
}

/**
 * Aggregate execution statistics from arb results.
 */
function aggregateExecutionStats(recentArbResults, modeSummary) {
    const stats = {
        totalArbs: 0,
        completed: 0,
        partial: 0,
        failed: 0,
        skipped: 0,
        blockedBySafety: 0,
        blockedByLatency: 0
    };

    const recentArbs = [];
    const booksSet = new Set();
    let latestTimestamp = null;

    for (const arbResult of recentArbResults) {
        stats.totalArbs++;

        // Count by status
        const status = arbResult.overallStatus;
        if (status === 'completed') stats.completed++;
        else if (status === 'partial') stats.partial++;
        else if (status === 'failed') stats.failed++;
        else if (status === 'skipped') stats.skipped++;

        // Check notes for specific blockers
        const notes = arbResult.notes || [];
        if (notes.includes('latency_guard_blocked')) {
            stats.blockedByLatency++;
        }
        if (notes.includes('safety_gate_blocked') || arbResult.overallStatus === 'blocked_by_safety_gate') {
            stats.blockedBySafety++;
        }

        // Extract books from legs
        for (const leg of arbResult.legs || []) {
            if (leg.book) booksSet.add(leg.book);
        }

        // Track latest timestamp
        const arbTimestamp = arbResult.timestamp || arbResult.completedAt || arbResult.startedAt;
        if (arbTimestamp) {
            if (!latestTimestamp || new Date(arbTimestamp) > new Date(latestTimestamp)) {
                latestTimestamp = arbTimestamp;
            }
        }

        // Add to recent arbs summary
        recentArbs.push({
            arbId: arbResult.arbId || arbResult.id,
            overallStatus: status,
            books: Array.from(booksSet),
            hasHedgingPlan: !!(arbResult.hedgingPlan && arbResult.hedgingPlan.hedges),
            hasHedgeExecution: !!arbResult.hedgeExecutionResult,
            lastUpdatedAt: arbTimestamp
        });

        booksSet.clear(); // Reset for next arb
    }

    return {
        mode: modeSummary.mode || null,
        recentArbs: recentArbs.slice(-10), // Keep last 10
        stats
    };
}

/**
 * Aggregate risk metrics from risk summary.
 */
function aggregateRiskMetrics(riskSummary) {
    const totalExposureByBook = {};

    // Aggregate exposure by book
    if (riskSummary.exposureEntries && Array.isArray(riskSummary.exposureEntries)) {
        for (const entry of riskSummary.exposureEntries) {
            const book = entry.book || 'unknown';
            const exposure = entry.exposure || 0;
            totalExposureByBook[book] = (totalExposureByBook[book] || 0) + exposure;
        }
    }

    return {
        totalExposureByBook,
        maxPerBookExposure: riskSummary.maxPerBookExposure || null,
        maxDailyLoss: riskSummary.maxDailyLoss || null,
        currentDailyPnL: riskSummary.currentDailyPnL || null
    };
}

/**
 * Aggregate health advisories.
 */
function aggregateHealthAdvisories(recentHealthAdvisories) {
    if (!recentHealthAdvisories || recentHealthAdvisories.length === 0) {
        return {
            lastAdvisoryLevel: null,
            lastAdvisoryAt: null,
            advisoriesLastHour: 0
        };
    }

    // Sort by timestamp descending
    const sorted = [...recentHealthAdvisories].sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
    });

    const mostRecent = sorted[0];
    const lastAdvisoryLevel = mostRecent.level || null;
    const lastAdvisoryAt = mostRecent.timestamp || null;

    // Count advisories in last hour
    const nowMs = Date.now();
    const oneHourAgo = nowMs - (60 * 60 * 1000);
    const advisoriesLastHour = recentHealthAdvisories.filter(advisory => {
        const timestamp = new Date(advisory.timestamp || 0).getTime();
        return timestamp >= oneHourAgo;
    }).length;

    return {
        lastAdvisoryLevel,
        lastAdvisoryAt,
        advisoriesLastHour
    };
}

module.exports = {
    buildOperatorDashboardSnapshot,
    aggregateExecutionStats,
    aggregateRiskMetrics,
    aggregateHealthAdvisories
};
