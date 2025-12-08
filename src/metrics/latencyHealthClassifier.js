/**
 * src/metrics/latencyHealthClassifier.js
 * 
 * Latency health classification layer.
 * Pure logic - no side effects, no I/O.
 */

/**
 * Classify latency summary into health levels.
 * @param {Object} latencySummary - Summary from summarizeLatencyByBook
 * @param {Object} thresholds - Thresholds from getLatencyHealthConfig
 * @returns {Object} Classification result
 */
function classifyLatency(latencySummary, thresholds) {
    // Handle empty or missing input
    if (!latencySummary || !latencySummary.perBook) {
        return {
            level: 'ok',
            reasons: [],
            perBookStates: {},
            global: {
                windowMinutes: 0,
                totalEvents: 0,
                booksConsidered: [],
                slowBookCount: 0,
                slowBookFraction: 0
            }
        };
    }

    const perBook = latencySummary.perBook || [];
    const global = latencySummary.global || {};
    const perBookThresholds = thresholds.perBook || {};
    const globalThresholds = thresholds.global || {};

    const reasons = [];
    const perBookStates = {};
    let slowBookCount = 0;
    let totalBooksWithSufficientSamples = 0;

    // Classify each book
    for (const bookStats of perBook) {
        const book = bookStats.book;
        const sampleCount = bookStats.sampleCount || 0;
        const avgLagMs = bookStats.avgLagMs || 0;
        const p95LagMs = bookStats.p95LagMs || 0;
        const maxLagMs = bookStats.maxLagMs || 0;

        let bookLevel = 'ok';

        // Only classify if sufficient samples
        if (sampleCount >= perBookThresholds.minSamples) {
            totalBooksWithSufficientSamples++;

            // Check severity thresholds (precedence: severe > degraded > ok)
            const isSevere = avgLagMs >= perBookThresholds.severeAvgLagMs ||
                p95LagMs >= perBookThresholds.severeP95LagMs;
            const isDegraded = avgLagMs >= perBookThresholds.degradedAvgLagMs ||
                p95LagMs >= perBookThresholds.degradedP95LagMs;

            if (isSevere) {
                bookLevel = 'severe';
                slowBookCount++;

                // Add reason for severe book
                if (avgLagMs >= perBookThresholds.severeAvgLagMs) {
                    reasons.push(`Book ${book} severe: avgLag=${avgLagMs}ms (>=${perBookThresholds.severeAvgLagMs}ms)`);
                }
                if (p95LagMs >= perBookThresholds.severeP95LagMs) {
                    reasons.push(`Book ${book} severe: p95Lag=${p95LagMs}ms (>=${perBookThresholds.severeP95LagMs}ms)`);
                }
            } else if (isDegraded) {
                bookLevel = 'degraded';
                slowBookCount++;

                // Add reason for degraded book
                if (avgLagMs >= perBookThresholds.degradedAvgLagMs) {
                    reasons.push(`Book ${book} degraded: avgLag=${avgLagMs}ms (>=${perBookThresholds.degradedAvgLagMs}ms)`);
                }
                if (p95LagMs >= perBookThresholds.degradedP95LagMs) {
                    reasons.push(`Book ${book} degraded: p95Lag=${p95LagMs}ms (>=${perBookThresholds.degradedP95LagMs}ms)`);
                }
            }
        }

        // Store per-book state
        perBookStates[book] = {
            level: bookLevel,
            sampleCount,
            avgLagMs,
            p95LagMs,
            maxLagMs
        };
    }

    // Compute global classification
    const slowBookFraction = totalBooksWithSufficientSamples === 0
        ? 0
        : slowBookCount / totalBooksWithSufficientSamples;

    let globalLevel = 'ok';

    if (slowBookFraction >= globalThresholds.severeFractionSlowBooks) {
        globalLevel = 'severe';
        const pct = Math.round(slowBookFraction * 100);
        reasons.push(`${pct}% of books are degraded or severe (>=${Math.round(globalThresholds.severeFractionSlowBooks * 100)}% severe threshold)`);
    } else if (slowBookFraction >= globalThresholds.degradedFractionSlowBooks) {
        globalLevel = 'degraded';
        const pct = Math.round(slowBookFraction * 100);
        reasons.push(`${pct}% of books are degraded or severe (>=${Math.round(globalThresholds.degradedFractionSlowBooks * 100)}% degraded threshold)`);
    }

    return {
        level: globalLevel,
        reasons,
        perBookStates,
        global: {
            windowMinutes: global.windowMinutes || 0,
            totalEvents: global.totalEvents || 0,
            booksConsidered: global.booksConsidered || [],
            slowBookCount,
            slowBookFraction: Math.round(slowBookFraction * 1000) / 1000  // Round to 3 decimals
        }
    };
}

module.exports = {
    classifyLatency
};
