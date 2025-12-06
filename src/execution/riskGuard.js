// src/execution/riskGuard.js
// Adapter to produce RiskDecision for execution layer

const { getBankrollConfig } = require('../risk/bankrollConfig');
const { getCurrentExposure, getDayLoss } = require('../risk/riskState');
const { evaluateRisk } = require('../risk/riskChecks');

function buildRiskDecision(plannedOrder, checkResult, exposureSnapshot, bankrollConfig) {
  const bankrollAtRisk = plannedOrder.stake / (bankrollConfig.initialBankroll || 1);
  return {
    allowed: checkResult.allowed,
    reasons: checkResult.violatedRules.map(v => v.reason),
    postOrderExposure: {
      total: exposureSnapshot.openExposureTotal + plannedOrder.stake,
      byBook: {
        ...exposureSnapshot.byBook,
        [plannedOrder.book]: (exposureSnapshot.byBook[plannedOrder.book] || 0) + plannedOrder.stake
      },
      byEvent: {
        ...exposureSnapshot.byEvent,
        [plannedOrder.eventId]: (exposureSnapshot.byEvent[plannedOrder.eventId] || 0) + plannedOrder.stake
      }
    },
    bankrollPctAtRisk: bankrollAtRisk,
    checkResult
  };
}

function evaluatePlannedOrder(plannedOrder) {
  const bankrollConfig = getBankrollConfig();
  const exposureSnapshot = getCurrentExposure();
  const checkResult = evaluateRisk(plannedOrder, {
    bankrollConfig,
    exposureSnapshot,
    currentDayLoss: getDayLoss()
  });
  return buildRiskDecision(plannedOrder, checkResult, exposureSnapshot, bankrollConfig);
}

module.exports = {
  evaluatePlannedOrder
};

