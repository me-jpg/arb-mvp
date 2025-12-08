/**
 * src/risk/riskExposureTracker.js
 * 
 * Track and compute risk exposure metrics for risk management.
 * Pure functions, deterministic, no side effects.
 */

/**
 * Compute book exposure (total stake) for a specific book.
 * 
 * @param {Array} executions - Array of execution events
 * @param {string} bookId - Book identifier
 * @param {Object} options - Optional parameters
 * @param {number} [options.windowMs] - Time window in milliseconds
 * @param {Date|number} [options.referenceTime] - Reference time (default: now)
 * @returns {Object} Exposure summary
 */
function computeBookExposure(executions, bookId, options = {}) {
    if (!Array.isArray(executions) || !bookId) {
        return { book: bookId, totalStake: 0, count: 0 };
    }

    const { windowMs, referenceTime } = options;
    const refTime = referenceTime ? new Date(referenceTime).getTime() : Date.now();

    let totalStake = 0;
    let count = 0;

    for (const exec of executions) {
        // Filter by book
        if (exec.book !== bookId) {
            continue;
        }

        // Filter by time window if specified
        if (windowMs !== undefined) {
            const execTime = exec.created_at || exec.timestamp || exec.createdAt;
            if (!execTime) continue;

            const execTimestamp = new Date(execTime).getTime();
            if (isNaN(execTimestamp) || execTimestamp < (refTime - windowMs)) {
                continue;
            }
        }

        // Sum stakes
        if (typeof exec.stake === 'number' && exec.stake > 0) {
            totalStake += exec.stake;
            count++;
        }
    }

    return {
        book: bookId,
        totalStake,
        count
    };
}

/**
 * Compute daily PnL from executions.
 * 
 * @param {Array} executions - Array of execution events
 * @param {Object} options - Optional parameters
 * @param {Date|number} [options.dayStart] - Start of day
 * @param {Date|number} [options.dayEnd] - End of day
 * @returns {Object} PnL summary
 */
function computeDailyPnL(executions, options = {}) {
    if (!Array.isArray(executions)) {
        return { totalPnL: 0, count: 0 };
    }

    const { dayStart, dayEnd } = options;

    // Default to start/end of current day if not specified
    const now = new Date();
    const startTime = dayStart ? new Date(dayStart).getTime() : new Date(now.setHours(0, 0, 0, 0)).getTime();
    const endTime = dayEnd ? new Date(dayEnd).getTime() : new Date(now.setHours(23, 59, 59, 999)).getTime();

    let totalPnL = 0;
    let count = 0;

    for (const exec of executions) {
        const execTime = exec.created_at || exec.timestamp || exec.createdAt;
        if (!execTime) continue;

        const execTimestamp = new Date(execTime).getTime();
        if (isNaN(execTimestamp)) continue;

        // Check if within day window
        if (execTimestamp >= startTime && execTimestamp < endTime) {
            if (typeof exec.pnl === 'number') {
                totalPnL += exec.pnl;
                count++;
            }
        }
    }

    return {
        totalPnL,
        count
    };
}

module.exports = {
    computeBookExposure,
    computeDailyPnL
};
