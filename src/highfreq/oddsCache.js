// src/highfreq/oddsCache.js
// In-memory cache for tracking previous odds state

class OddsCache {
    constructor() {
      this.cache = new Map();
      this.recentChanges = [];
      this.maxRecentChanges = 100;
    }
  
    /**
     * Generate cache key from odds record
     */
    _generateKey(eventId, book, marketType, side) {
      return `${eventId}|${book}|${marketType}|${side}`;
    }
  
    /**
     * Get previous odds from cache
     */
    get(eventId, book, marketType, side) {
      const key = this._generateKey(eventId, book, marketType, side);
      return this.cache.get(key);
    }
  
    /**
     * Set odds in cache
     */
    set(eventId, book, marketType, side, line, price) {
      const key = this._generateKey(eventId, book, marketType, side);
      this.cache.set(key, {
        line,
        price,
        timestamp: Date.now()
      });
    }
  
    /**
     * Check if odds exists in cache
     */
    has(eventId, book, marketType, side) {
      const key = this._generateKey(eventId, book, marketType, side);
      return this.cache.has(key);
    }
  
    /**
     * Clear all cache
     */
    clear() {
      this.cache.clear();
    }
  
    /**
     * Get cache size
     */
    size() {
      return this.cache.size;
    }
  
    /**
     * Remove old entries (older than maxAgeMs)
     */
    prune(maxAgeMs = 3600000) { // Default 1 hour
      const now = Date.now();
      let removed = 0;
      
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > maxAgeMs) {
          this.cache.delete(key);
          removed++;
        }
      }
      
      return removed;
    }

    /**
     * Record a change for recent changes tracking
     */
    recordChange(change) {
      this.recentChanges.unshift(change);
      if (this.recentChanges.length > this.maxRecentChanges) {
        this.recentChanges.pop();
      }
    }

    /**
     * Get recent changes (most recent first)
     */
    getRecentChanges(count = 10) {
      return this.recentChanges.slice(0, count);
    }
  }
  
  module.exports = new OddsCache();