// src/signals/signalGenerator.js
// Converts raw latency/stale data into tradeable signals

const { validateSignal } = require('../utils/shapeValidator');

/**
 * Generate signals from latency metrics and stale line events
 * @param {Array} latencyMetrics - Array of LatencyMetric objects
 * @param {Array} staleLines - Array of StaleLineEvent objects
 * @param {Object} options - Configuration
 * @returns {Array} Array of Signal objects
 */
function generateSignalsFromLatency(latencyMetrics = [], staleLines = [], options = {}) {
  const {
    minStaleDurationMs = 3000,
    minSpeedScore = 0.1,
    staleThresholdMs = 60000, // For edge calculation baseline
    defaultPrice = -110       // Placeholder when price unknown
  } = options;

  const signals = [];
  
  // HARDENED: Ensure inputs are arrays (handle null/undefined)
  const safeLatencyMetrics = Array.isArray(latencyMetrics) ? latencyMetrics : [];
  const safeStaleLines = Array.isArray(staleLines) ? staleLines : [];
  
  // Build a speed score map from latency metrics for filtering
  const speedScoreByBook = new Map();
  for (const metric of safeLatencyMetrics) {
    if (!metric || !metric.book) continue;
    const speedScore = (metric.fractionFirstToMove || 0) - (metric.fractionLastToMove || 0);
    speedScoreByBook.set(metric.book, speedScore);
  }

  // Generate signals from stale line events
  for (const stale of safeStaleLines) {
    if (!stale) continue;
    
    // Filter by minimum stale duration
    // HARDENED: Treat NaN/undefined/negative as 0
    let staleDuration = stale.staleDurationMs;
    if (!Number.isFinite(staleDuration) || staleDuration < 0) {
      staleDuration = 0;
    }
    if (staleDuration < minStaleDurationMs) {
      continue;
    }

    // The reference book (fast) is where we'd hypothetically bet
    const primaryBook = stale.referenceBook;
    const staleBook = stale.staleBook;
    
    if (!primaryBook || !staleBook) continue;

    // Optional: filter out signals where "fast" book isn't actually fast
    const primarySpeedScore = speedScoreByBook.get(primaryBook);
    if (primarySpeedScore !== undefined && primarySpeedScore < minSpeedScore) {
      // The "fast" book isn't reliably fast, skip this signal
      continue;
    }

    // Calculate edge estimate
    // Simple heuristic: staleDurationMs / staleThresholdMs, capped at 0.10 (10%)
    // HARDENED: Ensure edge is finite and non-negative
    let rawEdge = staleDuration / staleThresholdMs;
    if (!Number.isFinite(rawEdge) || rawEdge < 0) {
      rawEdge = 0;
    }
    const edgeEstimate = Math.min(rawEdge, 0.10);

    // Calculate confidence based on speed score difference
    let confidence = 0.5; // baseline
    const staleSpeedScore = speedScoreByBook.get(staleBook);
    if (primarySpeedScore !== undefined && staleSpeedScore !== undefined) {
      // Higher confidence when there's a clear speed differential
      const speedDiff = primarySpeedScore - staleSpeedScore;
      confidence = Math.min(0.5 + speedDiff, 0.95);
    }

    // Build signal
    const now = Date.now();
    const signal = {
      id: `stale_vs_book_${stale.eventId}_${now}`,
      createdAt: new Date(now).toISOString(),
      type: 'stale_vs_book',
      eventId: stale.eventId,
      marketType: stale.marketType,
      side: stale.side || 'home',
      primaryBook,
      referenceBook: staleBook, // The slow book we're "fading"
      price: defaultPrice,       // Would need real price from odds snapshot
      edgeEstimate,
      confidence,
      metadata: {
        staleDurationMs: staleDuration,
        staleBook,
        staleStartedAt: stale.staleStartedAt,
        staleDetectedAt: stale.staleDetectedAt
      }
    };

    // Validate before adding
    if (validateSignal(signal, 'signalGenerator:staleSignal')) {
      signals.push(signal);
    }
  }

  return signals;
}

/**
 * Generate pure arbitrage signals from arb opportunities
 * (Placeholder for future Phase 1 integration)
 */
function generateSignalsFromArbitrage(arbOpportunities = [], options = {}) {
  const signals = [];
  
  for (const arb of arbOpportunities) {
    if (!arb) continue;
    
    const now = Date.now();
    const signal = {
      id: `pure_arb_${arb.eventId}_${now}`,
      createdAt: new Date(now).toISOString(),
      type: 'pure_arb',
      eventId: arb.eventId,
      marketType: arb.marketType,
      side: arb.sideA || 'home',
      primaryBook: arb.bookA,
      referenceBook: arb.bookB,
      price: arb.priceA || -110,
      edgeEstimate: (arb.edgePercent || 0) / 100,
      confidence: 0.9, // High confidence for pure arb
      metadata: {
        bookA: arb.bookA,
        bookB: arb.bookB,
        priceA: arb.priceA,
        priceB: arb.priceB
      }
    };

    if (validateSignal(signal, 'signalGenerator:arbSignal')) {
      signals.push(signal);
    }
  }

  return signals;
}

module.exports = {
  generateSignalsFromLatency,
  generateSignalsFromArbitrage
};

