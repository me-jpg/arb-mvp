#!/usr/bin/env node
// src/signals/run-strategy-simulation.js
// CLI script to run strategy simulation on historical signals

const fs = require('fs');
const path = require('path');
const { applyStrategy, defaultStrategyConfig } = require('./strategyEngine');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const LOGS_DIR = path.join(process.cwd(), 'logs');
const SIGNALS_LOG = path.join(LOGS_DIR, 'signals.jsonl');

const DEFAULT_LIMIT = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: DEFAULT_LIMIT,
    book: null,           // Pre-filter by book
    type: null,           // Pre-filter by type
    verbose: false,
    // Strategy config overrides
    minEdge: null,
    maxEdge: null,
    flatStake: null,
    stakeMode: null,
    maxPerEvent: null,
    maxTotalPerBook: null,
    excludeBooks: []
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10) || DEFAULT_LIMIT;
    } else if (arg.startsWith('--book=')) {
      options.book = arg.split('=')[1];
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1];
    } else if (arg.startsWith('--min-edge=')) {
      options.minEdge = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--max-edge=')) {
      options.maxEdge = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--flat-stake=')) {
      options.flatStake = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--stake-mode=')) {
      options.stakeMode = arg.split('=')[1];
    } else if (arg.startsWith('--max-per-event=')) {
      options.maxPerEvent = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--max-total-per-book=')) {
      options.maxTotalPerBook = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--exclude-book=')) {
      options.excludeBooks.push(arg.split('=')[1]);
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
Strategy Simulation - Apply strategy rules to historical signals

Usage: node src/signals/run-strategy-simulation.js [options]

Data options:
  --limit=N              Max signals to load (default: ${DEFAULT_LIMIT})
  --book=NAME            Pre-filter by primaryBook before strategy
  --type=TYPE            Pre-filter by signal type before strategy

Strategy options:
  --min-edge=X           Minimum edge (default: ${defaultStrategyConfig.minEdge})
  --max-edge=X           Maximum edge (default: ${defaultStrategyConfig.maxEdge})
  --flat-stake=X         Base stake per signal (default: ${defaultStrategyConfig.flatStake})
  --stake-mode=MODE      'flat' or 'edge_scaled' (default: ${defaultStrategyConfig.stakeMode})
  --max-per-event=N      Max signals per event (default: ${defaultStrategyConfig.maxSignalsPerEvent})
  --max-total-per-book=X Max total stake per book (default: ${defaultStrategyConfig.maxTotalStakePerBook})
  --exclude-book=NAME    Exclude a book (can use multiple times)

Output:
  --verbose, -v          Show sample selected signals
  --help, -h             Show this help message

Examples:
  npm run signals:strategy
  npm run signals:strategy -- --min-edge=0.03 --stake-mode=edge_scaled
  npm run signals:strategy -- --exclude-book=espnbet --max-per-event=1 --verbose
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// JSONL Reading
// ─────────────────────────────────────────────────────────────────────────────

function readSignalsFromFile(filepath, limit) {
  if (!fs.existsSync(filepath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    // Take last N lines
    const lastLines = lines.slice(-limit);
    
    // Parse JSON, skip malformed lines
    const signals = [];
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
    
    return signals;
  } catch (err) {
    console.error(`Error reading ${filepath}:`, err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pad(str, len, align = 'left') {
  str = String(str);
  if (align === 'right') {
    return str.padStart(len);
  }
  return str.padEnd(len);
}

function money(val) {
  return '$' + val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pct(val) {
  return (val * 100).toFixed(1) + '%';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const options = parseArgs();

  console.log(`
======================================================================
🎯 STRATEGY SIMULATION
======================================================================
Reading from: ${SIGNALS_LOG}
Limit: ${options.limit}
======================================================================
`);

  // Load signals
  let signals = readSignalsFromFile(SIGNALS_LOG, options.limit);
  
  if (signals.length === 0) {
    console.log(`⚠️  No signals found in ${SIGNALS_LOG}

To generate signals:
1. Run the HF tracker: npm run hf:run
2. Run the latency analyzer: npm run latency:once
3. Run signal analysis: npm run signals:analyze
4. Re-run this simulation: npm run signals:strategy
`);
    return;
  }

  console.log(`📥 Signals loaded: ${signals.length}`);

  // Pre-filter by book/type if specified
  const preFilteredCount = signals.length;
  if (options.book) {
    signals = signals.filter(s => s.primaryBook === options.book);
  }
  if (options.type) {
    signals = signals.filter(s => s.type === options.type);
  }
  
  if (signals.length < preFilteredCount) {
    console.log(`📊 Signals after pre-filter: ${signals.length}`);
  }

  if (signals.length === 0) {
    console.log(`⚠️  No signals match the pre-filter criteria.`);
    return;
  }

  // Build strategy config from CLI options
  const strategyConfig = {};
  if (options.minEdge !== null) strategyConfig.minEdge = options.minEdge;
  if (options.maxEdge !== null) strategyConfig.maxEdge = options.maxEdge;
  if (options.flatStake !== null) strategyConfig.flatStake = options.flatStake;
  if (options.stakeMode !== null) strategyConfig.stakeMode = options.stakeMode;
  if (options.maxPerEvent !== null) strategyConfig.maxSignalsPerEvent = options.maxPerEvent;
  if (options.maxTotalPerBook !== null) strategyConfig.maxTotalStakePerBook = options.maxTotalPerBook;
  if (options.excludeBooks.length > 0) strategyConfig.excludedBooks = options.excludeBooks;

  // Apply strategy
  const result = applyStrategy(signals, strategyConfig);

  // Print results
  console.log(`
======================================================================
📊 STRATEGY RESULTS
======================================================================
Signals selected:    ${result.selectedSignals.length}
Signals rejected:    ${result.rejectedSignalsCount}

Total stake:         ${money(result.totalStake)}
Avg edge (selected): ${pct(result.avgEdgeEstimate)}
Expected P&L (EV):   ${result.expectedValue >= 0 ? '+' : ''}${money(result.expectedValue)}
`);

  // Strategy config used
  console.log(`Strategy config used:
  minEdge: ${pct(result.strategyConfig.minEdge)}
  maxEdge: ${pct(result.strategyConfig.maxEdge)}
  stakeMode: ${result.strategyConfig.stakeMode}
  flatStake: ${money(result.strategyConfig.flatStake)}
  maxSignalsPerEvent: ${result.strategyConfig.maxSignalsPerEvent}
  maxTotalStakePerBook: ${money(result.strategyConfig.maxTotalStakePerBook)}
  excludedBooks: ${result.strategyConfig.excludedBooks.length > 0 ? result.strategyConfig.excludedBooks.join(', ') : 'none'}
`);

  // Per-book exposure
  const bookEntries = Object.entries(result.exposureByBook);
  if (bookEntries.length > 0) {
    console.log(`----------------------------------------------------------------------
Per-book exposure:
${pad('Book', 14)} ${pad('Signals', 10, 'right')} ${pad('Total Stake', 14, 'right')}
----------------------------------------------------------------------`);
    
    // Sort by stake descending
    bookEntries.sort((a, b) => b[1].totalStake - a[1].totalStake);
    for (const [book, stats] of bookEntries) {
      console.log(`${pad(book, 14)} ${pad(stats.signalCount, 10, 'right')} ${pad(money(stats.totalStake), 14, 'right')}`);
    }
    console.log('');
  }

  // Per-type exposure
  const typeEntries = Object.entries(result.exposureByType);
  if (typeEntries.length > 0) {
    console.log(`----------------------------------------------------------------------
Per-type exposure:
${pad('Type', 18)} ${pad('Signals', 10, 'right')} ${pad('Total Stake', 14, 'right')}
----------------------------------------------------------------------`);
    
    typeEntries.sort((a, b) => b[1].totalStake - a[1].totalStake);
    for (const [type, stats] of typeEntries) {
      console.log(`${pad(type, 18)} ${pad(stats.signalCount, 10, 'right')} ${pad(money(stats.totalStake), 14, 'right')}`);
    }
    console.log('');
  }

  // Verbose: show sample signals
  if (options.verbose && result.selectedSignals.length > 0) {
    const samples = result.selectedSignals.slice(0, 5);
    console.log(`======================================================================
Sample selected signals (${samples.length} of ${result.selectedSignals.length}):
======================================================================`);
    
    for (const sig of samples) {
      console.log(`  ${sig.type} | ${(sig.eventId || '').slice(0, 35)}...`);
      console.log(`    Book: ${sig.primaryBook} vs ${sig.referenceBook}`);
      console.log(`    Edge: ${pct(sig.edgeEstimate)} | Stake: ${money(sig.strategyStake)}`);
      console.log('');
    }
  }

  if (result.selectedSignals.length === 0) {
    console.log(`
⚠️  No signals passed the strategy filters.

Try adjusting:
  --min-edge=X (lower the minimum)
  --max-per-event=N (allow more per event)
  --max-total-per-book=X (increase book cap)
`);
  }

  console.log(`💡 Tip: Use --verbose to see sample selected signals.
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

main();

