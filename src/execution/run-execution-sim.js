// src/execution/run-execution-sim.js
// CLI to simulate execution flow on saved signals

const path = require('path');
const { loadSignals } = require('../signals/signalLoader');
const { runExecutionSimulation } = require('./executionEngine');

function parseArgs(argv) {
  const opts = {
    signalsPath: path.join(process.cwd(), 'logs', 'signals.jsonl'),
    limit: 200,
    book: null,
    type: null,
    minEdge: null,
    verbose: false
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--signals=')) opts.signalsPath = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || opts.limit;
    else if (arg.startsWith('--book=')) opts.book = arg.split('=')[1];
    else if (arg.startsWith('--type=')) opts.type = arg.split('=')[1];
    else if (arg.startsWith('--minEdge=')) opts.minEdge = Number(arg.split('=')[1]);
    else if (arg === '--verbose') opts.verbose = true;
  }
  return opts;
}

function filterSignals(signals, opts) {
  let out = signals.slice(-opts.limit);
  if (opts.book) out = out.filter(s => s.primaryBook === opts.book);
  if (opts.type) out = out.filter(s => s.type === opts.type);
  if (opts.minEdge !== null && !Number.isNaN(opts.minEdge)) {
    out = out.filter(s => Number(s.edgeEstimate) >= opts.minEdge);
  }
  return out;
}

function printSummary(summary, countIn) {
  console.log('=== EXECUTION SIMULATION ===');
  console.log(`Signals input: ${countIn}`);
  console.log(`Orders attempted: ${summary.totalOrders}`);
  console.log(`Allowed: ${summary.allowedCount} | Blocked: ${summary.blockedCount}`);
  console.log(`Filled: ${summary.filledCount} | Partial: ${summary.partialCount} | Rejected: ${summary.rejectedCount}`);
  console.log(`Simulated exposure (stake sum): $${summary.simulatedExposure.toFixed(2)}`);
}

function main() {
  const opts = parseArgs(process.argv);
  const signals = loadSignals({ filepath: opts.signalsPath, limit: opts.limit });
  if (!signals.length) {
    console.log(`No signals found at ${opts.signalsPath}`);
    return;
  }

  const filtered = filterSignals(signals, opts);
  if (opts.verbose) {
    console.log(`Loaded ${signals.length} signals, using ${filtered.length} after filters`);
  }

  const summary = runExecutionSimulation(filtered, { strategyContext: {} });
  printSummary(summary, filtered.length);
}

main();

