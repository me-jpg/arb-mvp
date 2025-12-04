// src/latency/staleLineDetector.js
// Detects stale lines where one book hasn't updated while others have

// Default to 10 minutes instead of 1 hour to avoid OOM
const DEFAULT_LOOKBACK_MS = 10 * 60 * 1000;

/**
 * Detect stale lines for a given time range
 * FIXED: Uses fully parameterized query, computes reference_book in JS to avoid O(n²) correlated subquery
 * @param {Object} db - Database wrapper
 * @param {Object} options - { startTime, endTime, staleThresholdMs }
 * @returns {Array} Stale line events
 */
async function detectStaleLinesForRange(db, options = {}) {
  // Don't do racey db.connected check - let query throw and handle in caller
  
  const { staleThresholdMs = 60000 } = options;
  let { startTime, endTime } = options;
  
  // Default to last 10 minutes if no range specified
  if (!startTime || !endTime) {
    endTime = Date.now();
    startTime = endTime - DEFAULT_LOOKBACK_MS;
  }
  
  // FIXED: Fully parameterized query - no string interpolation
  // Simplified query - compute reference_book and filter in JS to avoid O(n²) subquery
  const query = `
    SELECT DISTINCT ON (event_id, market_type, side, book)
      event_id, market_type, side, book, detected_at
    FROM line_changes
    WHERE detected_at >= $1 AND detected_at <= $2
    ORDER BY event_id, market_type, side, book, detected_at DESC
    LIMIT 50000
  `;
  
  const result = await db.query(query, [new Date(startTime), new Date(endTime)]);
  
  // Compute stale lines in JS - avoids correlated subquery
  return computeStaleLinesFromRows(result.rows, staleThresholdMs);
}

/**
 * Compute stale lines from query result rows
 * @param {Array} rows - DB rows with event_id, market_type, side, book, detected_at
 * @param {number} staleThresholdMs - Threshold in ms
 * @returns {Array} Stale line events
 */
function computeStaleLinesFromRows(rows, staleThresholdMs) {
  if (!rows || rows.length === 0) {
    return [];
  }
  
  // Group by (event_id, market_type, side)
  const groups = new Map();
  
  for (const row of rows) {
    const key = `${row.event_id}|${row.market_type}|${row.side || 'home'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({
      book: row.book,
      timestamp: new Date(row.detected_at).getTime()
    });
  }
  
  const staleLines = [];
  
  for (const [key, bookUpdates] of groups) {
    // Need at least 2 books to compare
    if (bookUpdates.length < 2) continue;
    
    // Find most recent update and reference book (the one that moved most recently)
    let mostRecentTime = -Infinity;
    let referenceBook = null;
    
    for (const update of bookUpdates) {
      if (update.timestamp > mostRecentTime) {
        mostRecentTime = update.timestamp;
        referenceBook = update.book;
      }
    }
    
    // Check each book for staleness
    for (const update of bookUpdates) {
      if (update.book === referenceBook) continue;
      
      const staleDuration = mostRecentTime - update.timestamp;
      if (staleDuration > staleThresholdMs) {
        const [eventId, marketType, side] = key.split('|');
        staleLines.push({
          eventId,
          marketType,
          side,
          staleBook: update.book,
          referenceBook,
          staleStartedAt: new Date(update.timestamp).toISOString(),
          staleDetectedAt: new Date(mostRecentTime).toISOString(),
          staleDurationMs: staleDuration,
          staleReason: 'price_unchanged',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  // Sort by staleness (longest first)
  return staleLines.sort((a, b) => b.staleDurationMs - a.staleDurationMs);
}

// Legacy alias for backward compatibility
async function detectStaleLines(db, thresholdMs) {
  return detectStaleLinesForRange(db, { staleThresholdMs: thresholdMs });
}

/**
 * Pure helper: Detect stale lines from an array of changes (for testing)
 * @param {Array} changes - Array of { event_id, market_type, side, book, detected_at }
 * @param {number} staleThresholdMs - Threshold in ms
 * @returns {Array} Stale line events
 */
function computeStaleLinesFromChanges(changes, staleThresholdMs = 60000) {
  if (!changes || changes.length === 0) {
    return [];
  }
  
  // Group by (event_id, market_type, side)
  const groups = new Map();
  
  for (const change of changes) {
    const key = `${change.event_id}|${change.market_type}|${change.side || 'home'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({
      ...change,
      timestamp: new Date(change.detected_at).getTime()
    });
  }
  
  const staleLines = [];
  
  for (const [key, groupChanges] of groups) {
    // FIXED: Copy array before sorting to avoid mutating input
    const sorted = [...groupChanges].sort((a, b) => a.timestamp - b.timestamp);
    
    // Get unique books
    const bookSet = new Set();
    for (const c of sorted) {
      bookSet.add(c.book);
    }
    const books = [...bookSet];
    if (books.length < 2) continue;
    
    // Track last update time per book - FIXED: use loop instead of filter + Math.max spread
    const lastUpdateByBook = {};
    for (const c of sorted) {
      // Since sorted by timestamp, last occurrence = latest
      lastUpdateByBook[c.book] = c.timestamp;
    }
    
    // Find most recent update across all books - FIXED: use loop
    let mostRecentTime = -Infinity;
    let referenceBook = null;
    for (const [book, time] of Object.entries(lastUpdateByBook)) {
      if (time > mostRecentTime) {
        mostRecentTime = time;
        referenceBook = book;
      }
    }
    
    // Check each book for staleness
    for (const [book, lastUpdate] of Object.entries(lastUpdateByBook)) {
      if (book === referenceBook) continue;
      
      const staleDuration = mostRecentTime - lastUpdate;
      if (staleDuration > staleThresholdMs) {
        const [eventId, marketType, side] = key.split('|');
        staleLines.push({
          eventId,
          marketType,
          side,
          staleBook: book,
          referenceBook,
          staleStartedAt: new Date(lastUpdate).toISOString(),
          staleDetectedAt: new Date(mostRecentTime).toISOString(),
          staleDurationMs: staleDuration,
          staleReason: 'price_unchanged'
        });
      }
    }
  }
  
  return staleLines.sort((a, b) => b.staleDurationMs - a.staleDurationMs);
}

module.exports = {
  detectStaleLinesForRange,
  detectStaleLines,
  computeStaleLinesFromChanges
};
