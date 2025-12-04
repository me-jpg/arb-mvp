// src/latency/windowBuilder.js
// Groups line_changes into FIXED-LENGTH time windows for latency analysis

// Default to 10 minutes instead of 24 hours to avoid OOM
const DEFAULT_LOOKBACK_MS = 10 * 60 * 1000;

/**
 * Build time windows from line_changes within a time range
 * Windows are FIXED-LENGTH buckets: [k*windowMs, (k+1)*windowMs)
 * @param {Object} db - Database wrapper (must have .query() method)
 * @param {Object} options - { startTime, endTime, windowMs }
 * @returns {Array} Array of window objects with changesByBook
 */
async function buildTimeWindows(db, options = {}) {
  const { windowMs = 30000 } = options;
  let { startTime, endTime } = options;
  
  // Default to last 10 minutes if no range specified (not 24 hours!)
  if (!startTime || !endTime) {
    endTime = Date.now();
    startTime = endTime - DEFAULT_LOOKBACK_MS;
  }
  
  // Always use parameterized queries - no string interpolation
  const query = `
    SELECT event_id, market_type, side, book, old_price, new_price, 
           old_line, new_line, change_type, created_at
    FROM line_changes
    WHERE created_at >= $1 AND created_at <= $2
    ORDER BY created_at ASC
    LIMIT 50000
  `;
  
  const result = await db.query(query, [new Date(startTime), new Date(endTime)]);
  const changes = result.rows;
  
  if (changes.length === 0) {
    return [];
  }
  
  // Use pure helper for the actual windowing logic
  return buildWindowsFromChanges(changes, windowMs);
}

/**
 * Pure helper: Build FIXED-LENGTH windows from an array of change objects
 * Each window covers exactly [windowStart, windowStart + windowMs)
 * A new window is created when timestamp >= current windowStart + windowMs
 * 
 * @param {Array} changes - Array of { event_id, market_type, side, book, created_at, ... }
 * @param {number} windowMs - Window size in ms
 * @returns {Array} Array of window objects
 */
function buildWindowsFromChanges(changes, windowMs = 30000) {
  if (!changes || changes.length === 0) {
    return [];
  }
  
  // Sort by created_at (copy first to avoid mutating input)
  const sorted = [...changes].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  const windows = [];
  // Map: groupKey -> { currentWindow, windowStart }
  const windowState = new Map();
  
  for (const change of sorted) {
    const key = `${change.event_id}|${change.market_type}|${change.side || 'home'}`;
    const timestamp = new Date(change.created_at).getTime();
    
    if (!windowState.has(key)) {
      // First change for this group - start first window
      const newWindow = createWindow(change, timestamp, windowMs);
      addChangeToWindow(newWindow, change, timestamp);  // Don't forget to add first change!
      windowState.set(key, {
        windowStart: timestamp,
        currentWindow: newWindow
      });
    } else {
      const state = windowState.get(key);
      
      // Check if this change belongs to current window or needs a new one
      // FIXED: Window has fixed end time, not extending
      if (timestamp < state.windowStart + windowMs) {
        // Same window - add change
        addChangeToWindow(state.currentWindow, change, timestamp);
      } else {
        // Finalize current window and start new one
        if (hasMultipleBooks(state.currentWindow)) {
          windows.push(state.currentWindow);
        }
        
        // Calculate new window start (aligned to window boundaries)
        const newWindowStart = state.windowStart + 
          Math.floor((timestamp - state.windowStart) / windowMs) * windowMs;
        
        state.windowStart = newWindowStart;
        state.currentWindow = createWindow(change, newWindowStart, windowMs);
        addChangeToWindow(state.currentWindow, change, timestamp);
      }
    }
  }
  
  // Add remaining windows
  for (const state of windowState.values()) {
    if (hasMultipleBooks(state.currentWindow)) {
      windows.push(state.currentWindow);
    }
  }
  
  return windows;
}

function createWindow(change, windowStart, windowMs) {
  return {
    eventId: change.event_id,
    marketType: change.market_type,
    side: change.side || 'home',
    startTime: windowStart,
    endTime: windowStart + windowMs,
    changesByBook: {}
  };
}

function addChangeToWindow(window, change, timestamp) {
  const book = change.book;
  if (!window.changesByBook[book]) {
    window.changesByBook[book] = [];
  }
  window.changesByBook[book].push({
    oldPrice: change.old_price,
    newPrice: change.new_price,
    oldLine: change.old_line,
    newLine: change.new_line,
    changeType: change.change_type,
    timestamp: timestamp
  });
}

function hasMultipleBooks(window) {
  return Object.keys(window.changesByBook).length >= 2;
}

module.exports = {
  buildTimeWindows,
  buildWindowsFromChanges
};
