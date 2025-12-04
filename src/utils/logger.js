// src/utils/logger.js
// Simple JSONL logger used across the system

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.cwd(), 'logs');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function appendJsonLine(filename, payload) {
  try {
    ensureLogsDir();
    const filepath = path.join(LOGS_DIR, filename);
    const line = JSON.stringify(payload) + '\n';
    fs.appendFileSync(filepath, line, 'utf8');
  } catch (err) {
    // Last-ditch logging to stderr – never throw from logger
    console.error(`Logger error writing to ${filename}:`, err.message);
  }
}

function withTimestamp(data) {
  return {
    timestamp: new Date().toISOString(),
    ...data,
  };
}

/**
 * Log a single line change event.
 * Expected shape (flexible):
 *  {
 *    eventId,
 *    book,
 *    marketType,
 *    side,
 *    oldLine,
 *    newLine,
 *    oldPrice,
 *    newPrice,
 *    changeType
 *  }
 */
function logLineChange(change) {
  if (!change) return;
  appendJsonLine('line-changes.jsonl', withTimestamp(change));
}

/**
 * Log an arbitrage opportunity.
 * Expected shape (flexible, HF or Phase 1):
 *  {
 *    eventId,
 *    marketType,
 *    line,
 *    bookA,
 *    bookB,
 *    priceA,
 *    priceB,
 *    edgePercent,
 *    isArbitrage,
 *    ...extra
 *  }
 */
function logArbitrage(arbData) {
  if (!arbData) return;
  appendJsonLine('arbitrage-opportunities.jsonl', withTimestamp(arbData));
}

/**
 * Log a generic error in a structured way.
 */
function logError(context, error) {
  const payload = {
    context,
    message: error && error.message ? error.message : String(error),
    stack: error && error.stack ? error.stack : undefined,
  };
  appendJsonLine('errors.log', withTimestamp(payload));
}

/**
 * Log a cycle summary (main engine or HF tracker).
 * Example fields:
 *  { cycleNumber, oddsCount, changesCount, arbCount, durationMs, source }
 */
function logCycleSummary(summary) {
  if (!summary) return;
  appendJsonLine('cycle-summary.jsonl', withTimestamp(summary));
}

/**
 * Log per-scraper performance metrics.
 * Example fields:
 *  { book, cycleNumber, durationMs, success, errorMessage }
 */
function logScraperPerformance(metrics) {
  if (!metrics) return;
  appendJsonLine('scraper-performance.jsonl', withTimestamp(metrics));
}

module.exports = {
  logLineChange,
  logArbitrage,
  logError,
  logCycleSummary,
  logScraperPerformance,
};
