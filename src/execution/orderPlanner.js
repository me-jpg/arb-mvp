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

module.exports = {
  buildPlannedOrderFromSignal,
  buildPlannedOrders
};

