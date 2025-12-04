// src/signals/signalLoader.js
// Shared loader for signals from JSONL files

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.cwd(), 'logs');
const SIGNALS_LOG = path.join(LOGS_DIR, 'signals.jsonl');

/**
 * Load signals from JSONL file
 * @param {Object} options - { limit, book, type, since }
 * @returns {Array} Array of signal objects
 */
function loadSignals(options = {}) {
  const {
    limit = 1000,
    book = null,
    type = null,
    since = null,
    filepath = SIGNALS_LOG
  } = options;

  if (!fs.existsSync(filepath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    // Take last N lines
    const lastLines = lines.slice(-limit);
    
    // Parse JSON, skip malformed lines
    let signals = [];
    for (const line of lastLines) {
      try {
        const obj = JSON.parse(line);
        if (obj && obj.id && obj.type) {
          signals.push(obj);
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
    
    // Apply filters
    if (book) {
      signals = signals.filter(s => s.primaryBook === book);
    }
    
    if (type) {
      signals = signals.filter(s => s.type === type);
    }
    
    if (since) {
      const sinceTime = new Date(since).getTime();
      if (!isNaN(sinceTime)) {
        signals = signals.filter(s => {
          const createdAt = new Date(s.createdAt).getTime();
          return !isNaN(createdAt) && createdAt >= sinceTime;
        });
      }
    }
    
    return signals;
  } catch (err) {
    console.error(`Error loading signals from ${filepath}:`, err.message);
    return [];
  }
}

/**
 * Get the default signals log path
 */
function getSignalsLogPath() {
  return SIGNALS_LOG;
}

module.exports = {
  loadSignals,
  getSignalsLogPath
};

