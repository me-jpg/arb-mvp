// src/latency/latencyAnalyzer.js
const { buildTimeWindows } = require('./windowBuilder');

/**
 * Analyze latency patterns from line_changes data
 */
async function analyzeLatency(db, windowMs) {
  if (!db.connected) {
    throw new Error('Database not connected');
  }

  const windows = await buildTimeWindows(db, windowMs);
  const latencyMetrics = computeLatencyMetrics(windows);
  
  return latencyMetrics;
}

/**
 * Compute per-book latency metrics from windows
 */
function computeLatencyMetrics(windows) {
  const bookStats = {};
  
  windows.forEach(window => {
    const { eventId, marketType, changes } = window;
    
    if (changes.length === 0) return;
    
    // Sort by timestamp
    const sorted = changes.sort((a, b) => 
      new Date(a.detected_at) - new Date(b.detected_at)
    );
    
    const firstMover = sorted[0].book;
    const firstTime = new Date(sorted[0].detected_at).getTime();
    
    // Initialize book stats
    if (!bookStats[firstMover]) {
      bookStats[firstMover] = {
        book: firstMover,
        firstMoverCount: 0,
        totalWindows: 0,
        avgDelayMs: 0,
        marketBreakdown: {}
      };
    }
    
    bookStats[firstMover].firstMoverCount++;
    
    // Track delays for other books
    sorted.forEach((change, idx) => {
      const book = change.book;
      
      if (!bookStats[book]) {
        bookStats[book] = {
          book,
          firstMoverCount: 0,
          totalWindows: 0,
          avgDelayMs: 0,
          marketBreakdown: {}
        };
      }
      
      bookStats[book].totalWindows++;
      
      if (idx > 0) {
        const delay = new Date(change.detected_at).getTime() - firstTime;
        const current = bookStats[book].avgDelayMs * (bookStats[book].totalWindows - 1);
        bookStats[book].avgDelayMs = (current + delay) / bookStats[book].totalWindows;
      }
      
      // Market breakdown
      if (!bookStats[book].marketBreakdown[marketType]) {
        bookStats[book].marketBreakdown[marketType] = {
          firstMoverCount: 0,
          totalWindows: 0
        };
      }
      
      bookStats[book].marketBreakdown[marketType].totalWindows++;
      
      if (book === firstMover) {
        bookStats[book].marketBreakdown[marketType].firstMoverCount++;
      }
    });
  });
  
  // Compute fractions
  Object.values(bookStats).forEach(stats => {
    stats.firstMoverFraction = stats.firstMoverCount / stats.totalWindows;
  });
  
  return Object.values(bookStats);
}

module.exports = {
  analyzeLatency,
  computeLatencyMetrics
};