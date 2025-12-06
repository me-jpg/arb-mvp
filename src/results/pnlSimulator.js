// src/results/pnlSimulator.js
// Offline P&L simulator using signals + finalized results

const { normalizeEventId } = require('./resultsLoader');

function americanProfit(stake, price) {
  if (!Number.isFinite(stake) || stake <= 0 || !Number.isFinite(price)) return 0;
  return price > 0 ? stake * (price / 100) : stake * (100 / Math.abs(price));
}

function resolveStake(signal) {
  const meta = signal.metadata || {};
  const candidates = [
    signal.strategyStake,
    meta.stakePrimary,
    meta.totalStake,
    meta.stake
  ];
  for (const val of candidates) {
    if (Number.isFinite(val) && val > 0) return Number(val);
  }
  return 100; // fallback
}

function evaluateOutcome(signal, result) {
  if (!signal || !result) return { outcome: 'unknown', profit: 0 };
  const market = (signal.marketType || 'moneyline').toLowerCase();
  const side = (signal.side || 'home').toLowerCase();
  const price = Number(signal.price);
  const stake = resolveStake(signal);
  const home = result.final.homeScore;
  const away = result.final.awayScore;

  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return { outcome: 'unknown', profit: 0 };
  }

  const payout = americanProfit(stake, price);

  if (market === 'moneyline' || market.startsWith('moneyline')) {
    if (home === away) return { outcome: 'push', profit: 0 };
    const winner = home > away ? 'home' : 'away';
    return winner === side ? { outcome: 'win', profit: payout } : { outcome: 'loss', profit: -stake };
  }

  const line = Number(signal.metadata?.line ?? signal.line ?? signal.metadata?.total ?? signal.metadata?.spread);
  if (!Number.isFinite(line)) {
    return { outcome: 'unknown', profit: 0 };
  }

  if (market === 'spread') {
    const homeAdj = home + (side === 'home' ? line : 0);
    const awayAdj = away + (side === 'away' ? line : 0);
    if (homeAdj === awayAdj) return { outcome: 'push', profit: 0 };
    const covers = side === 'home' ? homeAdj > awayAdj : awayAdj > homeAdj;
    return covers ? { outcome: 'win', profit: payout } : { outcome: 'loss', profit: -stake };
  }

  if (market === 'total') {
    const total = home + away;
    if (total === line) return { outcome: 'push', profit: 0 };
    const over = total > line;
    if (side === 'over') return over ? { outcome: 'win', profit: payout } : { outcome: 'loss', profit: -stake };
    if (side === 'under') return over ? { outcome: 'loss', profit: -stake } : { outcome: 'win', profit: payout };
  }

  return { outcome: 'unknown', profit: 0 };
}

function simulatePnL(signals = [], resultsMap = new Map()) {
  const safeSignals = Array.isArray(signals) ? signals : [];
  let totalStake = 0;
  let realizedProfit = 0;
  let expectedValue = 0;
  let wins = 0;
  let evaluated = 0;
  let pushCount = 0;
  let missingResults = 0;

  const breakdownByBook = {};
  const breakdownByType = {};
  const perDaySummary = {};

  for (const sig of safeSignals) {
    if (!sig || !sig.eventId) continue;
    const normalized = normalizeEventId(sig.eventId);
    const result = resultsMap.get(normalized);
    if (!result) {
      missingResults++;
      continue;
    }

    const stake = resolveStake(sig);
    const ev = Number.isFinite(sig.edgeEstimate) ? sig.edgeEstimate * stake : 0;
    expectedValue += ev;

    const { outcome, profit } = evaluateOutcome(sig, result);
    if (outcome === 'unknown') continue;

    totalStake += stake;
    realizedProfit += profit;
    evaluated++;
    if (outcome === 'win') wins++;
    if (outcome === 'push') pushCount++;

    const book = sig.primaryBook || 'unknown';
    if (!breakdownByBook[book]) breakdownByBook[book] = { signalCount: 0, totalStake: 0, realizedProfit: 0 };
    breakdownByBook[book].signalCount++;
    breakdownByBook[book].totalStake += stake;
    breakdownByBook[book].realizedProfit += profit;

    const type = sig.type || 'unknown';
    if (!breakdownByType[type]) breakdownByType[type] = { signalCount: 0, totalStake: 0, realizedProfit: 0 };
    breakdownByType[type].signalCount++;
    breakdownByType[type].totalStake += stake;
    breakdownByType[type].realizedProfit += profit;

    const dayKey = (sig.createdAt || '').split('T')[0] || 'unknown';
    if (!perDaySummary[dayKey]) perDaySummary[dayKey] = { signalCount: 0, totalStake: 0, realizedProfit: 0 };
    perDaySummary[dayKey].signalCount++;
    perDaySummary[dayKey].totalStake += stake;
    perDaySummary[dayKey].realizedProfit += profit;
  }

  const hitRate = evaluated > 0 ? wins / evaluated : 0;

  return {
    totalStake,
    realizedProfit,
    expectedValue,
    hitRate,
    pushCount,
    evaluatedSignals: evaluated,
    missingResults,
    breakdownByBook,
    breakdownByType,
    perDaySummary
  };
}

module.exports = {
  simulatePnL,
  evaluateOutcome,
  americanProfit
};

