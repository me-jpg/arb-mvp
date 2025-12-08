/**
 * src/execution/executionResultNormalizer.js
 * 
 * Normalize execution results into consistent internal model.
 * Pure functions, deterministic, no side effects.
 */

/**
 * Normalize execution result into consistent internal model.
 * 
 * @param {Object} rawResult - Raw result from provider/simulator
 * @param {Object} orderContext - Original planned order
 * @returns {Object} Normalized execution result
 */
function normalizeExecutionResult(rawResult, orderContext) {
    // Determine requested stake
    const requestedStake = orderContext.stake || rawResult.requestedStake || 0;

    // Determine filled stake
    let filledStake = 0;
    if (rawResult.filledStake !== undefined && rawResult.filledStake !== null) {
        filledStake = rawResult.filledStake;
    } else if (rawResult.success === true) {
        filledStake = requestedStake;
    } else if (rawResult.success === false) {
        filledStake = 0;
    }

    // Compute remaining stake
    const remainingStake = Math.max(0, requestedStake - filledStake);

    // Determine status
    let status;
    if (filledStake === requestedStake && filledStake > 0) {
        status = 'filled';
    } else if (filledStake > 0 && filledStake < requestedStake) {
        status = 'partial_filled';
    } else if (rawResult.success === false) {
        // Distinguish between rejected and error
        const errorCode = rawResult.errorCode || rawResult.error;
        if (errorCode && isKnownRejection(errorCode)) {
            status = 'rejected';
        } else {
            status = 'error';
        }
    } else {
        // Fallback for ambiguous cases
        status = 'error';
    }

    // Extract error info
    const errorCode = rawResult.errorCode || rawResult.error || null;
    const errorMessage = rawResult.errorMessage || rawResult.message || null;

    return {
        book: orderContext.book || rawResult.book,
        eventId: orderContext.eventId || rawResult.eventId,
        marketType: orderContext.marketType || rawResult.marketType,
        side: orderContext.side || rawResult.side,
        price: orderContext.price || rawResult.price,
        requestedStake,
        filledStake,
        remainingStake,
        status,
        errorCode,
        errorMessage,
        raw: rawResult  // Preserve original for debugging
    };
}

/**
 * Check if error code represents a known book-side rejection.
 * @param {string} errorCode - Error code to check
 * @returns {boolean} True if known rejection
 */
function isKnownRejection(errorCode) {
    const knownRejections = [
        'LIMIT_REJECTED',
        'INSUFFICIENT_BALANCE',
        'ODDS_CHANGED',
        'MARKET_CLOSED',
        'BET_LIMIT_EXCEEDED',
        'ACCOUNT_RESTRICTED'
    ];
    return knownRejections.includes(errorCode);
}

/**
 * Merge partial fill into existing aggregate.
 * 
 * @param {Object} existingAgg - Existing normalized aggregate
 * @param {Object} newFill - New normalized result to merge
 * @returns {Object} Updated aggregate
 */
function mergePartialFill(existingAgg, newFill) {
    // Validate inputs share same order identity
    if (existingAgg.book !== newFill.book ||
        existingAgg.eventId !== newFill.eventId ||
        existingAgg.marketType !== newFill.marketType ||
        existingAgg.side !== newFill.side) {
        throw new Error('Cannot merge fills from different orders');
    }

    // Aggregate filled stake
    const totalFilledStake = existingAgg.filledStake + newFill.filledStake;

    // Use existing requestedStake (should be same)
    const requestedStake = existingAgg.requestedStake;

    // Compute new remaining
    const remainingStake = Math.max(0, requestedStake - totalFilledStake);

    // Determine new status
    let status;
    if (totalFilledStake === requestedStake && totalFilledStake > 0) {
        status = 'filled';
    } else if (totalFilledStake > 0 && totalFilledStake < requestedStake) {
        status = 'partial_filled';
    } else if (totalFilledStake === 0) {
        // No fill yet, preserve error/rejection status from newFill
        status = newFill.status;
    } else {
        status = 'partial_filled';
    }

    // Preserve last non-null error
    const errorCode = newFill.errorCode || existingAgg.errorCode;
    const errorMessage = newFill.errorMessage || existingAgg.errorMessage;

    return {
        book: existingAgg.book,
        eventId: existingAgg.eventId,
        marketType: existingAgg.marketType,
        side: existingAgg.side,
        price: existingAgg.price,
        requestedStake,
        filledStake: totalFilledStake,
        remainingStake,
        status,
        errorCode,
        errorMessage,
        raw: {
            previous: existingAgg.raw,
            latest: newFill.raw
        }
    };
}

module.exports = {
    normalizeExecutionResult,
    mergePartialFill
};
