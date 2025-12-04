#!/usr/bin/env node
// src/diagnostics/run-system-check.js
// End-to-end system health check for ArbMVP

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const LOGS_DIR = path.join(process.cwd(), 'logs');
const LATENCY_METRICS_FILE = path.join(LOGS_DIR, 'latency-metrics.jsonl');
const STALE_LINES_FILE = path.join(LOGS_DIR, 'stale-lines.jsonl');
const SIGNALS_FILE = path.join(LOGS_DIR, 'signals.jsonl');

// Track results
const results = {
  dbConnection: { status: 'PENDING', message: '' },
  logsDir: { status: 'PENDING', message: '' },
  latencyLogs: { status: 'PENDING', message: '', metricsCount: 0, staleCount: 0 },
  signalsLog: { status: 'PENDING', message: '', count: 0 },
  signalGeneration: { status: 'PENDING', message: '', count: 0 },
  paperTrader: { status: 'PENDING', message: '', ev: 0 },
  strategyEngine: { status: 'PENDING', message: '', selected: 0, stake: 0 }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readJsonlFile(filepath, limit = 100) {
  if (!fs.existsSync(filepath)) {
    return { exists: false, rows: [] };
  }
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    const lastLines = lines.slice(-limit);
    const rows = [];
    for (const line of lastLines) {
      try {
        rows.push(JSON.parse(line));
      } catch (e) {
        // Skip malformed
      }
    }
    return { exists: true, rows, totalLines: lines.length };
  } catch (err) {
    return { exists: true, rows: [], error: err.message };
  }
}

function printSection(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function statusIcon(status) {
  switch (status) {
    case 'OK': return '✅';
    case 'WARN': return '⚠️';
    case 'FAIL': return '❌';
    case 'SKIP': return '⏭️';
    default: return '❓';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check: Database Connection
// ─────────────────────────────────────────────────────────────────────────────

async function checkDatabase() {
  printSection('DATABASE CONNECTION');
  
  try {
    const config = require('../../config');
    const db = require('../utils/db');
    
    // Check if DB is enabled
    if (!config.database.enabled) {
      results.dbConnection.status = 'WARN';
      results.dbConnection.message = 'DB disabled in config (DB_ENABLED != true)';
      console.log(`⚠️  DB disabled in config. Set DB_ENABLED=true in .env to enable.`);
      return;
    }
    
    // Try to connect
    await db.connect();
    
    // Simple read-only query
    const result = await db.query('SELECT COUNT(*) as count FROM line_changes');
    const count = result.rows[0]?.count || 0;
    
    results.dbConnection.status = 'OK';
    results.dbConnection.message = `Connected. line_changes rows: ${count}`;
    console.log(`✅ DB connected successfully`);
    console.log(`   line_changes table: ${count} rows`);
    
    // Check other tables exist
    try {
      const eventsResult = await db.query('SELECT COUNT(*) as count FROM events');
      console.log(`   events table: ${eventsResult.rows[0]?.count || 0} rows`);
    } catch (e) {
      console.log(`   events table: not found or error`);
    }
    
    try {
      const edgesResult = await db.query('SELECT COUNT(*) as count FROM edges');
      console.log(`   edges table: ${edgesResult.rows[0]?.count || 0} rows`);
    } catch (e) {
      console.log(`   edges table: not found or error`);
    }

    await db.close();
  } catch (err) {
    results.dbConnection.status = 'FAIL';
    results.dbConnection.message = err.message;
    console.log(`❌ DB connection failed: ${err.message}`);
    console.log(`   Make sure PostgreSQL is running and .env is configured.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check: Logs Directory
// ─────────────────────────────────────────────────────────────────────────────

function checkLogsDirectory() {
  printSection('LOGS DIRECTORY');
  
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      console.log(`📁 Created logs directory: ${LOGS_DIR}`);
    } else {
      console.log(`📁 Logs directory exists: ${LOGS_DIR}`);
    }
    
    // List files
    const files = fs.readdirSync(LOGS_DIR);
    console.log(`   Files: ${files.length > 0 ? files.join(', ') : '(empty)'}`);
    
    results.logsDir.status = 'OK';
    results.logsDir.message = `${files.length} files`;
  } catch (err) {
    results.logsDir.status = 'FAIL';
    results.logsDir.message = err.message;
    console.log(`❌ Logs directory error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check: Latency Logs
// ─────────────────────────────────────────────────────────────────────────────

function checkLatencyLogs() {
  printSection('LATENCY LOGS');
  
  // Check latency-metrics.jsonl
  const metrics = readJsonlFile(LATENCY_METRICS_FILE, 200);
  if (!metrics.exists) {
    console.log(`📭 latency-metrics.jsonl: NOT FOUND`);
  } else if (metrics.error) {
    console.log(`⚠️  latency-metrics.jsonl: ERROR - ${metrics.error}`);
  } else {
    console.log(`📈 latency-metrics.jsonl: ${metrics.totalLines} total rows (loaded ${metrics.rows.length})`);
    results.latencyLogs.metricsCount = metrics.rows.length;
  }
  
  // Check stale-lines.jsonl
  const stale = readJsonlFile(STALE_LINES_FILE, 200);
  if (!stale.exists) {
    console.log(`📭 stale-lines.jsonl: NOT FOUND`);
  } else if (stale.error) {
    console.log(`⚠️  stale-lines.jsonl: ERROR - ${stale.error}`);
  } else {
    console.log(`⚠️  stale-lines.jsonl: ${stale.totalLines} total rows (loaded ${stale.rows.length})`);
    results.latencyLogs.staleCount = stale.rows.length;
  }
  
  if (!metrics.exists && !stale.exists) {
    results.latencyLogs.status = 'WARN';
    results.latencyLogs.message = 'No latency logs found. Run HF tracker + latency analyzer first.';
    console.log(`\n   💡 To generate: npm run hf:run → npm run latency:once`);
  } else {
    results.latencyLogs.status = 'OK';
    results.latencyLogs.message = `${metrics.rows.length} metrics, ${stale.rows.length} stale events`;
  }
  
  return { metrics: metrics.rows, stale: stale.rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check: Signals Log
// ─────────────────────────────────────────────────────────────────────────────

function checkSignalsLog() {
  printSection('SIGNALS LOG');
  
  const signals = readJsonlFile(SIGNALS_FILE, 500);
  if (!signals.exists) {
    results.signalsLog.status = 'WARN';
    results.signalsLog.message = 'No signals.jsonl found';
    console.log(`📭 signals.jsonl: NOT FOUND`);
    console.log(`   💡 To generate: npm run signals:analyze`);
    return [];
  } else if (signals.error) {
    results.signalsLog.status = 'FAIL';
    results.signalsLog.message = signals.error;
    console.log(`❌ signals.jsonl: ERROR - ${signals.error}`);
    return [];
  } else {
    results.signalsLog.status = 'OK';
    results.signalsLog.count = signals.rows.length;
    results.signalsLog.message = `${signals.totalLines} total signals`;
    console.log(`🎯 signals.jsonl: ${signals.totalLines} total signals (loaded ${signals.rows.length})`);
    
    // Type breakdown
    const byType = {};
    for (const sig of signals.rows) {
      const type = sig.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    }
    console.log(`   Types: ${JSON.stringify(byType)}`);
    
    return signals.rows;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check: Signal Generation Pipeline
// ─────────────────────────────────────────────────────────────────────────────

function checkSignalGeneration(latencyMetrics, staleLines) {
  printSection('SIGNAL GENERATION TEST');
  
  if (staleLines.length === 0) {
    results.signalGeneration.status = 'SKIP';
    results.signalGeneration.message = 'No stale lines to process';
    console.log(`⏭️  Skipped: No stale line data available`);
    return [];
  }
  
  try {
    const { generateSignalsFromLatency } = require('../signals/signalGenerator');
    
    const signals = generateSignalsFromLatency(latencyMetrics, staleLines, {
      minStaleDurationMs: 1000, // Lower threshold for testing
      minSpeedScore: -999 // Disable speed filtering for test
    });
    
    results.signalGeneration.status = 'OK';
    results.signalGeneration.count = signals.length;
    results.signalGeneration.message = `Generated ${signals.length} signals from ${staleLines.length} stale events`;
    console.log(`✅ Signal generation: OK`);
    console.log(`   Input: ${latencyMetrics.length} metrics, ${staleLines.length} stale events`);
    console.log(`   Output: ${signals.length} signals generated`);
    
    return signals;
  } catch (err) {
    results.signalGeneration.status = 'FAIL';
    results.signalGeneration.message = err.message;
    console.log(`❌ Signal generation failed: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check: Paper Trader
// ─────────────────────────────────────────────────────────────────────────────

function checkPaperTrader(signals) {
  printSection('PAPER TRADER TEST');
  
  if (signals.length === 0) {
    results.paperTrader.status = 'SKIP';
    results.paperTrader.message = 'No signals to simulate';
    console.log(`⏭️  Skipped: No signals to simulate`);
    return;
  }
  
  try {
    const { simulateSignals } = require('../signals/paperTrader');
    
    const result = simulateSignals(signals, { stakePerSignal: 50 });
    
    results.paperTrader.status = 'OK';
    results.paperTrader.ev = result.expectedValue;
    results.paperTrader.message = `EV: $${result.expectedValue.toFixed(2)}`;
    console.log(`✅ Paper trader: OK`);
    console.log(`   Signals: ${result.signalCount}`);
    console.log(`   Total stake: $${result.totalStake.toFixed(2)}`);
    console.log(`   Avg edge: ${(result.avgEdgeEstimate * 100).toFixed(2)}%`);
    console.log(`   Expected value: $${result.expectedValue.toFixed(2)}`);
  } catch (err) {
    results.paperTrader.status = 'FAIL';
    results.paperTrader.message = err.message;
    console.log(`❌ Paper trader failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check: Strategy Engine
// ─────────────────────────────────────────────────────────────────────────────

function checkStrategyEngine(signals) {
  printSection('STRATEGY ENGINE TEST');
  
  if (signals.length === 0) {
    results.strategyEngine.status = 'SKIP';
    results.strategyEngine.message = 'No signals for strategy';
    console.log(`⏭️  Skipped: No signals for strategy test`);
    return;
  }
  
  try {
    const { applyStrategy } = require('../signals/strategyEngine');
    
    const result = applyStrategy(signals, {
      minEdge: 0.01, // 1% min for testing
      maxEdge: 0.15,
      flatStake: 50,
      stakeMode: 'flat',
      maxSignalsPerEvent: 2,
      maxTotalStakePerBook: 5000
    });
    
    results.strategyEngine.status = 'OK';
    results.strategyEngine.selected = result.selectedSignals.length;
    results.strategyEngine.stake = result.totalStake;
    results.strategyEngine.message = `${result.selectedSignals.length} selected, $${result.totalStake.toFixed(2)} stake`;
    console.log(`✅ Strategy engine: OK`);
    console.log(`   Input signals: ${signals.length}`);
    console.log(`   Selected: ${result.selectedSignals.length}`);
    console.log(`   Rejected: ${result.rejectedSignalsCount}`);
    console.log(`   Total stake: $${result.totalStake.toFixed(2)}`);
    console.log(`   Expected value: $${result.expectedValue.toFixed(2)}`);
  } catch (err) {
    results.strategyEngine.status = 'FAIL';
    results.strategyEngine.message = err.message;
    console.log(`❌ Strategy engine failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check: HF Configuration
// ─────────────────────────────────────────────────────────────────────────────

function showHFConfig() {
  printSection('HF TRACKER CONFIGURATION');
  
  try {
    const config = require('../../config');
    const hf = config.highFrequency;
    
    console.log(`📊 HF Config (theoretical load):`);
    console.log(`   intervalMs:       ${hf.intervalMs} (${hf.intervalMs / 1000}s between cycles)`);
    console.log(`   maxEvents:        ${hf.maxEvents} games per book`);
    console.log(`   markets:          ${hf.markets.join(', ')}`);
    console.log(`   books:            ${hf.books.join(', ')}`);
    console.log(`   minEdgePercent:   ${hf.arbitrageMinEdgePercent}%`);
    console.log(`   debugTimings:     ${hf.debugTimings ? 'ENABLED' : 'disabled'}`);
    
    // Estimate theoretical load
    const numBooks = hf.books.length;
    const numMarkets = hf.markets.length;
    const totalMarketsPerCycle = numBooks * hf.maxEvents * numMarkets * 2; // x2 for both sides
    console.log(`\n   Theoretical markets/cycle: ~${totalMarketsPerCycle}`);
    console.log(`   Scraping is parallel, so cycle time ≈ slowest book.`);
    console.log(`   Typical Puppeteer scrape: 8-15s per book.`);
    
    // Recommendation
    const recommendedInterval = numBooks >= 3 ? 20000 : 15000;
    if (hf.intervalMs < recommendedInterval) {
      console.log(`\n   ⚠️  intervalMs (${hf.intervalMs}) may be too aggressive.`);
      console.log(`   💡 Recommendation: HF_INTERVAL_MS=${recommendedInterval} or higher`);
    } else {
      console.log(`\n   ✅ intervalMs (${hf.intervalMs}) looks reasonable for ${numBooks} books.`);
    }
    
    console.log(`\n   Run: npm run hf:run (with HF_DEBUG_TIMINGS=true for detailed timing)`);
  } catch (err) {
    console.log(`⚠️  Could not read HF config: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Print Summary
// ─────────────────────────────────────────────────────────────────────────────

function printSummary() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  SYSTEM CHECK SUMMARY');
  console.log('═'.repeat(60));
  
  console.log(`\n${statusIcon(results.dbConnection.status)} DB connection:      ${results.dbConnection.status} - ${results.dbConnection.message}`);
  console.log(`${statusIcon(results.logsDir.status)} Logs directory:     ${results.logsDir.status} - ${results.logsDir.message}`);
  console.log(`${statusIcon(results.latencyLogs.status)} Latency logs:       ${results.latencyLogs.status} - ${results.latencyLogs.message}`);
  console.log(`${statusIcon(results.signalsLog.status)} Signals log:        ${results.signalsLog.status} - ${results.signalsLog.message}`);
  console.log(`${statusIcon(results.signalGeneration.status)} Signal generation:  ${results.signalGeneration.status} - ${results.signalGeneration.message}`);
  console.log(`${statusIcon(results.paperTrader.status)} Paper trader:       ${results.paperTrader.status} - ${results.paperTrader.message}`);
  console.log(`${statusIcon(results.strategyEngine.status)} Strategy engine:    ${results.strategyEngine.status} - ${results.strategyEngine.message}`);
  
  // Overall status
  // DB is only critical if enabled and failed
  const criticalFails = Object.keys(results).filter(k => 
    k === 'dbConnection' && results[k].status === 'FAIL' && 
    !results[k].message.includes('disabled')
  );
  const anyFails = Object.keys(results).filter(k => results[k].status === 'FAIL');
  const anyWarns = Object.keys(results).filter(k => results[k].status === 'WARN');
  
  console.log(`\n${'─'.repeat(60)}`);
  
  if (criticalFails.length > 0) {
    console.log(`\n❌ Overall status: CRITICAL - Fix database connection first`);
  } else if (anyFails.length > 0) {
    console.log(`\n⚠️  Overall status: ISSUES FOUND - ${anyFails.length} check(s) failed`);
  } else if (anyWarns.length > 0) {
    console.log(`\n⚠️  Overall status: READY WITH WARNINGS`);
    console.log(`   ${anyWarns.length} warning(s) - likely just missing log data`);
    console.log(`   Run: npm run hf:run → npm run latency:once → npm run signals:analyze`);
  } else {
    console.log(`\n✅ Overall status: READY FOR RESEARCH`);
    console.log(`   All systems operational!`);
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Tests: npm run test:all`);
  console.log(`  Docs:  docs/RESEARCH_PLAYBOOK.md`);
  console.log('═'.repeat(60) + '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           ArbMVP System Health Check                         ║
║           ${new Date().toISOString()}               ║
╚══════════════════════════════════════════════════════════════╝
`);

  // 1. Check database
  await checkDatabase();
  
  // 2. Check logs directory
  checkLogsDirectory();
  
  // 3. Check latency logs
  const { metrics: latencyMetrics, stale: staleLines } = checkLatencyLogs();
  
  // 4. Check signals log
  const existingSignals = checkSignalsLog();
  
  // 5. Test signal generation pipeline
  const generatedSignals = checkSignalGeneration(latencyMetrics, staleLines);
  
  // Use existing signals if generation produced none
  const signalsForTest = generatedSignals.length > 0 ? generatedSignals : existingSignals;
  
  // 6. Test paper trader
  checkPaperTrader(signalsForTest);
  
  // 7. Test strategy engine
  checkStrategyEngine(signalsForTest);
  
  // 8. Show HF configuration
  showHFConfig();
  
  // Print summary
  printSummary();
}

// Run
main().catch(err => {
  console.error('\n❌ System check crashed:', err);
  process.exit(1);
});

