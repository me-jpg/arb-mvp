const { evaluateRisk } = require('../../src/risk/riskChecks');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function run() {
  const bankrollConfig = {
    initialBankroll: 10000,
    maxStakePctPerOrder: 0.02,
    maxExposurePctPerEvent: 0.1,
    maxDailyLossPct: 0.1,
    maxExposurePctPerBook: 0.2
  };
  const exposureSnapshot = {
    byBook: { draftkings: 0 },
    byEvent: { EVT1: 900 }, // existing exposure
    openExposureTotal: 900
  };

  const oversized = { stake: 500, eventId: 'EVT1', book: 'draftkings' };
  const res1 = evaluateRisk(oversized, { bankrollConfig, exposureSnapshot, currentDayLoss: 0 });
  assert(!res1.allowed, 'oversized should be blocked');

  const eventOver = { stake: 200, eventId: 'EVT1', book: 'draftkings' };
  const res2 = evaluateRisk(eventOver, { bankrollConfig, exposureSnapshot, currentDayLoss: 0 });
  assert(!res2.allowed, 'event exposure should block');

  const dailyLoss = { stake: 50, eventId: 'EVT2', book: 'draftkings' };
  const res3 = evaluateRisk(dailyLoss, { bankrollConfig, exposureSnapshot, currentDayLoss: 2000 });
  assert(!res3.allowed, 'daily loss should block');

  const ok = { stake: 50, eventId: 'EVT3', book: 'draftkings' };
  const res4 = evaluateRisk(ok, { bankrollConfig, exposureSnapshot: { byBook: { draftkings: 0 }, byEvent: {}, openExposureTotal: 0 }, currentDayLoss: 0 });
  assert(res4.allowed, 'valid order should pass');
  console.log('✓ riskChecks enforce stake, exposure, daily loss');
})();

