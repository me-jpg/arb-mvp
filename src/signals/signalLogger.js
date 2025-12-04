// src/signals/signalLogger.js
// Logs generated signals to JSONL for offline analysis

const fs = require('fs');
const path = require('path');
const { validateSignal } = require('../utils/shapeValidator');

const LOGS_DIR = path.join(process.cwd(), 'logs');
const SIGNALS_LOG = path.join(LOGS_DIR, 'signals.jsonl');

// Ensure logs directory exists (once at module load)
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
 * Append a single JSON line (non-blocking)
 */
function appendJsonLineAsync(filepath, data) {
  try {
    const line = JSON.stringify(data) + '\n';
    fs.appendFile(filepath, line, 'utf8', (err) => {
      if (err) {
        console.error(`Async write error to ${path.basename(filepath)}:`, err.message);
      }
    });
  } catch (err) {
    console.error(`JSON stringify error:`, err.message);
  }
}

/**
 * Log an array of signals to signals.jsonl
 * @param {Array} signals - Array of Signal objects
 * @returns {number} Number of signals successfully logged
 */
function logSignals(signals) {
  if (!signals || !Array.isArray(signals) || signals.length === 0) {
    return 0;
  }

  let logged = 0;

  for (const signal of signals) {
    // Validate before logging
    if (!validateSignal(signal, 'signalLogger:signal')) {
      // Warning already logged by validator
      continue;
    }

    // Add persistence timestamp if not present
    const logEntry = {
      ...signal,
      persistedAt: new Date().toISOString()
    };

    appendJsonLineAsync(SIGNALS_LOG, logEntry);
    logged++;
  }

  return logged;
}

/**
 * Get the path to the signals log file
 * @returns {string}
 */
function getSignalsLogPath() {
  return SIGNALS_LOG;
}

module.exports = {
  logSignals,
  getSignalsLogPath
};

