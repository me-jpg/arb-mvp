const { runExecutionSimulation } = require('../../src/execution/executionEngine');
const { resetDailyRiskState } = require('../../src/risk/riskState');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function run() {
  resetDailyRiskState();
  const signals = [
    { id: 's1', eventId: 'EVT1', primaryBook: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, edgeEstimate: 0.05, strategyStake: 50 },
    { id: 's2', eventId: 'EVT2', primaryBook: 'draftkings', marketType: 'moneyline', side: 'away', price: +120, edgeEstimate: 0.01, strategyStake: 300 } // will be blocked
  ];

  const logs = [];
  const fakeRisk = (planned) => {
    if (planned.stake > 200) {
      return { allowed: false, reasons: ['too big'], postOrderExposure: {}, bankrollPctAtRisk: 0 };
    }
    return { allowed: true, reasons: [], postOrderExposure: {}, bankrollPctAtRisk: planned.stake / 10000 };
  };
  const fakeSim = () => ({ status: 'filled', filledStake: 50, avgFillPrice: -110, slippage: 0, decidedAt: new Date().toISOString(), requestId: 'r1', fillEvents: [] });

  const summary = runExecutionSimulation(signals, {
    logger: (e) => logs.push(e),
    riskEvaluator: fakeRisk,
    simulator: fakeSim,
    simRunId: 'test-run-123'
  });

  assert(summary.totalOrders === 2, 'total orders');
  assert(summary.allowedCount === 1, 'allowed count');
  assert(summary.blockedCount === 1, 'blocked count');
  assert(summary.filledCount === 1, 'filled count');
  assert(logs.length === 2, 'both events logged');

  // Telemetry checks
  const filledLog = logs.find(l => l.riskDecision.allowed);
  const blockedLog = logs.find(l => !l.riskDecision.allowed);

  assert(filledLog.engineVersion, 'engineVersion present');
  assert(filledLog.fillQuality === 'neutral', 'fillQuality neutral for 0 slippage'); // slippage 0 in fakeSim
  assert(filledLog.riskRuleSummary === '', 'empty risk summary for allowed');

  assert(blockedLog.riskRuleSummary === 'too big', 'risk summary populated');
  assert(blockedLog.fillQuality === null, 'fillQuality null for blocked');

  assert(filledLog.simRunId === 'test-run-123', 'simRunId passed through');

  console.log('✓ executionEngine simulation orchestrates risk + sim');
})();

