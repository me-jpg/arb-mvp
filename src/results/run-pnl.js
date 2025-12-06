// src/results/run-pnl.js
// CLI to compute realized P&L from signals + offline results

const fs = require('fs');
const path = require('path');
const { loadSignals } = require('../signals/signalLoader');
const { loadResults } = require('./resultsLoader');
const { simulatePnL } = require('./pnlSimulator');

function parseArgs(argv) {
  const opts = {
    signals: path.join(process.cwd(), 'logs', 'signals.jsonl'),
    results: path.join(process.cwd(), 'results'),
    limit: 1000,
    verbose: false
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--signals=')) opts.signals = arg.split('=')[1];
    else if (arg.startsWith('--results=')) opts.results = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || opts.limit;
    else if (arg === '--verbose') opts.verbose = true;
  }
  return opts;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function printSummary(summary) {
  console.log('=== REALIZED P&L ===');
  console.log(`Signals evaluated: ${summary.evaluatedSignals} (missing results: ${summary.missingResults})`);
  console.log(`Total stake: $${summary.totalStake.toFixed(2)}`);
  console.log(`Realized profit: $${summary.realizedProfit.toFixed(2)}`);
  console.log(`Expected value (EV): $${summary.expectedValue.toFixed(2)}`);
  console.log(`Hit rate: ${(summary.hitRate * 100).toFixed(1)}% | Pushes: ${summary.pushCount}`);

  const bookEntries = Object.entries(summary.breakdownByBook);
  if (bookEntries.length) {
    console.log('\nPer-book:');
    bookEntries.forEach(([book, data]) => {
      console.log(`  ${book}: stake $${data.totalStake.toFixed(2)}, profit $${data.realizedProfit.toFixed(2)}, count ${data.signalCount}`);
    });
  }

  const typeEntries = Object.entries(summary.breakdownByType);
  if (typeEntries.length) {
    console.log('\nPer-type:');
    typeEntries.forEach(([type, data]) => {
      console.log(`  ${type}: stake $${data.totalStake.toFixed(2)}, profit $${data.realizedProfit.toFixed(2)}, count ${data.signalCount}`);
    });
  }
}

function writeReport(summary) {
  const dir = path.join(process.cwd(), 'logs', 'pnl');
  ensureDir(dir);
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...summary }) + '\n';
  fs.appendFileSync(path.join(dir, 'pnl-report.jsonl'), line, 'utf8');
}

function main() {
  const opts = parseArgs(process.argv);
  const signals = loadSignals({ filepath: opts.signals, limit: opts.limit });
  const results = loadResults({ resultsPath: opts.results });

  if (!signals.length) {
    console.log(`No signals loaded from ${opts.signals}`);
    return;
  }
  if (!results.size) {
    console.log(`No results found in ${opts.results}`);
    return;
  }

  if (opts.verbose) {
    console.log(`Loaded ${signals.length} signals from ${opts.signals}`);
    console.log(`Loaded ${results.size} results from ${opts.results}`);
  }

  const summary = simulatePnL(signals, results);
  printSummary(summary);
  writeReport(summary);
}

main();

