// src/execution/executionEngine.js
// Orchestrate simulation: signals -> planned orders -> risk -> simulate -> log

const { buildPlannedOrders } = require('./orderPlanner');
const { evaluatePlannedOrder } = require('./riskGuard');
const { simulateExecution } = require('./simulatedExchange');
const { logExecutionEvent } = require('./executionLogger');
const { updateExposure } = require('../risk/riskState');

const {
  computeFillQuality,
  summarizeRiskDecision,
  getEngineVersion
} = require('./telemetry');

function runExecutionSimulation(signals = [], options = {}) {
  const {
    strategyContext = {},
    logger = logExecutionEvent,
    riskEvaluator = evaluatePlannedOrder,
    simulator = simulateExecution,
    simRunId = null
  } = options;

  const plannedOrders = buildPlannedOrders(signals, strategyContext);
  const summary = {
    totalOrders: plannedOrders.length,
    allowedCount: 0,
    blockedCount: 0,
    filledCount: 0,
    partialCount: 0,
    rejectedCount: 0,
    simulatedExposure: 0
  };

  const engineVersion = getEngineVersion();

  for (const planned of plannedOrders) {
    const riskDecision = riskEvaluator(planned);
    const baseEvent = {
      orderId: planned.orderId,
      signalId: planned.sourceSignalId,
      strategyId: planned.strategyId,
      eventId: planned.eventId,
      book: planned.book,
      marketType: planned.marketType,
      side: planned.side,
      line: planned.line,
      price: planned.price,
      stake: planned.stake,
      riskDecision,
      riskRuleSummary: summarizeRiskDecision(riskDecision),
      engineVersion,
      simRunId,
      createdAt: new Date().toISOString()
    };

    if (!riskDecision.allowed) {
      summary.blockedCount++;
      logger({ ...baseEvent, result: null, warnings: riskDecision.reasons, fillQuality: null });
      continue;
    }

    summary.allowedCount++;
    const executionRequest = {
      requestId: `req_${planned.orderId}`,
      plannedOrder: planned,
      sentAt: new Date().toISOString()
    };

    const result = simulator(executionRequest, options.simOptions || {});
    const latencyMs = 0;

    if (result.status === 'filled') summary.filledCount++;
    else if (result.status === 'partial') summary.partialCount++;
    else if (result.status === 'rejected') summary.rejectedCount++;

    updateExposure(planned, result);
    summary.simulatedExposure += planned.stake;

    const fillQuality = result.status === 'filled' || result.status === 'partial'
      ? computeFillQuality(result.slippage || 0)
      : null;

    logger({
      ...baseEvent,
      request: executionRequest,
      result,
      latencyMs,
      fillQuality
    });
  }

  return summary;
}

async function executeArbitrageBatch(arbSignals, config = {}) {
  // Health advisory enforcement check
  try {
    const { loadExecutionHealth } = require('../metrics/executionHealthLoader');
    const { evaluateExecutionHealthForBatch } = require('./executionHealthAdvisoryIntegration');

    const healthSummary = await loadExecutionHealth({ limit: 1000, windowMinutes: 15 });
    const advisoryCtx = evaluateExecutionHealthForBatch(healthSummary, config);

    // Enforce halt if configured and recommended
    if (advisoryCtx.shouldAffectExecution) {
      console.warn('[executionEngine] Execution halted by health advisory');
      return {
        status: 'halted_by_health_advisory',
        reason: 'execution_health_advisory_halt',
        advisoryLevel: advisoryCtx.advisory.level,
        results: []
      };
    }
  } catch (err) {
    // Advisory failure should not block execution
    console.error('[executionEngine] Advisory check failed:', err.message);
  }

  const results = [];

  for (const signal of arbSignals) {
    try {
      // Assuming executeSingleArbitrage is defined elsewhere or imported
      const result = await executeSingleArbitrage(signal, config);
      results.push(result);
    } catch (err) {
      console.error('[executionEngine] Failed to execute signal:', err.message);
      results.push({
        signalId: signal.id,
        status: 'error',
        error: err.message
      });
    }
  }

  return { status: 'completed', results };
}

module.exports = {
  runExecutionSimulation,
  executeArbitrageBatch
};
