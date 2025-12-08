// src/execution/orderPlanner.js
// Convert signals into PlannedOrder objects (simulation only)

const config = require('../../config');

function resolveStake(signal, strategyContext = {}) {
  const meta = signal.metadata || {};
  const candidates = [
    meta.stakePrimary,
    meta.totalStake,
    signal.strategyStake,
    strategyContext.defaultStake
  ];
  for (const val of candidates) {
    if (Number.isFinite(val) && val > 0) return Number(val);
  }
  return config.execution.defaultStake || 50;
}

function resolveLine(signal) {
  const meta = signal.metadata || {};
  const fields = [signal.line, meta.line, meta.total, meta.spread];
  for (const val of fields) {
    if (val !== undefined && val !== null && Number.isFinite(Number(val))) return Number(val);
  }
  return undefined;
}

function buildPlannedOrderFromSignal(signal, strategyContext = {}) {
  if (!signal || !signal.eventId || !signal.primaryBook || !Number.isFinite(signal.price)) {
    console.warn('[orderPlanner] skipping invalid signal');
    return null;
  }

  const now = new Date().toISOString();
  const planned = {
    orderId: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    eventId: signal.eventId,
    book: signal.primaryBook,
    marketType: signal.marketType || 'moneyline',
    side: signal.side || 'home',
    line: resolveLine(signal),
    price: Number(signal.price),
    stake: resolveStake(signal, strategyContext),
    sourceSignalId: signal.id || 'unknown',
    strategyId: strategyContext.strategyId || strategyContext.name || null,
    createdAt: now,
    metadata: {
      edgeEstimate: signal.edgeEstimate,
      confidence: signal.confidence,
      referenceBook: signal.referenceBook,
      ...signal.metadata
    }
  };

  return planned;
}

function buildPlannedOrders(signals = [], strategyContext = {}) {
  const safe = Array.isArray(signals) ? signals : [];
  const out = [];
  for (const sig of safe) {
    const planned = buildPlannedOrderFromSignal(sig, strategyContext);
    if (planned) out.push(planned);
  }
  return out;
}

/**
 * Compute exposure context for risk caps enforcement.
 * 
 * @param {Array} recentExecutions - Recent execution events
 * @param {string} bookId - Book identifier
 * @param {Object} caps - Risk caps configuration
 * @param {number|Date} [now] - Reference time (default: Date.now())
 * @returns {Object} Exposure context
 */
function computeExposureContext(recentExecutions, bookId, caps, now) {
  if (!recentExecutions || !caps || (!caps.maxPerBookExposure && !caps.maxDailyLoss)) {
    return {};
  }

  const { computeBookExposure, computeDailyPnL } = require('../risk/riskExposureTracker');

  const context = {};
  const nowTs = now ? new Date(now).getTime() : Date.now();

  // Compute book exposure if cap is set
  if (caps.maxPerBookExposure !== undefined) {
    const exposureResult = computeBookExposure(recentExecutions, bookId, {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      referenceTime: nowTs
    });
    context.bookExposure = exposureResult.totalStake;
  }

  // Compute daily PnL if cap is set
  if (caps.maxDailyLoss !== undefined) {
    const nowDate = new Date(nowTs);
    const dayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const pnlResult = computeDailyPnL(recentExecutions, { dayStart, dayEnd });
    context.dailyPnL = pnlResult.totalPnL;
  }

  return context;
}

/**
 * Compute planned stake using SimRisk engine if edge available.
 * Falls back to existing behavior when edge not provided.
 * 
 * @param {Object} orderContext - Order context
 * @param {Object} globalConfig - Global config
 * @param {number|null} maybeEdge - Optional edge signal
 * @param {Array} [recentExecutions] - Recent execution history for exposure caps
 * @returns {number} Computed stake
 */
function computePlannedStake(orderContext, globalConfig, maybeEdge, recentExecutions) {
  try {
    const { getExecutionRiskConfig } = require('../config');
    const { computeStakeSize, applyRiskCaps } = require('../risk/simRiskEngine');

    const riskConfig = getExecutionRiskConfig(globalConfig);

    // Fallback to existing behavior if no edge
    if (!riskConfig || maybeEdge == null || maybeEdge <= 0) {
      return orderContext.defaultStake || globalConfig?.execution?.defaultStake || 50;
    }

    const rawStake = computeStakeSize({
      edge: maybeEdge,
      bankroll: riskConfig.bankroll,
      baseUnit: riskConfig.baseUnit,
      kellyFraction: riskConfig.kellyFraction,
      minStake: riskConfig.minStake,
      maxStake: riskConfig.maxStake
    });

    // Compute exposure context for caps
    const exposureContext = computeExposureContext(
      recentExecutions || [],
      orderContext.book,
      riskConfig.caps || {},
      Date.now()
    );

    return applyRiskCaps(rawStake, riskConfig.caps || {}, exposureContext);
  } catch {
    // Fallback on any error
    return orderContext.defaultStake || globalConfig?.execution?.defaultStake || 50;
  }
}

module.exports = {
  buildPlannedOrderFromSignal,
  buildPlannedOrders,
  computePlannedStake,  // Export for testing
  computeExposureContext  // Export for testing
};
```
