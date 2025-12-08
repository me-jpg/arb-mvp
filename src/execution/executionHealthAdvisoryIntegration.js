/**
 * src/execution/executionHealthAdvisoryIntegration.js
 * 
 * Advisory integration layer - centralizes health status evaluation
 * with config-driven enforcement modes.
 */

const { deriveExecutionHealthStatus } = require('./executionHealthAdvisor');
const { getExecutionHealthAdvisoryMode } = require('../config');

/**
 * Evaluate execution health for a batch with config-aware context.
 * Pure function - no side effects, no halting.
 * 
 * @param {Object} healthSummary - Health summary from loader
 * @param {Object} riskConfig - Risk/execution config
 * @param {Object} options - Optional advisor overrides
 * @returns {Object} Advisory context
 */
function evaluateExecutionHealthForBatch(healthSummary, riskConfig, options = {}) {
    const { advisorOverrides } = options;

    // Derive advisory status
    const advisory = deriveExecutionHealthStatus(healthSummary, advisorOverrides);

    // Read enforcement mode from config
    const enforcementMode = getExecutionHealthAdvisoryMode(riskConfig);

    // Determine if halt is recommended
    const haltRecommended = advisory.level === 'halt_recommended';

    // Should affect execution ONLY if mode is 'halt' AND halt is recommended
    const shouldAffectExecution = enforcementMode === 'halt' && haltRecommended;

    return {
        advisory,
        enforcementMode,
        haltRecommended,
        shouldAffectExecution
    };
}

module.exports = {
    evaluateExecutionHealthForBatch
};
