// src/utils/healthMonitor.js
// Tracks scraper health and provides graceful degradation

class HealthMonitor {
  constructor() {
    this.status = {
      draftkings: {
        healthy: true,
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
        totalScrapes: 0,
        successfulScrapes: 0,
        lastGameCount: 0,
        avgGameCount: 0
      },
      fanduel: {
        healthy: true,
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
        totalScrapes: 0,
        successfulScrapes: 0,
        lastGameCount: 0,
        avgGameCount: 0
      },
      betmgm: {
        healthy: true,
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
        totalScrapes: 0,
        successfulScrapes: 0,
        lastGameCount: 0,
        avgGameCount: 0
      },
      espnbet: {
        healthy: true,
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
        totalScrapes: 0,
        successfulScrapes: 0,
        lastGameCount: 0,
        avgGameCount: 0
      }
    };
    
    this.thresholds = {
      maxConsecutiveFailures: 3,
      minGameCount: 3, // Flag if book returns fewer than this
      gameCountVariance: 0.5 // Flag if count varies >50% from average
    };
  }
  
  /**
   * Record successful scrape
   * @param {string} book - Book name
   * @param {number} gameCount - Number of games scraped
   * @param {number} marketCount - Number of markets scraped
   */
  recordSuccess(book, gameCount, marketCount = 0) {
    const bookStatus = this.status[book];
    if (!bookStatus) {
      console.warn(`⚠️  Unknown book: ${book}`);
      return;
    }
    
    bookStatus.healthy = true;
    bookStatus.lastSuccess = Date.now();
    bookStatus.consecutiveFailures = 0;
    bookStatus.lastGameCount = gameCount;
    bookStatus.totalScrapes++;
    bookStatus.successfulScrapes++;
    
    // Update rolling average
    bookStatus.avgGameCount = 
      (bookStatus.avgGameCount * (bookStatus.successfulScrapes - 1) + gameCount) / 
      bookStatus.successfulScrapes;
    
    // Check for anomalies
    if (gameCount < this.thresholds.minGameCount) {
      console.warn(`⚠️  ${book} returned only ${gameCount} games (expected >=${this.thresholds.minGameCount})`);
    }
    
    if (bookStatus.avgGameCount > 0) {
      const variance = Math.abs(gameCount - bookStatus.avgGameCount) / bookStatus.avgGameCount;
      if (variance > this.thresholds.gameCountVariance) {
        console.warn(`⚠️  ${book} game count variance: ${(variance * 100).toFixed(1)}% (got ${gameCount}, avg ${bookStatus.avgGameCount.toFixed(1)})`);
      }
    }
  }
  
  /**
   * Record failed scrape
   * @param {string} book - Book name
   * @param {Error} error - Error object
   */
  recordFailure(book, error) {
    const bookStatus = this.status[book];
    if (!bookStatus) {
      console.warn(`⚠️  Unknown book: ${book}`);
      return;
    }
    
    bookStatus.consecutiveFailures++;
    bookStatus.totalScrapes++;
    bookStatus.lastError = {
      message: error.message,
      timestamp: Date.now(),
      stack: error.stack
    };
    
    console.error(`❌ ${book} scrape failed (attempt ${bookStatus.consecutiveFailures}): ${error.message}`);
    
    // Mark unhealthy after threshold
    if (bookStatus.consecutiveFailures >= this.thresholds.maxConsecutiveFailures) {
      bookStatus.healthy = false;
      console.error(`🚨 ${book} marked UNHEALTHY after ${bookStatus.consecutiveFailures} consecutive failures`);
    }
  }
  
  /**
   * Get list of healthy books
   * @returns {array} - Array of book names
   */
  getHealthyBooks() {
    return Object.keys(this.status)
      .filter(book => this.status[book].healthy);
  }
  
  /**
   * Get list of unhealthy books
   * @returns {array} - Array of book names
   */
  getUnhealthyBooks() {
    return Object.keys(this.status)
      .filter(book => !this.status[book].healthy);
  }
  
  /**
   * Get uptime percentage for a book
   * @param {string} book - Book name
   * @returns {number} - Uptime percentage (0-100)
   */
  getUptime(book) {
    const bookStatus = this.status[book];
    if (!bookStatus || bookStatus.totalScrapes === 0) return 0;
    
    return (bookStatus.successfulScrapes / bookStatus.totalScrapes) * 100;
  }
  
  /**
   * Get summary of all books
   * @returns {object} - Health summary
   */
  getSummary() {
    const healthyBooks = this.getHealthyBooks();
    const unhealthyBooks = this.getUnhealthyBooks();
    
    const summary = {
      totalBooks: Object.keys(this.status).length,
      healthyBooks: healthyBooks.length,
      unhealthyBooks: unhealthyBooks.length,
      healthyBookNames: healthyBooks,
      unhealthyBookNames: unhealthyBooks,
      bookDetails: {}
    };
    
    Object.entries(this.status).forEach(([book, status]) => {
      summary.bookDetails[book] = {
        healthy: status.healthy,
        uptime: this.getUptime(book).toFixed(1) + '%',
        consecutiveFailures: status.consecutiveFailures,
        lastGameCount: status.lastGameCount,
        avgGameCount: status.avgGameCount.toFixed(1),
        totalScrapes: status.totalScrapes,
        successfulScrapes: status.successfulScrapes,
        lastSuccess: status.lastSuccess ? new Date(status.lastSuccess).toLocaleTimeString() : 'Never',
        lastError: status.lastError ? {
          message: status.lastError.message,
          time: new Date(status.lastError.timestamp).toLocaleTimeString()
        } : null
      };
    });
    
    return summary;
  }
  
  /**
   * Print detailed health report
   */
  printReport() {
    const summary = this.getSummary();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SCRAPER HEALTH REPORT');
    console.log('='.repeat(60));
    console.log(`Status: ${summary.healthyBooks}/${summary.totalBooks} books healthy`);
    
    if (summary.unhealthyBooks > 0) {
      console.log(`⚠️  Unhealthy: ${summary.unhealthyBookNames.join(', ')}`);
    }
    
    console.log('\nBook Details:');
    Object.entries(summary.bookDetails).forEach(([book, details]) => {
      const icon = details.healthy ? '✅' : '❌';
      console.log(`\n${icon} ${book.toUpperCase()}`);
      console.log(`   Uptime: ${details.uptime}`);
      console.log(`   Last success: ${details.lastSuccess}`);
      console.log(`   Games: ${details.lastGameCount} (avg: ${details.avgGameCount})`);
      console.log(`   Scrapes: ${details.successfulScrapes}/${details.totalScrapes}`);
      
      if (details.lastError) {
        console.log(`   ⚠️  Last error: ${details.lastError.message} (${details.lastError.time})`);
      }
      
      if (details.consecutiveFailures > 0) {
        console.log(`   ⚠️  Consecutive failures: ${details.consecutiveFailures}`);
      }
    });
    
    console.log('='.repeat(60) + '\n');
  }
  
  /**
   * Reset a book's health status (useful for recovery)
   * @param {string} book - Book name
   */
  resetBook(book) {
    if (!this.status[book]) {
      console.warn(`⚠️  Unknown book: ${book}`);
      return;
    }
    
    console.log(`🔄 Resetting health status for ${book}`);
    this.status[book].healthy = true;
    this.status[book].consecutiveFailures = 0;
    this.status[book].lastError = null;
  }
  
  /**
   * Reset all books (useful for system restart)
   */
  resetAll() {
    console.log('🔄 Resetting all book health statuses');
    Object.keys(this.status).forEach(book => this.resetBook(book));
  }
}

module.exports = HealthMonitor;