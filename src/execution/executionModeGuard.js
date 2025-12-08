/**
 * src/execution/executionModeGuard.js
 * 
 * Execution mode resolution and live safety validation.
 * Pure logic, no side effects.
 */

const { getExecutionModeConfig } = require('../../config');

/**
 * Resolve execution mode from config.
 * @param {Object} config - Full config object
 * @returns {string} 'simulation' | 'paper' | 'live'
 */
function resolveExecutionMode(config) {
    const modeConfig = getExecutionModeConfig(config);
    const mode = modeConfig.mode;

    // Valid modes
    const validModes = ['simulation', 'paper', 'live'];

    // Unknown modes default to simulation for safety
    if (!validModes.includes(mode)) {
        return 'simulation';
    }

    return mode;
}

/**
 * Validate safety requirements for live execution.
 * @param {Object} config - Full config
 * @param {Object} healthConfig - Health advisory config
 * @param {Object} riskConfig - Risk config
 * @param {Object} idempotencyConfig - Idempotency config
 * @returns {Object} {ok: boolean, reasons: string[]}
 */
function validateLiveSafety(config, healthConfig, riskConfig, idempotencyConfig) {
    const mode = resolveExecutionMode(config);
    const modeConfig = getExecutionModeConfig(config);

    // Non-live modes always pass
    if (mode !== 'live') {
        return { ok: true, reasons: [] };
    }

    const reasons = [];

    // Check idempotency requirement
    if (modeConfig.safety.requireIdempotencyEnabled) {
        if (!idempotencyConfig || !idempotencyConfig.enabled) {
            reasons.push('Idempotency is required for live mode but is disabled');
        }
    }

    // Check risk caps requirement
    if (modeConfig.safety.requireRiskCapsEnabled) {
        const hasMaxPerBookExposure = riskConfig &&
            typeof riskConfig.maxPerBookExposure === 'number';
        const hasMaxDailyLoss = riskConfig &&
            typeof riskConfig.maxDailyLoss === 'number';

        if (!hasMaxPerBookExposure || !hasMaxDailyLoss) {
            reasons.push('Risk caps (maxPerBookExposure, maxDailyLoss) are required for live mode but are missing');
        }
    }

    // Check health advisory requirement
    if (modeConfig.safety.requireHealthAdvisoryIgnoreOrLog) {
        // Health advisory enforcementMode 'halt' is acceptable (it protects)
        // 'ignore' or 'log' also acceptable
        // If enforcementMode is something unexpected, flag it
        if (healthConfig && healthConfig.enforcementMode === 'halt') {
            // This is fine - halt protects from bad execution
        } else if (!healthConfig ||
            (healthConfig.enforcementMode !== 'ignore' &&
                healthConfig.enforcementMode !== 'log' &&
                healthConfig.enforcementMode !== 'halt')) {
            // Unknown or missing mode
            reasons.push('Health advisory enforcementMode must be set to ignore, log, or halt for live mode');
        }
    }

    return {
        ok: reasons.length === 0,
        reasons
    };
}

module.exports = {
    resolveExecutionMode,
    validateLiveSafety
};
