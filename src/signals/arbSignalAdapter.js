// src/signals/arbSignalAdapter.js
// Converts arbitrage engine results into Signal objects

const { validateSignal } = require('../utils/shapeValidator');

/**
 * Convert arbitrage results from the HF engine into Signal objects
 * 
 * @param {Object} arbResult - Result from findArbitrageOpportunities()
 *   Shape: { opportunities: [...], stats: {...} }
 * @param {Object} options - Configuration
 * @returns {Array} Array of Signal objects
 */
function convertArbResultsToSignals(arbResult, options = {}) {
  const {
    defaultConfidence = 0.9,
    maxEdgeCap = 0.10,
    cycleId = null
  } = options;

  // Handle null/undefined/empty results
  if (!arbResult || !arbResult.opportunities) {
    return [];
  }

  const opportunities = arbResult.opportunities;
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return [];
  }

  const signals = [];

  for (const arb of opportunities) {
    if (!arb) continue;

    // Extract required fields with guards
    const eventId = arb.eventId || arb.gameKey || 'unknown';
    const marketType = arb.marketType || 'moneyline';
    
    // Get selections (the two legs of the arb)
    const selections = arb.selections || [];
    if (selections.length < 2) {
      // Not a valid 2-way arb, skip
      continue;
    }

    const legA = selections[0];
    const legB = selections[1];

    // Primary book = first selection's book (typically the "home" leg)
    const primaryBook = legA.book || 'unknown';
    const referenceBook = legB.book || null;

    // Side = outcome of leg A (e.g., "home", "away", "over", "under")
    const side = legA.outcome || 'home';

    // Price from primary book
    const price = legA.price || -110;

    // Edge estimate from arb result
    // arb.edge is already a decimal (0.024 = 2.4%)
    let edgeEstimate = arb.edge;
    
    // Sanitize edge: handle NaN, Infinity, negative, and cap it
    if (typeof edgeEstimate !== 'number' || !Number.isFinite(edgeEstimate)) {
      edgeEstimate = 0;
    }
    if (edgeEstimate < 0) {
      edgeEstimate = 0;
    }
    edgeEstimate = Math.min(edgeEstimate, maxEdgeCap);

    // Confidence based on edge size
    // Higher edge = higher confidence (within bounds)
    // Base: defaultConfidence, boost slightly for larger edges
    let confidence = defaultConfidence;
    if (edgeEstimate > 0.02) {
      confidence = Math.min(confidence + 0.05, 0.95);
    }
    if (edgeEstimate > 0.05) {
      confidence = 0.95;
    }

    // Build signal ID
    const now = Date.now();
    const cleanEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const id = `pure_arb_${cleanEventId}_${primaryBook}_${referenceBook}_${now}`;

    // Build metadata with raw arb fields
    const metadata = {
      arbId: arb.gameKey || arb.eventId,
      cycleId: arb.cycleId || cycleId,
      comboBooks: [primaryBook, referenceBook].filter(Boolean),
      totalImplied: sanitizeNumber(arb.totalImplied),
      impliedHold: sanitizeNumber(1 - arb.totalImplied), // impliedHold = 1 - totalImplied
      totalStake: sanitizeNumber(arb.totalStake),
      stakePrimary: sanitizeNumber(legA.stake),
      stakeSecondary: sanitizeNumber(legB.stake),
      guaranteedProfit: sanitizeNumber(arb.profitAmount),
      guaranteedReturn: sanitizeNumber(arb.guaranteedReturn),
      selections: [
        { outcome: legA.outcome, book: legA.book, price: legA.price },
        { outcome: legB.outcome, book: legB.book, price: legB.price }
      ]
    };

    const signal = {
      id,
      createdAt: new Date(now).toISOString(),
      type: 'pure_arb',
      eventId: String(eventId),
      marketType,
      side,
      primaryBook,
      referenceBook,
      price,
      edgeEstimate,
      confidence,
      metadata
    };

    // Validate before adding
    if (validateSignal(signal, 'arbSignalAdapter:pureArb')) {
      signals.push(signal);
    }
  }

  return signals;
}

/**
 * Sanitize a number: return 0 if NaN/Infinity/undefined
 */
function sanitizeNumber(val) {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return 0;
  }
  return val;
}

module.exports = {
  convertArbResultsToSignals
};




