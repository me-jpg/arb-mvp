// src/latency/latencyLogger.js
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs');
const LATENCY_LOG = path.join(LOGS_DIR, 'latency-metrics.jsonl');
const STALE_LOG = path.join(LOGS_DIR, 'stale-lines.jsonl');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Log latency metrics to JSONL file
 * @param {Object} metric - Latency metric object
 */
function logLatencyMetric(metric) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      book: metric.book,
      firstMoverFraction: metric.firstMoverFraction,
      avgDelayMs: metric.avgDelayMs,
      totalWindows: metric.totalWindows,
      marketBreakdown: metric.marketBreakdown || {}
    };
    
    const line = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(LATENCY_LOG, line, 'utf8');
  } catch (error) {
    console.error('Error logging latency metric:', error.message);
  }
}

/**
 * Log stale lines to JSONL file
 * @param {Object} staleLine - Stale line object
 */
function logStaleLine(staleLine) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      book: staleLine.book,
      eventId: staleLine.eventId,
      marketType: staleLine.marketType,
      side: staleLine.side,
      stalenessMs: staleLine.stalenessMs,
      lastUpdate: staleLine.lastUpdate
    };
    
    const line = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(STALE_LOG, line, 'utf8');
  } catch (error) {
    console.error('Error logging stale line:', error.message);
  }
}

module.exports = {
  logLatencyMetric,
  logStaleLine
};