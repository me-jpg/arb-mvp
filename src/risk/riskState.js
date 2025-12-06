// src/risk/riskState.js
// In-memory exposure tracking for simulation

const state = {
  exposureByBook: new Map(),
  exposureByEvent: new Map(),
  exposureByMarket: new Map(),
  dayLoss: 0,
  bankroll: parseFloat(process.env.RISK_INITIAL_BANKROLL || '10000')
};

function getCurrentExposure() {
  return {
    bankroll: state.bankroll,
    openExposureTotal: totalMap(state.exposureByBook),
    byBook: mapToObj(state.exposureByBook),
    byEvent: mapToObj(state.exposureByEvent),
    byMarketType: mapToObj(state.exposureByMarket),
    byDay: {}, // placeholder for future daily buckets
    openOrders: [] // not tracked in Phase 1
  };
}

function addToMap(map, key, delta) {
  const prev = map.get(key) || 0;
  map.set(key, prev + delta);
}

function totalMap(map) {
  let sum = 0;
  for (const v of map.values()) sum += v;
  return sum;
}

function mapToObj(map) {
  const out = {};
  for (const [k, v] of map.entries()) out[k] = v;
  return out;
}

function updateExposure(plannedOrder, executionResult) {
  if (!executionResult || !plannedOrder) return;
  if (executionResult.status !== 'filled' && executionResult.status !== 'partial') return;
  const stake = executionResult.filledStake || 0;
  if (stake <= 0) return;
  addToMap(state.exposureByBook, plannedOrder.book, stake);
  addToMap(state.exposureByEvent, plannedOrder.eventId, stake);
  addToMap(state.exposureByMarket, plannedOrder.marketType || 'moneyline', stake);
}

function resetDailyRiskState() {
  state.exposureByBook.clear();
  state.exposureByEvent.clear();
  state.exposureByMarket.clear();
  state.dayLoss = 0;
}

function recordDayLoss(lossAmount) {
  if (Number.isFinite(lossAmount)) {
    state.dayLoss += lossAmount;
  }
}

function getDayLoss() {
  return state.dayLoss;
}

module.exports = {
  getCurrentExposure,
  updateExposure,
  resetDailyRiskState,
  recordDayLoss,
  getDayLoss
};

