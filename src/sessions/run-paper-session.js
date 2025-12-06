// src/sessions/run-paper-session.js
// CLI wrapper for paper session runner

const path = require('path');
const { runPaperSession } = require('./paperSessionRunner');

function parseArgs(argv) {
  const opts = {
    signalsPath: path.join(process.cwd(), 'logs', 'signals.jsonl'),
    resultsPath: path.join(process.cwd(), 'results'),
    limit: 200,
    book: null,
    type: null,
    minEdge: null,
    verbose: false
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--signals=')) opts.signalsPath = arg.split('=')[1];
    else if (arg.startsWith('--results=')) opts.resultsPath = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || opts.limit;
    else if (arg.startsWith('--book=')) opts.book = arg.split('=')[1];
    else if (arg.startsWith('--type=')) opts.type = arg.split('=')[1];
    else if (arg.startsWith('--minEdge=')) opts.minEdge = Number(arg.split('=')[1]);
    else if (arg === '--verbose') opts.verbose = true;
  }
  return opts;
}

function printSummary(summary) {
  console.log('=== PAPER SESSION SUMMARY ===');
  console.log(`Signals: loaded ${summary.signals.loaded} | after filters ${summary.signals.filtered} | used for execution ${summary.signals.usedForExecution}`);
  console.log(`Execution: orders ${summary.execution.ordersAttempted} | allowed ${summary.execution.allowed} | blocked ${summary.execution.blocked} | filled ${summary.execution.filled} | rejected ${summary.execution.rejected}`);
  console.log(`Exposure: $${summary.execution.simulatedExposure.toFixed(2)}`);
  if (summary.pnl.hasResults) {
    console.log(`P&L: stake $${summary.pnl.totalStake.toFixed(2)} | realized $${summary.pnl.realizedProfit.toFixed(2)} | EV $${summary.pnl.expectedValue.toFixed(2)}`);
    console.log(`Hit rate: ${(summary.pnl.hitRate * 100).toFixed(1)}% | Pushes: ${summary.pnl.pushCount}`);
    console.log(`Results source: ${summary.resultsPath}`);
  } else {
    console.log('P&L: results not available (no results files)');
  }
  console.log('Logs:');
  console.log('  execution: logs/execution/execution-events.jsonl');
  console.log('  pnl:        logs/pnl/');
}

function main() {
  const opts = parseArgs(process.argv);
  const summary = runPaperSession(opts);
  printSummary(summary);
}

main();

