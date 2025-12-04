// src/latency/latencyAnalyzer.js
// Computes per-book latency metrics from line_changes windows

const { buildTimeWindows } = require('./windowBuilder');

/**
 * Analyze latency for a given time range
 * @param {Object} db - Database wrapper
 * @param {Object} options - { startTime, endTime, windowMs }
 * @returns {Array} Per-book latency metrics
 */
async function analyzeLatencyForRange(db, options = {}) {
  // Don't do racey db.connected check - let query throw and handle in caller
  const windows = await buildTimeWindows(db, options);
  const latencyMetrics = computeLatencyMetrics(windows);
  
  return latencyMetrics;
}

/**
 * Find minimum timestamp in array WITHOUT spread operator (avoids stack overflow)
 */
function minTimestamp(changes) {
  if (!changes || changes.length === 0) return Infinity;
  let min = changes[0].timestamp;
  for (let i = 1; i < changes.length; i++) {
    if (changes[i].timestamp < min) {
      min = changes[i].timestamp;
    }
  }
  return min;
}

/**
 * Find maximum timestamp in array WITHOUT spread operator (avoids stack overflow)
 */
function maxTimestamp(changes) {
  if (!changes || changes.length === 0) return -Infinity;
  let max = changes[0].timestamp;
  for (let i = 1; i < changes.length; i++) {
    if (changes[i].timestamp > max) {
      max = changes[i].timestamp;
    }
  }
  return max;
}

/**
 * Compute per-book latency metrics from windows
 * @param {Array} windows - Array of window objects with changesByBook
 * @returns {Array} Per-book aggregated metrics
 */
function computeLatencyMetrics(windows) {
  const bookStats = {};
  
  if (!windows || windows.length === 0) {
    return [];
  }
  
  for (const window of windows) {
    const { marketType, changesByBook } = window;
    
    if (!changesByBook) continue;
    
    const books = Object.keys(changesByBook);
    if (books.length < 2) continue;
    
    // Find earliest move time across all books in this window
    // FIXED: Use loop instead of Math.min(...spread) to avoid stack overflow
    let fastestBook = null;
    let fastestTime = Infinity;
    
    for (const book of books) {
      const bookChanges = changesByBook[book];
      if (bookChanges && bookChanges.length > 0) {
        const earliestChange = minTimestamp(bookChanges);
        if (earliestChange < fastestTime) {
          fastestTime = earliestChange;
          fastestBook = book;
        }
      }
    }
    
    if (!fastestBook) continue;
    
    // Track stats for each book
    for (const book of books) {
      if (!bookStats[book]) {
        bookStats[book] = {
          book,
          totalWindows: 0,
          windowsWithChange: 0,
          firstMoverCount: 0,
          lastMoverCount: 0,
          totalDelayMs: 0,
          delayCount: 0,
          marketBreakdown: {}
        };
      }
      
      const stats = bookStats[book];
      stats.totalWindows++;
      stats.windowsWithChange++;
      
      // Track if this book was first
      if (book === fastestBook) {
        stats.firstMoverCount++;
      }
      
      // Calculate delay vs fastest
      const bookChanges = changesByBook[book];
      if (bookChanges && bookChanges.length > 0) {
        const bookFirstMove = minTimestamp(bookChanges);
        const delay = bookFirstMove - fastestTime;
        
        if (delay > 0) {
          stats.totalDelayMs += delay;
          stats.delayCount++;
        }
      }
      
      // Market breakdown
      if (!stats.marketBreakdown[marketType]) {
        stats.marketBreakdown[marketType] = {
          totalWindows: 0,
          firstMoverCount: 0
        };
      }
      stats.marketBreakdown[marketType].totalWindows++;
      if (book === fastestBook) {
        stats.marketBreakdown[marketType].firstMoverCount++;
      }
    }
    
    // Track last mover - FIXED: use loop instead of spread
    let slowestBook = null;
    let slowestTime = -Infinity;
    for (const book of books) {
      const bookChanges = changesByBook[book];
      if (bookChanges && bookChanges.length > 0) {
        const latestChange = maxTimestamp(bookChanges);
        if (latestChange > slowestTime) {
          slowestTime = latestChange;
          slowestBook = book;
        }
      }
    }
    if (slowestBook && bookStats[slowestBook]) {
      bookStats[slowestBook].lastMoverCount++;
    }
  }
  
  // Compute derived metrics
  return Object.values(bookStats).map(stats => ({
    book: stats.book,
    totalWindows: stats.totalWindows,
    windowsWithChange: stats.windowsWithChange,
    avgDelayMsVsFastest: stats.delayCount > 0 
      ? Math.round(stats.totalDelayMs / stats.delayCount) 
      : 0,
    fractionFirstToMove: stats.totalWindows > 0 
      ? stats.firstMoverCount / stats.totalWindows 
      : 0,
    fractionLastToMove: stats.totalWindows > 0 
      ? stats.lastMoverCount / stats.totalWindows 
      : 0,
    marketBreakdown: stats.marketBreakdown
  }));
}

// Legacy alias for backward compatibility
async function analyzeLatency(db, windowMs) {
  return analyzeLatencyForRange(db, { windowMs });
}

module.exports = {
  analyzeLatencyForRange,
  analyzeLatency,
  computeLatencyMetrics
};
