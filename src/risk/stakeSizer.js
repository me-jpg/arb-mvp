/**
 * src/risk/stakeSizer.js
 * 
 * Configurable stake sizing module for risk-aware position sizing.
 * Supports: flat, edge-linear, and Kelly fraction modes.
 */

/**
 * Size stake for a signal based on configured mode and risk parameters.
 * @param {Object} signal - Signal object with edgeEstimate, mlScore, etc.
 * @param {Object} context - Context with bankroll, risk state, config
 * @returns {Object} {stake, modeUsed, reasons}
 */
function sizeStakeForSignal(signal, context = {}) {
    const {
        bankrollConfig = {},
        exposureSnapshot = {},
        currentDayLoss = 0,
        stakeSizingConfig = {}
    } = context;

    const mode = stakeSizingConfig.mode || 'flat';
    const flatStake = stakeSizingConfig.flatStake || 50;
    const maxStakePctBankroll = stakeSizingConfig.maxStakePctBankroll || 0.02; // 2%
    const kellyBaseFraction = stakeSizingConfig.kellyBaseFraction || 0.5;
    const minStake = stakeSizingConfig.minStake || 5;

    const bankroll = bankrollConfig.currentBankroll || bankrollConfig.startingBankroll || 10000;
    const edge = signal.edgeEstimate || 0;
    const mlScore = signal.mlScore;

    const reasons = [];
    let rawStake = flatStake;

    try {
        switch (mode) {
            case 'flat':
                rawStake = flatStake;
                reasons.push('Using flat stake');
                break;

            case 'edge_linear':
                // Linear scaling based on edge
                rawStake = flatStake * (1 + edge);
                // Clamp to reasonable bounds
                rawStake = Math.max(0, Math.min(rawStake, flatStake * 3));
                reasons.push(`Edge-linear: ${edge.toFixed(3)}`);
                break;

            case 'kelly_fraction':
                // Simplified Kelly: f* ≈ edge / (expected_odds_magnitude)
                // For typical arbs/edges, assume odds around 2.0 (even money)
                // So full Kelly ≈ edge / 1.0 = edge (as fraction of bankroll)
                // But we use kellyBaseFraction to be conservative
                let kellyFraction = Math.max(0, edge) * kellyBaseFraction;

                // Optional: scale by mlScore if available
                if (typeof mlScore === 'number' && mlScore !== 0) {
                    // Normalize mlScore influence: assume typical scores are -2 to 5
                    // Scale by ±20% based on mlScore deviation from edge
                    const mlInfluence = Math.min(0.2, Math.max(-0.2, (mlScore - edge) / 10));
                    kellyFraction *= (1 + mlInfluence);
                    reasons.push(`ML-adjusted Kelly: mlScore=${mlScore.toFixed(2)}`);
                }

                rawStake = kellyFraction * bankroll;
                reasons.push(`Kelly fraction: ${(kellyFraction * 100).toFixed(2)}%`);
                break;

            default:
                rawStake = flatStake;
                reasons.push('Unknown mode, using flat');
        }

        // Apply global constraints
        const maxStake = maxStakePctBankroll * bankroll;

        if (rawStake > maxStake) {
            rawStake = maxStake;
            reasons.push(`Capped at ${(maxStakePctBankroll * 100).toFixed(1)}% of bankroll`);
        }

        if (rawStake < minStake && bankroll >= minStake) {
            rawStake = minStake;
            reasons.push(`Raised to minimum stake: ${minStake}`);
        }

        // Final sanity check
        if (!Number.isFinite(rawStake) || rawStake < 0) {
            rawStake = flatStake;
            reasons.push('Invalid calculation, fallback to flat');
        }

        return {
            stake: Math.round(rawStake * 100) / 100, // Round to 2 decimals
            modeUsed: mode,
            reasons
        };

    } catch (err) {
        // Fallback on any error
        return {
            stake: flatStake,
            modeUsed: 'flat_fallback',
            reasons: [`Error: ${err.message}, using fallback`]
        };
    }
}

module.exports = {
    sizeStakeForSignal
};
