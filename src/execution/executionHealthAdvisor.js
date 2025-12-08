/**
 * src/execution/executionHealthAdvisor.js
 * 
 * Read-only execution health advisory layer.
 * Produces recommendations without altering execution behavior.
 */

const DEFAULT_THRESHOLDS = {
    minSamplesPerBook: 20,
    globalFillRate: { degraded: 0.8, critical: 0.6 },
    rejectRate: { warning: 0.3, halt: 0.5 },
    unknownStatusRatio: { warning: 0.10 },
    invalidTimestampRatio: { warning: 0.05 }
};

/**
 * Derive execution health status from health summary.
 * @param {Object} healthSummary - Output from executionHealthLoader
 * @param {Object} options - Override thresholds
 * @returns {Object} Advisory status
 */
function deriveExecutionHealthStatus(healthSummary, options = {}) {
    if (!healthSummary || !healthSummary.global) {
        return {
            level: 'ok',
            reasons: ['No health data available'],
            metrics: {
                globalFillRate: null,
                globalRejectRate: null,
                worstBook: null,
                worstBookRejectRate: null,
                unknownStatusRatio: null,
                invalidTsRatio: null
            }
        };
    }

    const thresholds = { ...DEFAULT_THRESHOLDS, ...options };
    const { global, perBook, systemicAlerts } = healthSummary;

    const reasons = [];
    let level = 'ok';

    // Extract metrics
    const globalFillRate = global.fillRate;
    const globalRejectRate = global.rejectRate;
    const unknownStatusRatio = global.total > 0 ? (global.unknown || 0) / global.total : 0;
    const invalidTsRatio = 0; // Not currently tracked by healthSummary

    // Find worst book
    let worstBook = null;
    let worstBookRejectRate = 0;

    if (perBook && Array.isArray(perBook)) {
        for (const book of perBook) {
            if (book.total >= thresholds.minSamplesPerBook && book.rejectRate > worstBookRejectRate) {
                worstBook = book.book;
                worstBookRejectRate = book.rejectRate;
            }
        }
    }

    // Check for HALT conditions
    const hasHaltLevelRejectRate = worstBookRejectRate >= thresholds.rejectRate.halt;
    const hasSevereAlert = systemicAlerts && systemicAlerts.some(a => a.severity === 'severe' || a.severity === 'high');

    if (hasHaltLevelRejectRate || hasSevereAlert) {
        level = 'halt_recommended';

        if (hasHaltLevelRejectRate) {
            reasons.push(`${worstBook} reject rate ${(worstBookRejectRate * 100).toFixed(1)}% (halt threshold ${(thresholds.rejectRate.halt * 100).toFixed(0)}%)`);
        }

        if (hasSevereAlert) {
            reasons.push('Severe systemic alert detected');
        }
    }
    // Check for DEGRADED conditions
    else {
        if (globalFillRate < thresholds.globalFillRate.degraded) {
            level = 'degraded';
            reasons.push(`Global fill rate ${(globalFillRate * 100).toFixed(1)}% (< ${(thresholds.globalFillRate.degraded * 100).toFixed(0)}% degraded threshold)`);
        }

        if (worstBookRejectRate >= thresholds.rejectRate.warning) {
            level = 'degraded';
            reasons.push(`${worstBook} reject rate ${(worstBookRejectRate * 100).toFixed(1)}% (warning threshold ${(thresholds.rejectRate.warning * 100).toFixed(0)}%)`);
        }

        if (unknownStatusRatio >= thresholds.unknownStatusRatio.warning) {
            level = 'degraded';
            reasons.push(`Unknown statuses ${(unknownStatusRatio * 100).toFixed(1)}% (>= ${(thresholds.unknownStatusRatio.warning * 100).toFixed(0)}% warning)`);
        }

        if (invalidTsRatio >= thresholds.invalidTimestampRatio.warning) {
            level = 'degraded';
            reasons.push(`Invalid timestamps ${(invalidTsRatio * 100).toFixed(1)}% (>= ${(thresholds.invalidTimestampRatio.warning * 100).toFixed(0)}% warning)`);
        }
    }

    if (level === 'ok') {
        reasons.push('All metrics within acceptable ranges');
    }

    return {
        level,
        reasons,
        metrics: {
            globalFillRate,
            globalRejectRate,
            worstBook,
            worstBookRejectRate,
            unknownStatusRatio,
            invalidTsRatio
        }
    };
}

/**
 * Determine if execution should be halted.
 * @param {Object} healthSummary - Health summary
 * @param {Object} riskConfig - Risk configuration
 * @param {Object} options - Options
 * @returns {boolean} True if halt recommended
 */
function shouldHaltExecution(healthSummary, riskConfig, options = {}) {
    const status = deriveExecutionHealthStatus(healthSummary, options);
    return status.level === 'halt_recommended';
}

module.exports = {
    deriveExecutionHealthStatus,
    shouldHaltExecution,
    DEFAULT_THRESHOLDS
};
