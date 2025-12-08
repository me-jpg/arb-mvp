/**
 * src/execution/arbHedgingStrategy.js
 * 
 * Compute hedging strategies for broken arbitrages.
 * Pure computational logic, no I/O.
 */

/**
 * Compute hedge for a broken arb where some legs filled and others failed.
 * 
 * @param {Object} arbPlan - Original arb plan
 * @param {Array<Object>} legResults - Results from attempted execution
 * @param {Object} hedgingConfig - Hedging configuration
 * @returns {Object} Hedging plan with hedges array and notes
 */
function computeHedgeForBrokenArb(arbPlan, legResults, hedgingConfig) {
    const hedges = [];
    const notes = [];

    // Check if there's any exposure to hedge
    const hasExposure = legResults.some(leg =>
        (leg.status === 'filled' || leg.status === 'partial_filled') && leg.filledStake > 0
    );

    if (!hasExposure) {
        return {
            hedges: [],
            notes: ['no exposure to hedge']
        };
    }

    // Check if arb completed fully
    const allFilled = legResults.every(leg => leg.status === 'filled');
    if (allFilled) {
        return {
            hedges: [],
            notes: ['completed arb, no hedge needed']
        };
    }

    // Check if there's a failure (broken arb)
    const hasFailure = legResults.some(leg =>
        leg.status === 'rejected' || leg.status === 'error'
    );

    if (!hasFailure) {
        // Partial fills but no hard failure - might not need hedging
        return {
            hedges: [],
            notes: ['partial fills but no hard failure']
        };
    }

    // Broken arb: compute hedges for filled/partial legs
    for (const legResult of legResults) {
        // Only hedge legs with filled stake
        if (legResult.filledStake <= 0) {
            continue;
        }

        if (legResult.status !== 'filled' && legResult.status !== 'partial_filled') {
            continue;
        }

        // Find original leg from arbPlan
        const originalLeg = arbPlan.legs.find(l => l.legId === legResult.legId);
        if (!originalLeg) {
            notes.push(`Cannot find original leg ${legResult.legId} for hedging`);
            continue;
        }

        // Compute opposite side
        const oppositeSide = getOppositeSide(originalLeg.side);
        if (!oppositeSide) {
            notes.push(`Unknown side mapping for ${originalLeg.side}, skipping hedge for ${legResult.legId}`);
            continue;
        }

        // Compute hedge stake (apply maxHedgeFraction)
        const maxFraction = hedgingConfig.maxHedgeFraction !== undefined
            ? hedgingConfig.maxHedgeFraction
            : 1.0;
        const hedgeStake = legResult.filledStake * maxFraction;

        // Create hedge
        const hedge = {
            hedgeId: `${arbPlan.id}:${legResult.legId}:hedge`,
            sourceLegId: legResult.legId,
            book: legResult.book,
            eventId: originalLeg.eventId,
            marketType: originalLeg.marketType,
            side: oppositeSide,
            price: originalLeg.price,  // v1: use same price (no re-pricing)
            stake: hedgeStake
        };

        hedges.push(hedge);
    }

    if (hedges.length > 0) {
        notes.push(`Generated ${hedges.length} hedge(s) to flatten exposure`);
    }

    return {
        hedges,
        notes
    };
}

/**
 * Get opposite side for hedging.
 * @param {string} side - Original side
 * @returns {string|null} Opposite side or null if unknown
 */
function getOppositeSide(side) {
    const mapping = {
        'home': 'away',
        'away': 'home',
        'over': 'under',
        'under': 'over'
    };
    return mapping[side] || null;
}

module.exports = {
    computeHedgeForBrokenArb
};
