#!/usr/bin/env node
// src/signals/run-signal-analysis.js
// CLI script for offline signal analysis from JSONL logs

const fs = require('fs');
const path = require('path');
const { generateSignalsFromLatency } = require('./signalGenerator');
const { simulateSignals, formatSimulationResults } = require('./paperTrader');
const { logSignals, getSignalsLogPath } = require('./signalLogger');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const LOGS_DIR = path.join(process.cwd(), 'logs');
const LATENCY_LOG = path.join(LOGS_DIR, 'latency-metrics.jsonl');
const STALE_LOG = path.join(LOGS_DIR, 'stale-lines.jsonl');

const DEFAULT_LIMIT = 200;
const DEFAULT_STAKE = 50;
const DEFAULT_MIN_STALE_MS = 3000;
const DEFAULT_MIN_SPEED_SCORE = 0.1;

// ─────────────────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: DEFAULT_LIMIT,
    stake: DEFAULT_STAKE,
    minStaleDurationMs: DEFAULT_MIN_STALE_MS,
    minSpeedScore: DEFAULT_MIN_SPEED_SCORE,
    verbose: false
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10) || DEFAULT_LIMIT;
    } else if (arg.startsWith('--stake=')) {
      options.stake = parseInt(arg.split('=')[1], 10) || DEFAULT_STAKE;
    } else if (arg.startsWith('--min-stale=')) {
      options.minStaleDurationMs = parseInt(arg.split('=')[1], 10) || DEFAULT_MIN_STALE_MS;
    } else if (arg.startsWith('--min-speed=')) {
      options.minSpeedScore = parseFloat(arg.split('=')[1]) || DEFAULT_MIN_SPEED_SCORE;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Signal Analysis - Generate and simulate signals from latency logs

Usage: node src/signals/run-signal-analysis.js [options]

Options:
  --limit=N         Number of log rows to analyze (default: ${DEFAULT_LIMIT})
  --stake=N         Stake per signal in dollars (default: ${DEFAULT_STAKE})
  --min-stale=N     Minimum stale duration in ms (default: ${DEFAULT_MIN_STALE_MS})
  --min-speed=N     Minimum speed score for primary book (default: ${DEFAULT_MIN_SPEED_SCORE})
  --verbose, -v     Show detailed signal information
  --help, -h        Show this help message

Examples:
  npm run signals:analyze
  npm run signals:analyze -- --limit=500 --stake=100
  npm run signals:analyze -- --verbose
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// JSONL Reading
// ─────────────────────────────────────────────────────────────────────────────

function readLastNLines(filepath, n) {
  if (!fs.existsSync(filepath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    // Take last N lines
    const lastLines = lines.slice(-n);
    
    // Parse JSON, skip malformed lines
    const parsed = [];
    for (const line of lastLines) {
      try {
        parsed.push(JSON.parse(line));
      } catch (e) {
        // Skip malformed JSON
      }
    }
    
    return parsed;
  } catch (err) {
    console.error(`Error reading ${filepath}:`, err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const options = parseArgs();

  console.log(`
======================================================================
📊 SIGNAL ANALYSIS
======================================================================
Reading from: ${LOGS_DIR}
Limit: ${options.limit} rows per file
Stake per signal: $${options.stake}
Min stale duration: ${options.minStaleDurationMs}ms
Min speed score: ${options.minSpeedScore}
======================================================================
`);

  // Read log files
  const latencyMetrics = readLastNLines(LATENCY_LOG, options.limit);
  const staleLines = readLastNLines(STALE_LOG, options.limit);

  console.log(`📈 Latency metrics loaded: ${latencyMetrics.length}`);
  console.log(`⚠️  Stale line events loaded: ${staleLines.length}`);

  if (staleLines.length === 0) {
    console.log(`
⚠️  No stale line data found.

To generate stale line data:
1. Run the HF tracker: npm run hf:run
2. Let it collect data for 5-10 minutes during live games
3. Run the latency analyzer: npm run latency:once
4. Re-run this analysis: npm run signals:analyze
`);
    return;
  }

  // Generate signals
  const signals = generateSignalsFromLatency(latencyMetrics, staleLines, {
    minStaleDurationMs: options.minStaleDurationMs,
    minSpeedScore: options.minSpeedScore
  });

  console.log(`\n🎯 Signals generated: ${signals.length}`);

  if (signals.length === 0) {
    console.log(`
No signals met the criteria. Try:
  - Lowering --min-stale (e.g., --min-stale=1000)
  - Lowering --min-speed (e.g., --min-speed=0)
  - Collecting more data during live games
`);
    return;
  }

  // Persist signals to JSONL before simulation
  const loggedCount = logSignals(signals);
  console.log(`💾 Signals persisted: ${loggedCount} → ${getSignalsLogPath()}`);


  // Verbose: show individual signals
  if (options.verbose && signals.length > 0) {
    console.log('\n─── Individual Signals ───');
    for (const sig of signals.slice(0, 20)) { // Limit to first 20
      console.log(`  ${sig.type} | ${sig.eventId.slice(0, 30)}... | ${sig.primaryBook} vs ${sig.referenceBook} | edge: ${(sig.edgeEstimate * 100).toFixed(2)}%`);
    }
    if (signals.length > 20) {
      console.log(`  ... and ${signals.length - 20} more`);
    }
  }

  // Simulate
  const simResults = simulateSignals(signals, {
    stakePerSignal: options.stake
  });

  // Print results
  console.log(`
======================================================================
📈 SIMULATION RESULTS
======================================================================
${formatSimulationResults(simResults)}
======================================================================

💡 Note: This is hypothetical expected value based on edge estimates.
   Actual results would depend on real market outcomes.
`);

  // Summary by book
  const bookStats = {};
  for (const sig of signals) {
    const book = sig.primaryBook;
    if (!bookStats[book]) {
      bookStats[book] = { count: 0, totalEdge: 0 };
    }
    bookStats[book].count++;
    bookStats[book].totalEdge += sig.edgeEstimate;
  }

  if (Object.keys(bookStats).length > 1) {
    console.log('📚 Signals by primary book:');
    for (const [book, stats] of Object.entries(bookStats)) {
      const avgEdge = stats.totalEdge / stats.count;
      console.log(`   ${book}: ${stats.count} signals, avg edge ${(avgEdge * 100).toFixed(2)}%`);
    }
    console.log('');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

main();

