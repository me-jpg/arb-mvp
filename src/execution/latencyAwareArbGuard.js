/**
 * src/execution/latencyAwareArbGuard.js
 * 
 * Latency-aware arb guard: evaluates leg staleness and skew.
 * Pure logic - nowMs injected for testability.
 */

/**
 * Evaluate arb latency based on leg timestamps.
 * 
 * @param {Object} arbPlan - Arb plan with legs
 * @param {Object} latencyConfig - Latency guard config
 * @param {number} nowMs - Current time in ms (injected)
 * @returns {Object} Decision object {shouldSkip, reasons, metrics}
 */
function evaluateArbLatency(arbPlan, latencyConfig, nowMs) {
    // Disabled guard: no-op
    if (!latencyConfig || !latencyConfig.enabled) {
        return {
            shouldSkip: false,
            reasons: [],
            metrics: null
        };
    }

    const reasons = [];
    const legAges = [];
    let maxAgeMs = 0;
    let minAgeMs = Infinity;
    let hasValidTimestamp = false;

    // Evaluate each leg
    for (const leg of arbPlan.legs || []) {
        const legId = leg.legId || leg.orderId || 'unknown';
        let ageMs = null;

        // Parse timestamp
        if (leg.lastUpdatedAt) {
            try {
                let timestampMs;

                // Handle ISO string or epoch ms
                if (typeof leg.lastUpdatedAt === 'string') {
                    timestampMs = new Date(leg.lastUpdatedAt).getTime();
                } else if (typeof leg.lastUpdatedAt === 'number') {
                    timestampMs = leg.lastUpdatedAt;
                }

                if (!isNaN(timestampMs) && timestampMs > 0) {
                    ageMs = nowMs - timestampMs;
                    hasValidTimestamp = true;

                    // Track min/max
                    if (ageMs > maxAgeMs) maxAgeMs = ageMs;
                    if (ageMs < minAgeMs) minAgeMs = ageMs;
                } else {
                    // Invalid timestamp
                    reasons.push('missing_timestamp');
                    ageMs = null;
                }
            } catch {
                // Parse error
                reasons.push('missing_timestamp');
                ageMs = null;
            }
        } else {
            // Missing timestamp
            reasons.push('missing_timestamp');
            ageMs = null;
        }

        legAges.push({ legId, ageMs });
    }

    // If no valid timestamps, treat as worst case
    if (!hasValidTimestamp) {
        maxAgeMs = Infinity;
        minAgeMs = 0;
    }

    // Compute skew
    const skewMs = hasValidTimestamp ? maxAgeMs - minAgeMs : 0;

    // Build metrics
    const metrics = {
        maxAgeMs: hasValidTimestamp ? maxAgeMs : null,
        minAgeMs: hasValidTimestamp && minAgeMs !== Infinity ? minAgeMs : null,
        skewMs: hasValidTimestamp ? skewMs : null,
        legAges
    };

    // Check violations
    if (hasValidTimestamp && maxAgeMs > latencyConfig.maxLegAgeMs) {
        reasons.push('max_leg_age_exceeded');
    }

    if (hasValidTimestamp && skewMs > latencyConfig.maxSkewBetweenLegsMs) {
        reasons.push('leg_skew_exceeded');
    }

    // Decision
    let shouldSkip = false;

    if (reasons.length > 0) {
        if (latencyConfig.action === 'skip') {
            shouldSkip = true;
        }
        // else action === 'warn_only': shouldSkip remains false
    }

    return {
        shouldSkip,
        reasons: [...new Set(reasons)],  // Deduplicate
        metrics
    };
}

module.exports = {
    evaluateArbLatency
};
