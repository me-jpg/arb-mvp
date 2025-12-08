/**
 * src/execution/executionHealthMonitor.js
 * 
 * Execution health monitoring - pure computation functions.
 * Hardened for production use.
 */

/**
 * Compute fill rates from execution events.
 * @param {Array} executions - Execution event objects
 * @returns {Object} Fill rate statistics with unknown bucket
 */
function computeFillRates(executions) {
    if (!Array.isArray(executions) || executions.length === 0) {
        return {
            global: {
                fills: 0,
                rejects: 0,
                partials: 0,
                unknown: 0,
                total: 0,
                fillRate: 0,
                rejectRate: 0,
                partialRate: 0
            },
            perBook: []
        };
    }

    const byBook = {};
    let globalFills = 0, globalRejects = 0, globalPartials = 0, globalUnknown = 0;

    for (const exec of executions) {
        const book = exec.book || exec.primaryBook || 'unknown';
        const status = exec.status || exec.executionStatus || 'unknown';

        if (!byBook[book]) {
            byBook[book] = { fills: 0, rejects: 0, partials: 0, unknown: 0, total: 0 };
        }

        byBook[book].total++;

        // Explicit status categorization with unknown bucket
        if (status === 'filled' || status === 'fill') {
            byBook[book].fills++;
            globalFills++;
        } else if (status === 'rejected' || status === 'reject') {
            byBook[book].rejects++;
            globalRejects++;
        } else if (status === 'partial' || status === 'partially_filled') {
            byBook[book].partials++;
            globalPartials++;
        } else {
            // Catch-all for pending, cancelled, expired, etc.
            byBook[book].unknown++;
            globalUnknown++;
        }
    }

    const globalTotal = executions.length;
    const global = {
        fills: globalFills,
        rejects: globalRejects,
        partials: globalPartials,
        unknown: globalUnknown,
        total: globalTotal,
        fillRate: globalTotal > 0 ? globalFills / globalTotal : 0,
        rejectRate: globalTotal > 0 ? globalRejects / globalTotal : 0,
        partialRate: globalTotal > 0 ? globalPartials / globalTotal : 0
    };

    // Sort only at final return (not in nested calls)
    const perBook = Object.entries(byBook).map(([book, stats]) => ({
        book,
        fills: stats.fills,
        rejects: stats.rejects,
        partials: stats.partials,
        unknown: stats.unknown,
        total: stats.total,
        fillRate: stats.total > 0 ? stats.fills / stats.total : 0,
        rejectRate: stats.total > 0 ? stats.rejects / stats.total : 0,
        partialRate: stats.total > 0 ? stats.partials / stats.total : 0
    })).sort((a, b) => b.total - a.total);

    return { global, perBook };
}

/**
 * Classify failure reasons from executions.
 * Fixed boolean precedence and ordered matching.
 * @param {Array} executions - Execution events
 * @returns {Array} Failure mode counts
 */
function classifyFailures(executions) {
    if (!Array.isArray(executions)) return [];

    const failureCounts = {
        throttled: 0,
        risk_limit: 0,
        line_changed: 0,
        price_moved: 0,
        unknown: 0
    };

    for (const exec of executions) {
        const status = exec.status || exec.executionStatus || '';
        if (status !== 'rejected' && status !== 'reject') continue;

        const reason = (exec.rejectReason || exec.reason || '').toLowerCase();

        // Order-specific matching (top-down, first match wins)
        // 1. Throttling (most specific)
        if (reason.includes('throttle') || reason.includes('rate limit')) {
            failureCounts.throttled++;
        }
        // 2. Risk/exposure limits
        else if (reason.includes('risk') || reason.includes('exposure')) {
            failureCounts.risk_limit++;
        }
        // 3. Generic "limit" that isn't line-specific → risk
        else if (reason.includes('limit') && !reason.includes('line')) {
            failureCounts.risk_limit++;
        }
        // 4. Line-specific changes
        else if (reason.includes('line')) {
            failureCounts.line_changed++;
        }
        // 5. Price/odds moved
        else if (reason.includes('price') || reason.includes('odds')) {
            failureCounts.price_moved++;
        }
        // 6. Everything else
        else {
            failureCounts.unknown++;
        }
    }

    const total = Object.values(failureCounts).reduce((sum, count) => sum + count, 0);

    return Object.entries(failureCounts)
        .map(([type, count]) => ({
            type,
            count,
            pct: total > 0 ? count / total : 0
        }))
        .filter(f => f.count > 0)
        .sort((a, b) => b.count - a.count);
}

/**
 * Detect systemic failure patterns.
 * Fixed timestamp handling: missing/invalid → exclude from window.
 * @param {Array} executions - Execution events
 * @param {Object} options - Detection options
 * @returns {Array} Alert objects
 */
function detectSystemicFailPatterns(executions, options = {}) {
    const {
        rejectThresholdPct = 0.3,  // 30% reject rate triggers alert
        windowMinutes = 30,
        spikeThresholdPct = 0.5    // 50% of rejects in one category
    } = options;

    if (!Array.isArray(executions) || executions.length === 0) return [];

    const alerts = [];
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // Filter to window with consistent timestamp handling
    const recentExecs = executions.filter(exec => {
        const ts = exec.timestamp || exec.ts || exec.createdAt;

        // Missing timestamp → EXCLUDE (changed from include)
        if (!ts) return false;

        const execTime = new Date(ts).getTime();

        // Invalid timestamp → EXCLUDE
        if (isNaN(execTime)) return false;

        // Only include if within window
        return (now - execTime) <= windowMs;
    });

    if (recentExecs.length === 0) return [];

    // Single-pass metrics computation
    const { perBook } = computeFillRates(recentExecs);
    const failures = classifyFailures(recentExecs);

    // Check per-book reject rates
    for (const bookStats of perBook) {
        if (bookStats.rejectRate > rejectThresholdPct && bookStats.total >= 10) {
            alerts.push({
                book: bookStats.book,
                severity: bookStats.rejectRate > 0.5 ? 'high' : 'medium',
                message: `High reject rate: ${(bookStats.rejectRate * 100).toFixed(1)}% (${bookStats.rejects}/${bookStats.total})`,
                type: 'high_reject_rate',
                metric: bookStats.rejectRate
            });
        }
    }

    // Check for failure mode spikes
    const totalFailures = failures.reduce((sum, f) => sum + f.count, 0);

    for (const failure of failures) {
        if (failure.pct > spikeThresholdPct && totalFailures >= 10) {
            alerts.push({
                book: 'global',
                severity: 'medium',
                message: `Spike in ${failure.type}: ${(failure.pct * 100).toFixed(1)}% of rejections`,
                type: 'failure_spike',
                failureMode: failure.type,
                metric: failure.pct
            });
        }
    }

    // Sort only once at return
    return alerts.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });
}

module.exports = {
    computeFillRates,
    classifyFailures,
    detectSystemicFailPatterns
};
