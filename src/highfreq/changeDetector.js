// src/highfreq/changeDetector.js
// FIXED: Graceful handling of cache misses

const { validateLineChange } = require('../utils/shapeValidator');

/**
 * Classify the type of change
 */
function classifyChange(oldLine, newLine, oldPrice, newPrice) {
  const lineChanged = oldLine !== newLine;
  const priceChanged = oldPrice !== newPrice;

  // Both line and price changed
  if (lineChanged && priceChanged) {
    return 'line_and_price_move';
  }

  // Line moved (price may or may not change)
  if (lineChanged) {
    return 'line_move';
  }

  // Price changed on same line
  if (priceChanged) {
    // For American odds:
    // Positive odds: higher is better for bettor (underdog)
    // Negative odds: closer to -100 (less negative) is better for bettor (favorite)
    
    // Both negative (favorites)
    if (oldPrice < 0 && newPrice < 0) {
      // -120 to -110 = better (price_up)
      // -110 to -120 = worse (price_down)
      return newPrice > oldPrice ? 'price_up' : 'price_down';
    }
    
    // Both positive (underdogs)
    if (oldPrice > 0 && newPrice > 0) {
      // +110 to +120 = better (price_up)
      // +120 to +110 = worse (price_down)
      return newPrice > oldPrice ? 'price_up' : 'price_down';
    }
    
    // Crossed zero (rare) - treat as price movement
    return newPrice > oldPrice ? 'price_up' : 'price_down';
  }

  // Should not reach here
  return 'unknown';
}

/**
 * Detect changes between old and new odds
 * Returns array of change objects
 */
function detectChanges(oddsRecords, oddsCache) {
  const changes = [];

  for (const odds of oddsRecords) {
    const { eventId, book, marketType, side, line, price, timestamp } = odds;

    // Check if we have previous state
    if (!oddsCache.has(eventId, book, marketType, side)) {
      // First time seeing this - store in cache, no change yet
      oddsCache.set(eventId, book, marketType, side, line, price);
      continue;
    }

    // Get previous state
    const previous = oddsCache.get(eventId, book, marketType, side);
    
    // ✅ FIXED: Add null check for cache miss (defensive programming)
    if (!previous) {
      console.warn(`⚠️  Cache miss for ${eventId}|${book}|${marketType}|${side}`);
      oddsCache.set(eventId, book, marketType, side, line, price);
      continue;
    }

    const oldLine = previous.line;
    const oldPrice = previous.price;

    // Check if anything changed
    const lineChanged = line !== oldLine;
    const priceChanged = price !== oldPrice;

    if (!lineChanged && !priceChanged) {
      // No change - skip
      continue;
    }

    // Classify the change
    const changeType = classifyChange(oldLine, line, oldPrice, price);

    // Create change record
    // Note: DB uses snake_case (event_id, detected_at), but in-memory uses camelCase
    // The db.insertLineChanges() maps these fields
    const changeRecord = {
      eventId,
      book,
      marketType,
      side,
      oldLine,
      newLine: line,
      oldPrice,
      newPrice: price,
      changeType,
      detected_at: new Date(timestamp || Date.now()).toISOString()
    };
    
    // Validate shape before using
    validateLineChange({
      event_id: changeRecord.eventId,
      book: changeRecord.book,
      market_type: changeRecord.marketType,
      side: changeRecord.side,
      old_price: changeRecord.oldPrice,
      new_price: changeRecord.newPrice,
      change_type: changeRecord.changeType,
      detected_at: changeRecord.detected_at
    }, 'changeDetector:lineChange');
    
    changes.push(changeRecord);
    
    // Record for getRecentChanges
    oddsCache.recordChange(changeRecord);

    // Update cache with new values
    oddsCache.set(eventId, book, marketType, side, line, price);
  }

  return changes;
}

module.exports = {
  classifyChange,
  detectChanges
};