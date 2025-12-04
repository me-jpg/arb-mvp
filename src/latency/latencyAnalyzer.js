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
  if (!db.connected) {
    throw new Error('Database not connected');
  }

  const windows = await buildTimeWindows(db, options);
  const latencyMetrics = computeLatencyMetrics(windows);
  
  return latencyMetrics;
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
  
  windows.forEach(window => {
    const { marketType, changesByBook } = window;
    
    if (!changesByBook) return;
    
    const books = Object.keys(changesByBook);
    if (books.length < 2) return;
    
    // Find earliest move time across all books in this window
    let fastestBook = null;
    let fastestTime = Infinity;
    
    books.forEach(book => {
      const bookChanges = changesByBook[book];
      if (bookChanges && bookChanges.length > 0) {
        const earliestChange = Math.min(...bookChanges.map(c => c.timestamp));
        if (earliestChange < fastestTime) {
          fastestTime = earliestChange;
          fastestBook = book;
        }
      }
    });
    
    if (!fastestBook) return;
    
    // Track stats for each book
    books.forEach(book => {
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
        const bookFirstMove = Math.min(...bookChanges.map(c => c.timestamp));
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
    });
    
    // Track last mover
    let slowestBook = null;
    let slowestTime = 0;
    books.forEach(book => {
      const bookChanges = changesByBook[book];
      if (bookChanges && bookChanges.length > 0) {
        const latestChange = Math.max(...bookChanges.map(c => c.timestamp));
        if (latestChange > slowestTime) {
          slowestTime = latestChange;
          slowestBook = book;
        }
      }
    });
    if (slowestBook && bookStats[slowestBook]) {
      bookStats[slowestBook].lastMoverCount++;
    }
  });
  
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
