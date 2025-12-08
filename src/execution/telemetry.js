// src/execution/telemetry.js
// Telemetry helpers for execution engine

const packageJson = require('../../package.json');

/**
 * Categorize slippage into quality buckets
 * @param {number} slippage - Slippage amount (positive = worse price)
 * @returns {string} 'good'|'neutral'|'bad'
 */
function computeFillQuality(slippage) {
    if (slippage < 0) return 'good';     // Better than expected
    if (slippage === 0) return 'neutral'; // Exact match
    return 'bad';                        // Worse than expected
}

/**
 * Summarize risk decision reasons into a string
 * @param {Object} riskDecision - Risk decision object
 * @returns {string} Comma-separated list of reasons
 */
function summarizeRiskDecision(riskDecision) {
    if (!riskDecision || !riskDecision.reasons || !riskDecision.reasons.length) {
        return '';
    }
    return riskDecision.reasons.join(',');
}

/**
 * Get current engine version from package.json
 * @returns {string}
 */
function getEngineVersion() {
    return packageJson.version || '0.0.0';
}

/**
 * Generate a simulation run ID
 * @returns {string} UUID-like string
 */
function getSimRunId() {
    return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

module.exports = {
    computeFillQuality,
    summarizeRiskDecision,
    getEngineVersion,
    getSimRunId
};
