// src/risk/riskChecks.js
// Pure risk checks for planned orders

function evaluateRisk(plannedOrder, riskContext) {
  const { bankrollConfig, exposureSnapshot, currentDayLoss = 0 } = riskContext;
  const violations = [];
  const stake = plannedOrder.stake || 0;
  const bankroll = bankrollConfig.initialBankroll || 0;

  if (stake > bankroll * bankrollConfig.maxStakePctPerOrder) {
    violations.push({ id: 'maxStakePct', severity: 'block', reason: 'Stake exceeds max % of bankroll' });
  }

  const eventExposure = (exposureSnapshot.byEvent[plannedOrder.eventId] || 0) + stake;
  if (eventExposure > bankroll * bankrollConfig.maxExposurePctPerEvent) {
    violations.push({ id: 'eventExposure', severity: 'block', reason: 'Event exposure limit exceeded' });
  }

  const bookExposure = (exposureSnapshot.byBook[plannedOrder.book] || 0) + stake;
  const bookCapPct = bankrollConfig.maxExposurePctPerBook || bankrollConfig.maxExposurePctPerEvent;
  if (bookExposure > bankroll * bookCapPct) {
    violations.push({ id: 'bookExposure', severity: 'block', reason: 'Book exposure limit exceeded' });
  }

  if (currentDayLoss > bankroll * bankrollConfig.maxDailyLossPct) {
    violations.push({ id: 'dailyLoss', severity: 'block', reason: 'Daily loss limit reached' });
  }

  const allowed = violations.length === 0;
  return {
    allowed,
    violatedRules: violations,
    suggestedStakeAdjustment: allowed ? stake : 0,
    notes: []
  };
}

module.exports = {
  evaluateRisk
};

