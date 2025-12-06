const { runPaperSession } = require('../../src/sessions/paperSessionRunner');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function run() {
  const fakeSignals = [
    { id: 's1', eventId: 'EVT1', primaryBook: 'draftkings', marketType: 'moneyline', side: 'home', price: -110, edgeEstimate: 0.05, strategyStake: 50, createdAt: '2024-01-01T00:00:00Z' },
    { id: 's2', eventId: 'EVT2', primaryBook: 'betmgm', marketType: 'moneyline', side: 'away', price: +120, edgeEstimate: 0.01, strategyStake: 60, createdAt: '2024-01-01T00:00:00Z' }
  ];

  const loaders = {
    loadSignals: () => fakeSignals,
    loadResults: () => new Map([
      ['EVT1', { eventId: 'EVT1', final: { homeScore: 21, awayScore: 14 } }],
      ['EVT2', { eventId: 'EVT2', final: { homeScore: 7, awayScore: 10 } }]
    ])
  };

  const execRunner = () => ({
    totalOrders: 2,
    allowedCount: 2,
    blockedCount: 0,
    filledCount: 2,
    partialCount: 0,
    rejectedCount: 0,
    simulatedExposure: 110
  });

  const pnlRunner = () => ({
    totalStake: 110,
    realizedProfit: 15,
    expectedValue: 12,
    hitRate: 0.5,
    pushCount: 0
  });

  const summary = runPaperSession({
    signalsPath: 'ignored',
    resultsPath: 'ignored',
    limit: 10,
    loaders,
    execRunner,
    pnlRunner
  });

  assert(summary.signals.loaded === 2, 'signals loaded');
  assert(summary.execution.allowed === 2, 'execution allowed');
  assert(summary.pnl.hasResults === true, 'pnl has results');
  assert(summary.pnl.realizedProfit === 15, 'pnl profit matches');
  console.log('✓ paperSessionRunner combines execution + pnl summaries');
})();

