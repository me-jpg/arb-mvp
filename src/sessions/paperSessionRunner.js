// src/sessions/paperSessionRunner.js
// Orchestrate: load signals -> optional filter -> strategy pass-through -> execution sim -> P&L

const path = require('path');
const { loadSignals } = require('../signals/signalLoader');
const { runExecutionSimulation } = require('../execution/executionEngine');
const { loadResults } = require('../results/resultsLoader');
const { simulatePnL } = require('../results/pnlSimulator');

function filterSignals(signals, opts) {
  let out = Array.isArray(signals) ? signals.slice(-opts.limit) : [];
  if (opts.book) out = out.filter(s => s.primaryBook === opts.book);
  if (opts.type) out = out.filter(s => s.type === opts.type);
  if (opts.minEdge !== null && opts.minEdge !== undefined && !Number.isNaN(opts.minEdge)) {
    out = out.filter(s => Number(s.edgeEstimate) >= opts.minEdge);
  }
  return out;
}

/**
 * Run a paper session: signals -> execution sim -> P&L
 * @param {Object} options
 */
function runPaperSession(options = {}) {
  const {
    signalsPath = path.join(process.cwd(), 'logs', 'signals.jsonl'),
    resultsPath = path.join(process.cwd(), 'results'),
    limit = 200,
    book = null,
    type = null,
    minEdge = null,
    verbose = false,
    loaders = { loadSignals, loadResults },
    execRunner = runExecutionSimulation,
    pnlRunner = simulatePnL
  } = options;

  const rawSignals = loaders.loadSignals({ filepath: signalsPath, limit });
  const filteredSignals = filterSignals(rawSignals, { limit, book, type, minEdge });

  // TODO: Hook real strategy filtering; for now pass-through filtered signals.
  const strategySignals = filteredSignals;

  if (verbose) {
    console.log(`[paperSession] loaded=${rawSignals.length} filtered=${filteredSignals.length}`);
  }

  const executionSummary = execRunner(strategySignals, { strategyContext: {} });

  // P&L on the same signals used for execution (sim-only)
  const resultsMap = loaders.loadResults({ resultsPath });
  let pnlSummary = {
    hasResults: false,
    totalStake: 0,
    realizedProfit: 0,
    expectedValue: 0,
    hitRate: 0,
    pushCount: 0
  };

  if (resultsMap && resultsMap.size > 0) {
    const pnl = pnlRunner(strategySignals, resultsMap);
    pnlSummary = {
      hasResults: true,
      totalStake: pnl.totalStake,
      realizedProfit: pnl.realizedProfit,
      expectedValue: pnl.expectedValue,
      hitRate: pnl.hitRate,
      pushCount: pnl.pushCount
    };
  }

  return {
    signals: {
      loaded: rawSignals.length,
      filtered: filteredSignals.length,
      usedForExecution: strategySignals.length
    },
    execution: {
      ordersAttempted: executionSummary.totalOrders,
      allowed: executionSummary.allowedCount,
      blocked: executionSummary.blockedCount,
      filled: executionSummary.filledCount,
      partial: executionSummary.partialCount,
      rejected: executionSummary.rejectedCount,
      simulatedExposure: executionSummary.simulatedExposure
    },
    pnl: pnlSummary,
    resultsPath
  };
}

module.exports = {
  runPaperSession
};

