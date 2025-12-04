// src/signals/strategyEngine.js
// Strategy engine for filtering and sizing signals

/**
 * Default strategy configuration
 */
const defaultStrategyConfig = {
  minEdge: 0.02,              // 2% minimum edge
  maxEdge: 0.10,              // cap for sanity (ignore absurd values)
  allowedTypes: ['pure_arb', 'stale_vs_book', 'latency_edge'],
  excludedBooks: [],          // e.g. ['espnbet']
  maxSignalsPerEvent: 2,      // avoid over-stacking one event
  stakeMode: 'flat',          // 'flat' or 'edge_scaled'
  flatStake: 50,              // used if stakeMode === 'flat'
  maxStakePerSignal: 200,     // hard cap
  maxTotalStakePerBook: 5000  // total exposure cap per primaryBook
};

/**
 * Apply strategy filters and sizing to signals
 * @param {Array} signals - Raw signals array
 * @param {Object} strategyConfig - Strategy configuration (merged with defaults)
 * @returns {Object} Strategy results
 */
function applyStrategy(signals, strategyConfig = {}) {
  // Merge with defaults
  const config = { ...defaultStrategyConfig, ...strategyConfig };
  
  // Input sanitization
  const safeSignals = Array.isArray(signals) ? signals : [];
  
  // Track stats
  let rejectedCount = 0;
  
  // Step 1: Filter by edge validity, type, and books
  const validSignals = [];
  for (const sig of safeSignals) {
    if (!sig) {
      rejectedCount++;
      continue;
    }
    
    // Check edge is valid
    const edge = sig.edgeEstimate;
    if (typeof edge !== 'number' || !Number.isFinite(edge)) {
      rejectedCount++;
      continue;
    }
    
    // Check edge bounds
    if (edge < config.minEdge || edge > config.maxEdge) {
      rejectedCount++;
      continue;
    }
    
    // Check type is allowed
    if (!config.allowedTypes.includes(sig.type)) {
      rejectedCount++;
      continue;
    }
    
    // Check book is not excluded
    if (config.excludedBooks.includes(sig.primaryBook)) {
      rejectedCount++;
      continue;
    }
    
    validSignals.push(sig);
  }
  
  // Step 2: Limit per event (keep highest edge)
  const byEvent = new Map();
  for (const sig of validSignals) {
    const eventId = sig.eventId || 'unknown';
    if (!byEvent.has(eventId)) {
      byEvent.set(eventId, []);
    }
    byEvent.get(eventId).push(sig);
  }
  
  const eventLimitedSignals = [];
  for (const [eventId, eventSignals] of byEvent) {
    // Sort by edge descending
    eventSignals.sort((a, b) => (b.edgeEstimate || 0) - (a.edgeEstimate || 0));
    // Take top N
    const kept = eventSignals.slice(0, config.maxSignalsPerEvent);
    eventLimitedSignals.push(...kept);
    rejectedCount += eventSignals.length - kept.length;
  }
  
  // Step 3: Assign stake and enforce per-book caps
  const bookExposure = new Map();
  const selectedSignals = [];
  
  for (const sig of eventLimitedSignals) {
    // Calculate stake
    let stake;
    if (config.stakeMode === 'edge_scaled') {
      // Scale stake based on edge relative to minEdge
      const scaleFactor = sig.edgeEstimate / config.minEdge;
      stake = config.flatStake * scaleFactor;
      // Floor at flatStake
      stake = Math.max(stake, config.flatStake);
    } else {
      // Flat stake
      stake = config.flatStake;
    }
    
    // Cap at max per signal
    stake = Math.min(stake, config.maxStakePerSignal);
    
    // Check per-book exposure
    const book = sig.primaryBook || 'unknown';
    const currentBookExposure = bookExposure.get(book) || 0;
    
    if (currentBookExposure + stake > config.maxTotalStakePerBook) {
      // Would exceed book cap - skip
      rejectedCount++;
      continue;
    }
    
    // Accept signal
    bookExposure.set(book, currentBookExposure + stake);
    
    // Clone signal and add strategyStake (don't mutate original)
    selectedSignals.push({
      ...sig,
      strategyStake: stake
    });
  }
  
  // Compute aggregates
  let totalStake = 0;
  let totalEdge = 0;
  const exposureByBook = {};
  const exposureByType = {};
  
  for (const sig of selectedSignals) {
    const stake = sig.strategyStake;
    totalStake += stake;
    totalEdge += sig.edgeEstimate;
    
    // By book
    const book = sig.primaryBook || 'unknown';
    if (!exposureByBook[book]) {
      exposureByBook[book] = { signalCount: 0, totalStake: 0 };
    }
    exposureByBook[book].signalCount++;
    exposureByBook[book].totalStake += stake;
    
    // By type
    const type = sig.type || 'unknown';
    if (!exposureByType[type]) {
      exposureByType[type] = { signalCount: 0, totalStake: 0 };
    }
    exposureByType[type].signalCount++;
    exposureByType[type].totalStake += stake;
  }
  
  const avgEdgeEstimate = selectedSignals.length > 0 
    ? totalEdge / selectedSignals.length 
    : 0;
  
  const expectedValue = totalStake * avgEdgeEstimate;
  
  return {
    strategyConfig: config,
    selectedSignals,
    rejectedSignalsCount: rejectedCount,
    totalStake,
    avgEdgeEstimate,
    expectedValue,
    exposureByBook,
    exposureByType
  };
}

module.exports = {
  applyStrategy,
  defaultStrategyConfig
};

