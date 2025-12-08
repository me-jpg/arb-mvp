// src/execution/executionEngine.js
// Orchestrate simulation: signals -> planned orders -> risk -> simulate -> log

const { buildPlannedOrders } = require('./orderPlanner');
const { evaluatePlannedOrder } = require('./riskGuard');
const { simulateExecution } = require('./simulatedExchange');
const { logExecutionEvent } = require('./executionLogger');
const { updateExposure } = require('../risk/riskState');
const { buildRetryPolicy, shouldRetryExecution, computeNextBackoffMs } = require('./executionRetryPolicy');
const { getExecutionRetryConfig, getExecutionIdempotencyConfig } = require('../config');
const { buildIdempotencyKey, shouldBlockDuplicate } = require('./executionIdempotency');

/**
 * Sleep utility for retry delays.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/**
 * Execute a single order with retry logic.
 * @param {Object} order - Order to execute
 *@param {Object} context - Execution context
 * @returns {Promise<Object>} Execution result
 */
async function executeWithRetry(order, context) {
  const retryConfig = getExecutionRetryConfig(context.config || {});
  const policy = buildRetryPolicy(retryConfig);

  let attempt = 1;
  let lastResult = null;

  while (true) {
    // Execute single attempt (this is already a simulation)
    const executionRequest = {
      requestId: `req_${order.orderId}_attempt_${attempt}`,
      plannedOrder: order,
      sentAt: new Date().toISOString()
    };

    const result = context.simulator ?
      context.simulator(executionRequest, context.simOptions || {}) :
      { status: 'rejected', error: 'No simulator available' };

    lastResult = result;

    // Success - return immediately
    if (result && (result.status === 'filled' || result.status === 'partial')) {
      return result;
    }

    // Determine retry eligibility
    const shouldRetry = shouldRetryExecution({
      attemptNumber: attempt,
      errorCode: result && result.error,
      failureReason: result && result.status,
      policy
    });

    if (!shouldRetry) {
      // No more retries
      return lastResult;
    }

    // Calculate backoff delay
    const nextAttempt = attempt + 1;
    const delayMs = computeNextBackoffMs({
      attemptNumber: nextAttempt,
      policy
    });

    if (delayMs > 0) {
      await sleep(delayMs);
    }

    attempt = nextAttempt;
  }
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
  const idempotencyConfig = getExecutionIdempotencyConfig(config);

  for (const signal of arbSignals) {
    try {
      // Build order context for idempotency check
      const orderContext = {
        eventId: signal.eventId || signal.id,
        book: signal.book,
        marketType: signal.marketType || signal.type,
        side: signal.side,
        price: signal.price,
        stake: signal.stake || signal.suggestedStake || 100
      };

      // Check for duplicate (if recentExecutions provided in config.recentExecutions)
      const recentExecutions = config.recentExecutions || [];
      const isBlocked = shouldBlockDuplicate(orderContext, recentExecutions, idempotencyConfig);

      if (isBlocked) {
        // Log duplicate block
        const idempotencyKey = buildIdempotencyKey(orderContext);
        console.log('[executionEngine] Blocked duplicate order:', { idempotencyKey, signal: signal.id });

        results.push({
          signalId: signal.id,
          status: 'blocked_duplicate',
          reason: 'idempotency_duplicate_order',
          idempotencyKey
        });
        continue;
      }

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
