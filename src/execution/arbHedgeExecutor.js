/**
 * src/execution/arbHedgeExecutor.js
 * 
 * Execute computed hedging plans through existing single-leg engine.
 * Pure orchestration - reuses all existing execution logic.
 */

/**
 * Execute hedging plan by running each hedge as a single-leg order.
 * 
 * @param {Object} hedgingPlan - Output from computeHedgeForBrokenArb
 * @param {Object} engineContext - Engine context with executeSingleLegFn
 * @returns {Promise<Object>} Hedge execution results
 */
async function executeHedgingPlan(hedgingPlan, engineContext) {
    // No hedges to execute
    if (!hedgingPlan || !hedgingPlan.hedges || hedgingPlan.hedges.length === 0) {
        return {
            status: 'no_hedges',
            hedgeResults: [],
            notes: ['no hedges to execute']
        };
    }

    const hedgeResults = [];
    const notes = [];

    // Execute each hedge as a single-leg order
    for (const hedge of hedgingPlan.hedges) {
        try {
            // Construct leg-like order from hedge
            const hedgeLeg = {
                legId: hedge.hedgeId,
                orderId: hedge.hedgeId,
                book: hedge.book,
                eventId: hedge.eventId,
                marketType: hedge.marketType,
                side: hedge.side,
                price: hedge.price,
                stake: hedge.stake,
                // Metadata
                isHedge: true,
                sourceLegId: hedge.sourceLegId
            };

            // Execute through existing single-leg engine
            // This reuses: risk, idempotency, retry, partial fills, normalization
            const result = await engineContext.executeSingleLegFn(hedgeLeg);

            // Collect result
            hedgeResults.push({
                hedgeId: hedge.hedgeId,
                sourceLegId: hedge.sourceLegId,
                status: result.status || 'unknown',
                filledStake: result.filledStake || 0,
                remainingStake: result.remainingStake || hedge.stake,
                errorCode: result.errorCode || null,
                errorMessage: result.errorMessage || null
            });
        } catch (error) {
            // Capture execution errors
            hedgeResults.push({
                hedgeId: hedge.hedgeId,
                sourceLegId: hedge.sourceLegId,
                status: 'error',
                filledStake: 0,
                remainingStake: hedge.stake,
                errorCode: 'EXECUTION_ERROR',
                errorMessage: error.message || 'Unknown error'
            });
            notes.push(`Hedge ${hedge.hedgeId} failed: ${error.message}`);
        }
    }

    notes.push(`Executed ${hedgeResults.length} hedge(s)`);

    return {
        status: 'hedges_executed',
        hedgeResults,
        notes
    };
}

module.exports = {
    executeHedgingPlan
};
