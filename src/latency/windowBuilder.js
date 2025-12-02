// src/latency/windowBuilder.js

/**
 * Build time windows from line_changes table
 */
async function buildTimeWindows(db, windowMs) {
    const query = `
      SELECT event_id, market_type, side, book, old_price, new_price, 
             old_line, new_line, change_type, detected_at
      FROM line_changes
      WHERE detected_at > NOW() - INTERVAL '24 hours'
      ORDER BY detected_at ASC
    `;
    
    const result = await db.pool.query(query);
    const changes = result.rows;
    
    const windows = [];
    const windowMap = new Map();
    
    changes.forEach(change => {
      const key = `${change.event_id}|${change.market_type}|${change.side}`;
      const timestamp = new Date(change.detected_at).getTime();
      
      if (!windowMap.has(key)) {
        windowMap.set(key, {
          eventId: change.event_id,
          marketType: change.market_type,
          side: change.side,
          startTime: timestamp,
          endTime: timestamp + windowMs,
          changes: []
        });
      }
      
      const window = windowMap.get(key);
      
      if (timestamp <= window.endTime) {
        window.changes.push(change);
        window.endTime = Math.max(window.endTime, timestamp + windowMs);
      } else {
        windows.push(window);
        windowMap.set(key, {
          eventId: change.event_id,
          marketType: change.market_type,
          side: change.side,
          startTime: timestamp,
          endTime: timestamp + windowMs,
          changes: [change]
        });
      }
    });
    
    windowMap.forEach(window => windows.push(window));
    
    return windows.filter(w => w.changes.length > 1);
  }
  
  module.exports = {
    buildTimeWindows
  };