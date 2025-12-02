// src/latency/latencyLogger.js
const fs = require('fs');
const path = require('path');

class LatencyLogger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  appendJsonLine(filename, data) {
    const filepath = path.join(this.logsDir, filename);
    const line = JSON.stringify(data) + '\n';
    
    try {
      fs.appendFileSync(filepath, line, 'utf8');
    } catch (error) {
      console.error(`Failed to write to ${filename}:`, error.message);
    }
  }

  logLatencyMetrics(metrics) {
    metrics.forEach(metric => {
      this.appendJsonLine('latency-metrics.jsonl', {
        timestamp: new Date().toISOString(),
        ...metric
      });
    });
  }

  logStaleLines(staleLines) {
    staleLines.forEach(staleLine => {
      this.appendJsonLine('stale-lines.jsonl', staleLine);
    });
  }
}

module.exports = new LatencyLogger();