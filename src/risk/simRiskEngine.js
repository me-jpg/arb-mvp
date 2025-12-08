/**
 * src/risk/simRiskEngine.js
 * 
 * SimRisk stake sizing engine with Kelly criterion and risk caps.
 * Pure functions, deterministic, no side effects.
 */

/**
 * Compute stake size using fractional Kelly criterion.
 * 
 * @param {Object} params - Stake sizing parameters
 * @param {number|null} params.edge - Expected edge (e.g., 0.02 for 2%)
 * @param {number} params.bankroll - Current bankroll
 * @param {number} params.baseUnit - Base unit for stake snapping
 * @param {number} [params.kellyFraction=0.25] - Kelly fraction (default 0.25)
 * @param {number} [params.minStake] - Minimum allowed stake
 * @param {number} [params.maxStake] - Maximum allowed stake
 * @returns {number} Computed stake size
 */
function computeStakeSize(params) {
    const {
        edge,
        bankroll,
        baseUnit,
        kellyFraction = 0.25,
        minStake,
        maxStake
    } = params;

    // No bet if edge is invalid or non-positive
    if (edge == null || edge <= 0) {
        return 0;
    }

    // Compute Kelly-based raw stake
    const k = kellyFraction || 0.25;
    const raw = bankroll * edge * k;

    // Handle invalid computation
    if (raw <= 0 || isNaN(raw)) {
        return 0;
    }

    // Snap to base unit
    let snapped = Math.round(raw / baseUnit) * baseUnit;

    // Apply minimum stake floor
    if (minStake !== undefined && snapped < minStake) {
        return 0;
    }

    // Apply maximum stake ceiling
    if (maxStake !== undefined && snapped > maxStake) {
        snapped = maxStake;
    }

    return snapped;
}

/**
 * src/risk/simRiskEngine.js
 * 
 * SimRisk stake sizing engine with Kelly criterion and risk caps.
 * Pure functions, deterministic, no side effects.
 */

/**
 * Compute stake size using fractional Kelly criterion.
 * 
 * @param {Object} params - Stake sizing parameters
 * @param {number|null} params.edge - Expected edge (e.g., 0.02 for 2%)
 * @param {number} params.bankroll - Current bankroll
 * @param {number} params.baseUnit - Base unit for stake snapping
 * @param {number} [params.kellyFraction=0.25] - Kelly fraction (default 0.25)
 * @param {number} [params.minStake] - Minimum allowed stake
 * @param {number} [params.maxStake] - Maximum allowed stake
 * @returns {number} Computed stake size
 */
function computeStakeSize(params) {
    const {
        edge,
        bankroll,
        baseUnit,
        kellyFraction = 0.25,
        minStake,
        maxStake
    } = params;

    // No bet if edge is invalid or non-positive
    if (edge == null || edge <= 0) {
        return 0;
    }

    // Compute Kelly-based raw stake
    const k = kellyFraction || 0.25;
    const raw = bankroll * edge * k;

    // Handle invalid computation
    if (raw <= 0 || isNaN(raw)) {
        return 0;
    }

    // Snap to base unit
    let snapped = Math.round(raw / baseUnit) * baseUnit;

    // Apply minimum stake floor
    if (minStake !== undefined && snapped < minStake) {
        return 0;
    }

    // Apply maximum stake ceiling
    if (maxStake !== undefined && snapped > maxStake) {
        snapped = maxStake;
    }

    return snapped;
}

/**
 * Apply risk caps to a computed stake.
 * 
 * @param {number} stake - Computed stake before caps
 * @param {Object} caps - Risk caps configuration
 * @param {number} [caps.maxPerBet] - Maximum stake per bet
 * @param {number} [caps.maxPerBookExposure] - Maximum total exposure per book
 * @param {number} [caps.maxDailyLoss] - Maximum daily loss allowed

    // 2. Max per book exposure cap
    if (caps.maxPerBookExposure !== undefined && context.bookExposure !== undefined) {
        const availableRoom = caps.maxPerBookExposure - context.bookExposure;
        if (availableRoom <= 0) {
            return 0; // Already at or over exposure limit
        }
        if (finalStake > availableRoom) {
            finalStake = availableRoom;
        }
    }

    // 3. Max daily loss cap
    if (caps.maxDailyLoss !== undefined && context.dailyPnL !== undefined) {
        // If daily loss has reached or exceeded the cap, no more betting
        if (context.dailyPnL <= -caps.maxDailyLoss) {
            return 0;
        }
    }

    return Math.max(0, finalStake);
}

module.exports = {
    computeStakeSize,
    applyRiskCaps
};
