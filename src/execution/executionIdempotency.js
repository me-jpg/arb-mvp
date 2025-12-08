/**
 * src/execution/executionIdempotency.js
 * 
 * Execution order idempotency & deduplication logic.
 * Pure functions, deterministic, no side effects.
 */

/**
 * Build stable idempotency key for an order.
 * 
 * @param {Object} orderContext - Order to identify
 * @param {string} orderContext.eventId - Event identifier
 * @param {string} orderContext.book - Sportsbook name
 * @param {string} orderContext.marketType - Market type (moneyline/spread/total)
 * @param {string} orderContext.side - Side (home/away/over/under)
 * @param {number} orderContext.price - Odds/price
 * @param {number} orderContext.stake - Stake amount
 * @returns {string} Idempotency key
 */
function buildIdempotencyKey(orderContext) {
    const {
        eventId,
        book,
        marketType,
        side,
        price,
        stake
    } = orderContext;

    // Normalize all fields to strings and concatenate with delimiter
    const parts = [
        String(eventId || ''),
        String(book || ''),
        String(marketType || ''),
        String(side || ''),
        String(price || ''),
        String(stake || '')
    ];

    return parts.join('|');
}

/**
 * Determine if order should be blocked as duplicate.
 * 
 * @param {Object} orderContext - Proposed order
 * @param {Array<Object>} recentExecutions - Recent execution history
 * @param {Object} config - Idempotency configuration
 * @param {boolean} config.enabled - Whether idempotency is enabled
 * @param {number} [config.lookbackWindowMs] - Time window for duplicate detection
 * @returns {boolean} True if should block (duplicate found)
 */
function shouldBlockDuplicate(orderContext, recentExecutions, config) {
    // If idempotency disabled, never block
    if (!config || !config.enabled) {
        return false;
    }

    // No recent executions, cannot be duplicate
    if (!recentExecutions || recentExecutions.length === 0) {
        return false;
    }

    // Build key for proposed order
    const proposedKey = buildIdempotencyKey(orderContext);

    // Determine cutoff time if lookback window specified
    let cutoffTime = null;
    if (config.lookbackWindowMs && config.lookbackWindowMs > 0) {
        cutoffTime = Date.now() - config.lookbackWindowMs;
    }

    // Scan recent executions for matching order
    for (const execution of recentExecutions) {
        // Check lookback window if specified
        if (cutoffTime !== null) {
            const executionTime = execution.timestamp
                ? new Date(execution.timestamp).getTime()
                : execution.at
                    ? new Date(execution.at).getTime()
                    : null;

            if (executionTime && executionTime < cutoffTime) {
                continue; // Too old, skip
            }
        }

        // Build key from execution record
        // Check if execution has pre-computed key or derive from fields
        const executionKey = execution.idempotencyKey
            ? execution.idempotencyKey
            : buildIdempotencyKey(execution);

        // Match found
        if (executionKey === proposedKey) {
            // Check if execution is in final state
            // Final states: success, filled, rejected (confirmed failures)
            // Non-final: pending, retrying (allow duplicate in this case for retry logic)
            const isFinal = execution.status === 'filled'
                || execution.status === 'success'
                || execution.status === 'rejected'
                || execution.status === 'blocked'
                || execution.success === true
                || execution.success === false;

            if (isFinal) {
                return true; // Block duplicate
            }
        }
    }

    return false; // No matching final execution found
}

module.exports = {
    buildIdempotencyKey,
    shouldBlockDuplicate
};
