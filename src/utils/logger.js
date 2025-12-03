// src/utils/logger.js
const fs = require('fs');
const path = require('path');

// Log directory
const LOGS_DIR = path.join(__dirname, '../../logs');

// Log files
const LINE_CHANGES_LOG = path.join(LOGS_DIR, 'line-changes.jsonl');
const ARB_OPPORTUNITIES_LOG = path.join(LOGS_DIR, 'arbitrage-opportunities.jsonl');
const ERRORS_LOG = path.join(LOGS_DIR, 'errors.jsonl');
const CYCLE_SUMMARY_LOG = path.join(LOGS_DIR, 'cycle-summary.jsonl');
const SCRAPER_PERFORMANCE_LOG = path.join(LOGS_DIR, 'scraper-performance.jsonl');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Log line change to JSONL file
 */
function logLineChange(change) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventId: change.eventId,
      book: change.book,
      marketType: change.marketType,
      side: change.side,
      oldLine: change.oldLine,
      newLine: change.line,
      oldPrice: change.oldPrice,
      newPrice: change.price,
      changeType: change.changeType
    };
    
    const line = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(LINE_CHANGES_LOG, line, 'utf8');
  } catch (error) {
    console.error('Error logging line change:', error.message);
  }
}

/**
 * Log arbitrage opportunity to JSONL file
 */
function logArbitrageOpportunity(opportunity) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventId: opportunity.eventId,
      marketType: opportunity.marketType,
      profitMargin: opportunity.profitMargin,
      expectedProfit: opportunity.expectedProfit,
      totalStake: opportunity.totalStake,
      bookA: opportunity.bookA,
      bookB: opportunity.bookB,
      sideA: opportunity.sideA,
      sideB: opportunity.sideB,
      priceA: opportunity.priceA,
      priceB: opportunity.priceB,
      lineA: opportunity.lineA,
      lineB: opportunity.lineB,
      stakeA: opportunity.stakeA,
      stakeB: opportunity.stakeB
    };
    
    const line = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(ARB_OPPORTUNITIES_LOG, line, 'utf8');
  } catch (error) {
    console.error('Error logging arbitrage opportunity:', error.message);
  }
}

/**
 * Log error to JSONL file
 */
function logError(error, context = '') {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack,
      name: error.name
    };
    
    const line = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(ERRORS_LOG, line, 'utf8');
  } catch (err) {
    console.error('Error logging error:', err.message);
  }
}

/**
 * Log cycle summary to JSONL file
 */
function logCycleSummary(summary) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...summary
    };
    
    const line = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(CYCLE_SUMMARY_LOG, line, 'utf8');
  } catch (error) {
    console.error('Error logging cycle summary:', error.message);
  }
}

/**
 * Log scraper performance to JSONL file
 */
function logScraperPerformance(performance) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...performance
    };
    
    const line = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(SCRAPER_PERFORMANCE_LOG, line, 'utf8');
  } catch (error) {
    console.error('Error logging scraper performance:', error.message);
  }
}

module.exports = {
  logLineChange,
  logArbitrageOpportunity,
  logError,
  logCycleSummary,
  logScraperPerformance
};