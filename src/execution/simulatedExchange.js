// src/execution/simulatedExchange.js
// Deterministic offline fill simulator

const config = require('../../config');

function applySlippage(price, slippageBps) {
  if (!Number.isFinite(price) || !Number.isFinite(slippageBps) || slippageBps === 0) return price;
  const bps = slippageBps / 10000;
  if (price > 0) {
    return Math.max(1, price * (1 - bps)); // worse positive odds
  }
  return price * (1 + bps); // more negative
}

function simulateExecution(executionRequest, options = {}) {
  const {
    rejectProb = config.execution.simRejectProb || 0,
    slippageBps = config.execution.simSlippageBps || 0
  } = options;

  const now = new Date().toISOString();
  const roll = Math.random();
  if (rejectProb > 0 && roll < rejectProb) {
    return {
      requestId: executionRequest.requestId,
      status: 'rejected',
      filledStake: 0,
      avgFillPrice: undefined,
      slippage: 0,
      errorCode: 'SIM_REJECT',
      message: 'Simulated rejection',
      decidedAt: now,
      fillEvents: []
    };
  }

  const plannedPrice = executionRequest.plannedOrder.price;
  const filledPrice = applySlippage(plannedPrice, slippageBps);

  return {
    requestId: executionRequest.requestId,
    status: 'filled',
    filledStake: executionRequest.plannedOrder.stake,
    avgFillPrice: filledPrice,
    slippage: filledPrice - plannedPrice,
    decidedAt: now,
    fillEvents: [{
      stake: executionRequest.plannedOrder.stake,
      price: filledPrice,
      at: now
    }]
  };
}

module.exports = {
  simulateExecution
};

