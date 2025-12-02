// src/latency/staleLineDetector.js

/**
 * Detect stale lines based on lack of updates vs other books
 */
async function detectStaleLines(db, thresholdMs) {
    if (!db.connected) {
      throw new Error('Database not connected');
    }
    
    const query = `
      WITH latest_changes AS (
        SELECT DISTINCT ON (event_id, market_type, side, book)
          event_id, market_type, side, book, detected_at
        FROM line_changes
        WHERE detected_at > NOW() - INTERVAL '1 hour'
        ORDER BY event_id, market_type, side, book, detected_at DESC
      ),
      market_activity AS (
        SELECT 
          event_id, 
          market_type, 
          side,
          MAX(detected_at) as most_recent_change,
          COUNT(DISTINCT book) as active_books
        FROM latest_changes
        GROUP BY event_id, market_type, side
        HAVING COUNT(DISTINCT book) > 1
      )
      SELECT 
        lc.event_id,
        lc.market_type,
        lc.side,
        lc.book,
        lc.detected_at as last_update,
        ma.most_recent_change,
        EXTRACT(EPOCH FROM (ma.most_recent_change - lc.detected_at)) * 1000 as staleness_ms
      FROM latest_changes lc
      JOIN market_activity ma 
        ON lc.event_id = ma.event_id 
        AND lc.market_type = ma.market_type
        AND lc.side = ma.side
      WHERE ma.most_recent_change - lc.detected_at > INTERVAL '${thresholdMs} milliseconds'
      ORDER BY staleness_ms DESC
    `;
    
    const result = await db.pool.query(query);
    
    return result.rows.map(row => ({
      eventId: row.event_id,
      marketType: row.market_type,
      side: row.side,
      book: row.book,
      lastUpdate: row.last_update,
      mostRecentChange: row.most_recent_change,
      stalenessMs: parseFloat(row.staleness_ms),
      timestamp: new Date().toISOString()
    }));
  }
  
  module.exports = {
    detectStaleLines
  };