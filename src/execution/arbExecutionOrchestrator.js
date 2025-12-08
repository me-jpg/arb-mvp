/**
 * src/execution/arbExecutionOrchestrator.js
 * 
 * Multi-leg arbitrage execution orchestrator.
 * Pure orchestration logic with dependency injection.
 */

const { getArbExecutionConfig, getExecutionHedgingConfig } = require('../../config');
const { computeHedgeForBrokenArb } = require('./arbHedgingStrategy');

/**
 * Orchestrate multi-leg arbitrage execution.
 * 
 * @param {Object} arbPlan - Arbitrage plan
 * @param {string} arbPlan.id - Arb identifier
 * @param {Array<Object>} arbPlan.legs - Leg definitions
 * @param {string} arbPlan.legs[].legId - Leg identifier
 * @param {string} arbPlan.legs[].book - Sportsbook
 * @param {string} arbPlan.legs[].eventId - Event ID
 * @param {string} arbPlan.legs[].marketType - Market type
 * @param {string} arbPlan.legs[].side - Side
 * @param {number} arbPlan.legs[].price - Price/odds
 * @param {number} arbPlan.legs[].stake - Stake amount
 * 
 * @param {Object} context - Execution context
 * @param {Object} context.config - Configuration
 * @param {Array} context.recentExecutions - Recent executions for idempotency
 * @param {Function} context.executeSingleLegFn - Async function to execute single leg
 * 
 * @returns {Promise<Object>} Orchestration result
 */
async function orchestrateArbExecution(arbPlan, context) {
    const arbConfig = getArbExecutionConfig(context.config);

    // Enforce max legs guardrail
    if (arbPlan.legs.length > arbConfig.maxLegsPerArb) {
        return {
            arbId: arbPlan.id,
            strategy: arbConfig.strategy,
            legs: [],
            overallStatus: 'failed',
            notes: [`maxLegsPerArb exceeded: ${arbPlan.legs.length} > ${arbConfig.maxLegsPerArb}`]
        };
    }

    const legResults = [];
    const notes = [];

    // Sequential conservative execution
    for (let i = 0; i < arbPlan.legs.length; i++) {
        const leg = arbPlan.legs[i];

        // Execute single leg
        const normalized = await context.executeSingleLegFn(leg, context);

        // Record leg result
        const legResult = {
            legId: leg.legId,
            book: leg.book,
            requestedStake: normalized.requestedStake,
            filledStake: normalized.filledStake,
            remainingStake: normalized.remainingStake,
            status: normalized.status,
            errorCode: normalized.errorCode || null,
            errorMessage: normalized.errorMessage || null
        };

        legResults.push(legResult);

        // Conservative stop on rejection or error
        if (normalized.status === 'rejected' || normalized.status === 'error') {
            notes.push(`Leg ${i + 1} (${leg.legId}) ${normalized.status}, stopped execution`);
            break;
        }
    }

    // Determine overall status
    let overallStatus;

    const allFilled = legResults.length === arbPlan.legs.length &&
        legResults.every(leg => leg.status === 'filled');

    const hasAnyFillOrPartial = legResults.some(leg =>
        leg.status === 'filled' || leg.status === 'partial_filled'
    );

    if (allFilled) {
        overallStatus = 'completed';
    } else if (hasAnyFillOrPartial) {
        overallStatus = 'partial';
    } else {
        overallStatus = 'failed';
    }

    // Compute hedging plan if enabled and arb is broken
    const hedgingConfig = getExecutionHedgingConfig(context.config);
    let hedgingPlan = null;

    if (hedgingConfig.enabled && overallStatus === 'partial') {
        const hasFailure = legResults.some(leg =>
            leg.status === 'rejected' || leg.status === 'error'
        );

        if (hasFailure) {
            hedgingPlan = computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig);
        }
    }

    const result = {
        arbId: arbPlan.id,
        strategy: arbConfig.strategy,
        legs: legResults,
        overallStatus,
        notes
    };

    // Attach hedging plan if computed
    if (hedgingPlan) {
        result.hedgingPlan = hedgingPlan;
    }

    return result;
}

module.exports = {
    orchestrateArbExecution
};
