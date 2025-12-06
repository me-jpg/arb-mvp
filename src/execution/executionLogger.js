// src/execution/executionLogger.js
// Append execution events to JSONL

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs', 'execution');
const LOG_FILE = path.join(LOG_DIR, 'execution-events.jsonl');

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function logExecutionEvent(event) {
  if (!event) return;
  try {
    ensureDir();
    const line = JSON.stringify(event) + '\n';
    fs.appendFile(LOG_FILE, line, 'utf8', (err) => {
      if (err) console.error('[executionLogger] write failed', err.message);
    });
  } catch (err) {
    console.error('[executionLogger] error', err.message);
  }
}

module.exports = {
  logExecutionEvent,
  LOG_FILE
};

