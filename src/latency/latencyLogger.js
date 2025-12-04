// src/latency/latencyLogger.js
// Logs latency metrics and stale lines to JSONL files
// FIXED: Non-blocking async I/O, ensureLogsDir called once at module init

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.cwd(), 'logs');
const LATENCY_LOG = path.join(LOGS_DIR, 'latency-metrics.jsonl');
const STALE_LOG = path.join(LOGS_DIR, 'stale-lines.jsonl');

// FIXED: Ensure logs directory exists ONCE at module load, not on every write
let logsDirExists = false;

function ensureLogsDirOnce() {
  if (logsDirExists) return;
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    logsDirExists = true;
  } catch (err) {
    console.error('Failed to create logs directory:', err.message);
  }
}

// Call once at module load
ensureLogsDirOnce();

/**
 * FIXED: Async file append - does not block event loop
 * Fire-and-forget with error logging
 */
function appendJsonLineAsync(filepath, data) {
  try {
    const line = JSON.stringify(data) + '\n';
    // Use callback-based appendFile for non-blocking I/O
    fs.appendFile(filepath, line, 'utf8', (err) => {
      if (err) {
        console.error(`Async write error to ${path.basename(filepath)}:`, err.message);
      }
    });
  } catch (err) {
    // JSON.stringify can throw on circular refs
    console.error(`JSON stringify error:`, err.message);
  }
}

/**
 * Log a single latency metric row
 * @param {Object} metric - Latency metric object
 */
function logLatencyMetric(metric) {
  if (!metric) return;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    book: metric.book,
    totalWindows: metric.totalWindows,
    windowsWithChange: metric.windowsWithChange,
    avgDelayMsVsFastest: metric.avgDelayMsVsFastest,
    fractionFirstToMove: metric.fractionFirstToMove,
    fractionLastToMove: metric.fractionLastToMove,
    marketBreakdown: metric.marketBreakdown || {}
  };
  
  appendJsonLineAsync(LATENCY_LOG, logEntry);
}

/**
 * Log a single stale line event
 * @param {Object} staleLine - Stale line object
 */
function logStaleLine(staleLine) {
  if (!staleLine) return;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventId: staleLine.eventId,
    marketType: staleLine.marketType,
    side: staleLine.side,
    staleBook: staleLine.staleBook || staleLine.book,
    referenceBook: staleLine.referenceBook,
    staleDurationMs: staleLine.staleDurationMs || staleLine.stalenessMs,
    staleReason: staleLine.staleReason || 'price_unchanged',
    staleStartedAt: staleLine.staleStartedAt,
    staleDetectedAt: staleLine.staleDetectedAt
  };
  
  appendJsonLineAsync(STALE_LOG, logEntry);
}

/**
 * Log a summary of latency analysis cycle
 * @param {Object} summary - { latencyMetrics, staleLines, cycleNumber, durationMs }
 */
function logLatencySummary(summary) {
  if (!summary) return;
  
  const { latencyMetrics = [], staleLines = [] } = summary;
  
  // Log each metric
  for (const metric of latencyMetrics) {
    logLatencyMetric(metric);
  }
  
  // Log each stale line
  for (const staleLine of staleLines) {
    logStaleLine(staleLine);
  }
}

module.exports = {
  logLatencyMetric,
  logStaleLine,
  logLatencySummary
};
