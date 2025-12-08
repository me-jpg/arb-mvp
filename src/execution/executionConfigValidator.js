/**
 * src/execution/executionConfigValidator.js
 * 
 * Safety validator for execution configurations.
 * Pure validation logic - no I/O.
 */

const {
    getExecutionModeConfig,
    getExecutionIdempotencyConfig,
    getExecutionRiskConfig,
    getExecutionHealthAdvisoryMode,
    getExecutionHedgingConfig,
    getExecutionLatencyGuardConfig
} = require('../config');

/**
 * Validate execution configuration for safety.
 * 
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result {ok, errors, warnings, profileName, mode}
 */
function validateExecutionConfig(config) {
    const errors = [];
    const warnings = [];

    // Extract profile name if set
    const profileName = (config && config.execution && config.execution.profileName) || null;

    // Determine execution mode
    const modeConfig = getExecutionModeConfig(config);
    const mode = modeConfig.mode || 'simulation';

    // Get all relevant config sections
    const idempotencyConfig = getExecutionIdempotencyConfig(config);
    const riskConfig = getExecutionRiskConfig(config);
    const healthMode = getExecutionHealthAdvisoryMode(config);
    const hedgingConfig = getExecutionHedgingConfig(config);
    const latencyConfig = getExecutionLatencyGuardConfig(config);

    // ===================================================================
    // Generic checks (any mode)
    // ===================================================================

    // Warn if idempotency disabled
    if (!idempotencyConfig.enabled) {
        warnings.push('Idempotency is disabled - duplicate orders may occur');
    }

    // Error if risk caps are invalid
    if (riskConfig.maxPerBookExposure !== null) {
        if (typeof riskConfig.maxPerBookExposure !== 'number' || riskConfig.maxPerBookExposure < 0 || isNaN(riskConfig.maxPerBookExposure)) {
            errors.push('maxPerBookExposure is invalid (must be positive number or null)');
        }
    }

    if (riskConfig.maxDailyLoss !== null) {
        if (typeof riskConfig.maxDailyLoss !== 'number' || isNaN(riskConfig.maxDailyLoss)) {
            errors.push('maxDailyLoss is invalid (must be number or null)');
        }
    }

    // ===================================================================
    // Live-mode specific checks
    // ===================================================================

    if (mode === 'live') {
        const safety = modeConfig.safety || {};

        // Error if idempotency required but disabled
        if (safety.requireIdempotencyEnabled && !idempotencyConfig.enabled) {
            errors.push('Live mode requires idempotency enabled (safety.requireIdempotencyEnabled=true)');
        }

        // Error if risk caps required but missing
        if (safety.requireRiskCapsEnabled) {
            if (riskConfig.maxPerBookExposure === null && riskConfig.maxDailyLoss === null) {
                errors.push('Live mode requires risk caps enabled (safety.requireRiskCapsEnabled=true)');
            }
        }

        // Warn if latency guard disabled in live mode
        if (!latencyConfig.enabled) {
            warnings.push('Latency guard is disabled in live mode - stale data may be executed');
        }

        // Warn if hedge execution disabled in live mode
        if (!hedgingConfig.executeHedges) {
            warnings.push('Hedge execution is disabled in live mode - broken arbs will not be hedged');
        }
    }

    // ===================================================================
    // Profile-specific checks
    // ===================================================================

    if (profileName === 'live_guarded') {
        // live_guarded profile must have mode='live'
        if (mode !== 'live') {
            errors.push(`Profile 'live_guarded' requires mode='live' (current: '${mode}')`);
        }

        // live_guarded requires latency guard enabled
        if (!latencyConfig.enabled) {
            errors.push(`Profile 'live_guarded' requires latencyGuard.enabled=true`);
        }

        // live_guarded requires hedge execution enabled
        if (!hedgingConfig.executeHedges) {
            errors.push(`Profile 'live_guarded' requires hedging.executeHedges=true`);
        }

        // live_guarded requires idempotency enabled
        if (!idempotencyConfig.enabled) {
            errors.push(`Profile 'live_guarded' requires idempotency.enabled=true`);
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        profileName,
        mode
    };
}

module.exports = {
    validateExecutionConfig
};
