// src/signals/signalSummaryCore.js
// Core logic for signal summary analytics - used by CLI and API

/**
 * Sanitize edge value
 */
function safeEdge(edge) {
  if (typeof edge !== 'number' || !Number.isFinite(edge)) return null;
  return edge;
}

/**
 * Sanitize confidence value
 */
function safeConfidence(conf) {
  if (typeof conf !== 'number' || !Number.isFinite(conf)) return null;
  return conf;
}

/**
 * Compute global stats from signals
 * @param {Array} signals - Array of signal objects
 * @returns {Object} Global statistics
 */
function computeGlobalStats(signals) {
  const eventIds = new Set();
  const books = new Set();
  const types = new Set();
  
  let totalEdge = 0;
  let edgeCount = 0;
  let minEdge = Infinity;
  let maxEdge = -Infinity;
  
  let totalConf = 0;
  let confCount = 0;

  for (const sig of signals) {
    if (sig.eventId) eventIds.add(sig.eventId);
    if (sig.primaryBook) books.add(sig.primaryBook);
    if (sig.type) types.add(sig.type);

    const edge = safeEdge(sig.edgeEstimate);
    if (edge !== null) {
      totalEdge += edge;
      edgeCount++;
      if (edge > 0 && edge < minEdge) minEdge = edge;
      if (edge > maxEdge) maxEdge = edge;
    }

    const conf = safeConfidence(sig.confidence);
    if (conf !== null) {
      totalConf += conf;
      confCount++;
    }
  }

  return {
    totalSignals: signals.length,
    distinctEvents: eventIds.size,
    booksSeen: [...books],
    typesSeen: [...types],
    avgEdgeEstimate: edgeCount > 0 ? totalEdge / edgeCount : 0,
    minEdgeEstimate: minEdge === Infinity ? 0 : minEdge,
    maxEdgeEstimate: maxEdge === -Infinity ? 0 : maxEdge,
    avgConfidence: confCount > 0 ? totalConf / confCount : 0
  };
}

/**
 * Compute per-book stats from signals
 * @param {Array} signals - Array of signal objects
 * @returns {Array} Per-book statistics
 */
function computePerBookStats(signals) {
  const bookStats = new Map();

  for (const sig of signals) {
    const book = sig.primaryBook || 'unknown';
    if (!bookStats.has(book)) {
      bookStats.set(book, { 
        count: 0, totalEdge: 0, edgeCount: 0, 
        minEdge: Infinity, maxEdge: -Infinity, 
        totalConf: 0, confCount: 0 
      });
    }
    const stats = bookStats.get(book);
    stats.count++;

    const edge = safeEdge(sig.edgeEstimate);
    if (edge !== null) {
      stats.totalEdge += edge;
      stats.edgeCount++;
      if (edge > 0 && edge < stats.minEdge) stats.minEdge = edge;
      if (edge > stats.maxEdge) stats.maxEdge = edge;
    }

    const conf = safeConfidence(sig.confidence);
    if (conf !== null) {
      stats.totalConf += conf;
      stats.confCount++;
    }
  }

  const result = [];
  for (const [book, stats] of bookStats) {
    result.push({
      book,
      signalCount: stats.count,
      avgEdge: stats.edgeCount > 0 ? stats.totalEdge / stats.edgeCount : 0,
      minEdge: stats.minEdge === Infinity ? 0 : stats.minEdge,
      maxEdge: stats.maxEdge === -Infinity ? 0 : stats.maxEdge,
      avgConfidence: stats.confCount > 0 ? stats.totalConf / stats.confCount : 0
    });
  }

  return result.sort((a, b) => b.signalCount - a.signalCount);
}

/**
 * Compute per-type stats from signals
 * @param {Array} signals - Array of signal objects
 * @returns {Array} Per-type statistics
 */
function computePerTypeStats(signals) {
  const typeStats = new Map();

  for (const sig of signals) {
    const type = sig.type || 'unknown';
    if (!typeStats.has(type)) {
      typeStats.set(type, { count: 0, totalEdge: 0, edgeCount: 0, totalConf: 0, confCount: 0 });
    }
    const stats = typeStats.get(type);
    stats.count++;

    const edge = safeEdge(sig.edgeEstimate);
    if (edge !== null) {
      stats.totalEdge += edge;
      stats.edgeCount++;
    }

    const conf = safeConfidence(sig.confidence);
    if (conf !== null) {
      stats.totalConf += conf;
      stats.confCount++;
    }
  }

  const result = [];
  for (const [type, stats] of typeStats) {
    result.push({
      type,
      signalCount: stats.count,
      avgEdge: stats.edgeCount > 0 ? stats.totalEdge / stats.edgeCount : 0,
      avgConfidence: stats.confCount > 0 ? stats.totalConf / stats.confCount : 0
    });
  }

  return result.sort((a, b) => b.signalCount - a.signalCount);
}

/**
 * Compute edge distribution histogram
 * @param {Array} signals - Array of signal objects
 * @returns {Array} Histogram buckets
 */
function computeEdgeHistogram(signals) {
  const buckets = [
    { label: '< 1%', min: -Infinity, max: 0.01, count: 0 },
    { label: '1-2%', min: 0.01, max: 0.02, count: 0 },
    { label: '2-3%', min: 0.02, max: 0.03, count: 0 },
    { label: '3-5%', min: 0.03, max: 0.05, count: 0 },
    { label: '5-10%', min: 0.05, max: 0.10, count: 0 },
    { label: '≥ 10%', min: 0.10, max: Infinity, count: 0 }
  ];

  let validCount = 0;

  for (const sig of signals) {
    const edge = safeEdge(sig.edgeEstimate);
    if (edge === null) continue;
    
    validCount++;
    for (const bucket of buckets) {
      if (edge >= bucket.min && edge < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  // Return simplified format
  return buckets.map(b => ({
    bucket: b.label,
    count: b.count,
    percent: validCount > 0 ? (b.count / validCount) * 100 : 0
  }));
}

/**
 * Generate complete summary from signals
 * @param {Array} signals - Array of signal objects
 * @returns {Object} Complete summary object
 */
function generateSummary(signals) {
  const safeSignals = Array.isArray(signals) ? signals : [];
  
  return {
    global: computeGlobalStats(safeSignals),
    perBook: computePerBookStats(safeSignals),
    perType: computePerTypeStats(safeSignals),
    edgeHistogram: computeEdgeHistogram(safeSignals)
  };
}

module.exports = {
  computeGlobalStats,
  computePerBookStats,
  computePerTypeStats,
  computeEdgeHistogram,
  generateSummary
};

