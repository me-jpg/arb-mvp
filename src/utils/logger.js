// src/utils/logger.js
// Structured logging to JSONL files

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Append JSON line to a JSONL file
   */
  appendJsonLine(filename, data) {
    const filepath = path.join(this.logsDir, filename);
    const line = JSON.stringify(data) + '\n';
    
    try {
      fs.appendFileSync(filepath, line, 'utf8');
    } catch (error) {
      console.error(`Failed to write to ${filename}:`, error.message);
    }
  }

  /**
   * Log cycle summary
   */
  logCycleSummary(cycleData) {
    this.appendJsonLine('cycle-summary.jsonl', {
      cycle: cycleData.cycle,
      timestamp: cycleData.timestamp || new Date().toISOString(),
      books: cycleData.books,
      matchedEvents: cycleData.matchedEvents,
      marketsCompared: cycleData.marketsCompared,
      edges: cycleData.edges,
      arbitragesFound: cycleData.arbitragesFound || 0,
      cycleDurationMs: cycleData.cycleDurationMs
    });
  }

  /**
   * Log scraper performance
   */
  logScraperPerformance(scraperData) {
    this.appendJsonLine('scraper-performance.jsonl', {
      timestamp: scraperData.timestamp || new Date().toISOString(),
      cycle: scraperData.cycle,
      book: scraperData.book,
      startTime: scraperData.startTime,
      endTime: scraperData.endTime,
      durationMs: scraperData.durationMs,
      games: scraperData.games,
      markets: scraperData.markets,
      success: scraperData.success,
      retryCount: scraperData.retryCount || 0,
      error: scraperData.error || null
    });
  }

  /**
   * Log line change
   */
  logLineChange(changeData) {
    this.appendJsonLine('line-changes.jsonl', {
      timestamp: changeData.timestamp || new Date().toISOString(),
      eventId: changeData.eventId,
      book: changeData.book,
      marketType: changeData.marketType,
      side: changeData.side,
      oldLine: changeData.oldLine,
      newLine: changeData.newLine,
      oldPrice: changeData.oldPrice,
      newPrice: changeData.newPrice,
      changeType: changeData.changeType
    });
  }

  /**
   * Log error
   */
  logError(errorData) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${errorData.book || 'SYSTEM'}] [CYCLE ${errorData.cycle || 'N/A'}] ${errorData.message}\n${errorData.stack || ''}\n\n`;
    
    const filepath = path.join(this.logsDir, 'errors.log');
    
    try {
      fs.appendFileSync(filepath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write error log:', error.message);
    }
  }
}

module.exports = new Logger();