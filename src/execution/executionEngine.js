// src/execution/executionEngine.js
// Orchestrate simulation: signals -> planned orders -> risk -> simulate -> log

const { buildPlannedOrders } = require('./orderPlanner');
const { evaluatePlannedOrder } = require('./riskGuard');
const { simulateExecution } = require('./simulatedExchange');
const { logExecutionEvent } = require('./executionLogger');
const { updateExposure } = require('../risk/riskState');

function runExecutionSimulation(signals = [], options = {}) {
  const {
    strategyContext = {},
    logger = logExecutionEvent,
    riskEvaluator = evaluatePlannedOrder,
    simulator = simulateExecution
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
      createdAt: new Date().toISOString()
    };

    if (!riskDecision.allowed) {
      summary.blockedCount++;
      logger({ ...baseEvent, result: null, warnings: riskDecision.reasons });
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

    logger({
      ...baseEvent,
      request: executionRequest,
      result,
      latencyMs
    });
  }

  return summary;
}

module.exports = {
  runExecutionSimulation
};

