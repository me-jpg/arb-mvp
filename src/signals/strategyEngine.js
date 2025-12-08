// src/signals/strategyEngine.js
// Strategy engine for filtering and sizing signals

const fs = require('fs');
const path = require('path');
// Try to import latency model - robust require
let buildBookLatencyStats;
try {
  ({ buildBookLatencyStats } = require('../latency/bookLatencyModel'));
} catch (e) {
  // If module missing (e.g. during minimal test setup), mock it
  buildBookLatencyStats = () => ({ byBook: {}, totalSamples: 0 });
}

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
  maxTotalStakePerBook: 5000, // total exposure cap per primaryBook

  // Latency Awareness (Optional)
  latencyAware: false,        // enable latency checks
  maxAllowedLagMs: null,      // reject signals from books typically slower than this
  preferFastBooks: false,     // if true, prefers faster books when edges are similar
  latencyLogPath: 'logs/line-changes.jsonl', // source for latency stats
  injectedLatencyStats: null  // allow injecting stats object for testing
};

/**
 * Helper to get latency stats.
 * Pure if injectedStats provided, otherwise reads file (side effect).
 */
function getLatencyAwareContext(config) {
  if (config.injectedLatencyStats) {
    return { bookStats: config.injectedLatencyStats };
  }

  if (!config.latencyAware) return { bookStats: null };

  // Read log file (limit 10k lines for perf)
  // This sync reading is not ideal for high-freq, but strategy engine is usually offline/periodic.
  // For production, this should likely be cached or passed in from outside.
  // We'll read a small tail or just assume file existence.
  try {
    const logPath = config.latencyLogPath || 'logs/line-changes.jsonl';
    const absPath = path.isAbsolute(logPath) ? logPath : path.resolve(process.cwd(), logPath);

    if (fs.existsSync(absPath)) {
      // Read file synchronously for simplicity in this synchronous engine
      // Limit to 5MB read or similar
      const fd = fs.openSync(absPath, 'r');
      const buffer = Buffer.alloc(1024 * 1024 * 5); // 5MB buffer
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0); // Read from start
      fs.closeSync(fd);

      const content = buffer.toString('utf8', 0, bytesRead);
      const lines = content.split('\n').filter(l => l.trim());
      const events = lines.map(l => {
        try { return JSON.parse(l); } catch (e) { return null; }
      }).filter(e => e);

      const stats = buildBookLatencyStats(events);
      return { bookStats: stats.byBook };
    }
  } catch (e) {
    // console.warn('Failed to load latency logs', e.message);
  }

  return { bookStats: {} };
}

/**
 * Apply strategy filters and sizing to signals
 * @param {Array} signals - Raw signals array
 * @param {Object} strategyConfig - Strategy configuration (merged with defaults)
 * @returns {Object} Strategy results
 */
function applyStrategy(signals, strategyConfig = {}) {
  // Merge with defaults
  const config = { ...defaultStrategyConfig, ...strategyConfig };

  // Resolve Latency Context
  const { bookStats } = getLatencyAwareContext(config);

  // Input sanitization
  const safeSignals = Array.isArray(signals) ? signals : [];

  // Track stats
  let rejectedCount = 0;

  // Step 1: Filter by edge validity, type, books, and LATENCY
  const validSignals = [];
  for (const sig of safeSignals) {
    if (!sig) { rejectedCount++; continue; }

    // Check edge is valid
    const edge = sig.edgeEstimate;
    if (typeof edge !== 'number' || !Number.isFinite(edge)) { rejectedCount++; continue; }
    if (edge < config.minEdge || edge > config.maxEdge) { rejectedCount++; continue; }
    if (!config.allowedTypes.includes(sig.type)) { rejectedCount++; continue; }
    if (config.excludedBooks.includes(sig.primaryBook)) { rejectedCount++; continue; }

    // --> LATENCY FILTER <--
    if (config.latencyAware && config.maxAllowedLagMs !== null && bookStats) {
      const book = sig.primaryBook;
      const stats = bookStats[book];

      // If we have stats for this book and it's too slow -> Reject
      // (If no stats, we can choose to be strict or lenient. Being lenient for now.)
      if (stats && stats.avgLagMs > config.maxAllowedLagMs) {
        // console.log(`Rejecting ${book} signal due to lag ${stats.avgLagMs}ms > ${config.maxAllowedLagMs}ms`);
        rejectedCount++;
        continue;
      }
    }

    validSignals.push(sig);
  }

  // --> ML SCORING <--
  // Load ML scoring config from global config if not explicitly provided
  let mlScoringSignals = validSignals;
  if (config.mlScoring?.enabled || (typeof config.mlScoring === 'undefined' && require('../../config').mlScoring?.enabled)) {
    try {
      const { scoreExample } = require('../ml/modelAdapter');
      const globalConfig = require('../../config');
      const mlConfig = config.mlScoring || globalConfig.mlScoring || {};
      const mlMode = mlConfig.mode || 'baseline';
      const mlMinScore = typeof mlConfig.minScore === 'number' ? mlConfig.minScore : 0;

      // Score each signal
      for (const sig of validSignals) {
        // Build ML example from signal
        const example = {
          id: sig.signalId || sig.id || 'unknown',
          features: {
            edgeEstimate: sig.edgeEstimate ?? null,
            bookAvgLagMs: bookStats?.[sig.primaryBook]?.avgLagMs ?? null,
            marketVolatilityScore: sig.metadata?.volatilityScore ?? sig.volatilityScore ?? null,
            stakePlanned: sig.strategyStake ?? config.flatStake ?? null
          }
        };

        // Score it
        const scored = scoreExample(example, { mode: mlMode });

        // Attach ML score to signal metadata
        sig.mlScore = scored.score;
        sig.metadata = { ...(sig.metadata || {}), mlScore: scored.score };
      }

      // Filter by minScore if applicable
      if (mlMinScore !== 0) {
        mlScoringSignals = validSignals.filter(sig => (sig.mlScore ?? 0) >= mlMinScore);
        rejectedCount += validSignals.length - mlScoringSignals.length;
      }
    } catch (err) {
      // If ML scoring fails, log and continue without it
      console.warn('[strategyEngine] ML scoring failed:', err.message);
    }
  }

  // Step 2: Limit per event (keep highest edge or ML score)
  const byEvent = new Map();
  for (const sig of mlScoringSignals) {
    const eventId = sig.eventId || 'unknown';
    if (!byEvent.has(eventId)) {
      byEvent.set(eventId, []);
    }
    byEvent.get(eventId).push(sig);
  }

  const eventLimitedSignals = [];
  for (const [eventId, eventSignals] of byEvent) {
    // Sort logic
    eventSignals.sort((a, b) => {
      const edgeA = a.edgeEstimate || 0;
      const edgeB = b.edgeEstimate || 0;

      // If ML scores are available, use them for sorting
      if (typeof a.mlScore === 'number' && typeof b.mlScore === 'number') {
        return b.mlScore - a.mlScore; // Descending ML score
      }

      // If preferring fast books, check if edges are close enough to swap priority
      // Assume "close enough" is within 10% of the edge value or 0.005 absolute?
      // Let's use a robust sort: 
      // If preferFastBooks is ON, use a composite score: Edge - (LagPenalty * Factor)
      // Or strictly sort by Fast Book first if Edges are effectively equal.

      if (config.latencyAware && config.preferFastBooks && bookStats) {
        const statsA = bookStats[a.primaryBook];
        const statsB = bookStats[b.primaryBook];
        const lagA = statsA ? statsA.avgLagMs : 9999;
        const lagB = statsB ? statsB.avgLagMs : 9999;

        // If edges are very different (> 0.5% diff), stick to edge
        // (unless user wants strictly speed, but that usually loses money)
        if (Math.abs(edgeA - edgeB) > 0.005) {
          return edgeB - edgeA; // Descending edge
        }

        // Edges are close: prefer lower lag
        return lagA - lagB; // Ascending lag (lower is better)
      }

      // Default: Sort by edge descending
      return edgeB - edgeA;
    });

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
      const scaleFactor = sig.edgeEstimate / config.minEdge;
      stake = config.flatStake * scaleFactor;
      stake = Math.max(stake, config.flatStake);
    } else {
      stake = config.flatStake;
    }

    // Cap at max per signal
    stake = Math.min(stake, config.maxStakePerSignal);

    // Check per-book exposure
    const book = sig.primaryBook || 'unknown';
    const currentBookExposure = bookExposure.get(book) || 0;

    if (currentBookExposure + stake > config.maxTotalStakePerBook) {
      rejectedCount++;
      continue;
    }

    // Accept signal
    bookExposure.set(book, currentBookExposure + stake);

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
  defaultStrategyConfig,
  getLatencyAwareContext // logic exposed for testing
};




