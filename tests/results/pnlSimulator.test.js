const { simulatePnL, evaluateOutcome, americanProfit } = require('../../src/results/pnlSimulator');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function testOutcomeLogic() {
  const result = { final: { homeScore: 24, awayScore: 17 } };
  const mlSig = { marketType: 'moneyline', side: 'home', price: -110, strategyStake: 100, metadata: {}, eventId: '2024-01-01_A_B', createdAt: '2024-01-01T00:00:00Z', primaryBook: 'draftkings', type: 'pure_arb', edgeEstimate: 0.05 };
  const mlOutcome = evaluateOutcome(mlSig, result);
  assert(mlOutcome.outcome === 'win', 'moneyline should win');
  assert(Math.abs(mlOutcome.profit - americanProfit(100, -110)) < 0.01, 'moneyline profit calc');

  const spreadSig = { ...mlSig, marketType: 'spread', side: 'home', metadata: { line: -6.5 } };
  const spreadOutcome = evaluateOutcome(spreadSig, result);
  assert(spreadOutcome.outcome === 'win', 'spread should cover with margin above line');

  const pushSig = { ...mlSig, marketType: 'spread', side: 'home', metadata: { line: -7 }, eventId: '2024-01-02_A_B' };
  const pushOutcome = evaluateOutcome(pushSig, { final: { homeScore: 24, awayScore: 17 } });
  assert(pushOutcome.outcome === 'push', 'spread push when margin equals line');

  const lossSig = { ...mlSig, marketType: 'spread', side: 'home', metadata: { line: -10 }, eventId: '2024-01-02_A_C' };
  const lossOutcome = evaluateOutcome(lossSig, { final: { homeScore: 24, awayScore: 17 } });
  assert(lossOutcome.outcome === 'loss', 'spread loss when not covering');
})();

(function testTotals() {
  const totalResult = { final: { homeScore: 21, awayScore: 24 } }; // total 45
  const overSig = { marketType: 'total', side: 'over', metadata: { line: 44.5 }, price: -105, strategyStake: 50, eventId: '2024-01-03_A_B', createdAt: '2024-01-03T00:00:00Z', primaryBook: 'betmgm', type: 'stale_vs_book', edgeEstimate: 0.02 };
  const underSig = { ...overSig, side: 'under', metadata: { line: 45 }, eventId: '2024-01-04_A_B' };
  assert(evaluateOutcome(overSig, totalResult).outcome === 'win', 'over should hit');
  assert(evaluateOutcome(underSig, totalResult).outcome === 'push', 'total push when equal');
})();

(function testSimulationAggregates() {
  const signals = [
    { eventId: '2024-01-10_A_B', marketType: 'moneyline', side: 'home', price: -110, strategyStake: 100, createdAt: '2024-01-10T00:00:00Z', primaryBook: 'draftkings', type: 'pure_arb', edgeEstimate: 0.05 },
    { eventId: '2024-01-11_A_B', marketType: 'moneyline', side: 'away', price: +120, strategyStake: 80, createdAt: '2024-01-11T00:00:00Z', primaryBook: 'betmgm', type: 'pure_arb', edgeEstimate: 0.03 },
    { eventId: '2024-01-12_A_B', marketType: 'total', side: 'under', metadata: { line: 40 }, price: -110, strategyStake: 60, createdAt: '2024-01-12T00:00:00Z', primaryBook: 'espnbet', type: 'stale_vs_book', edgeEstimate: 0.02 },
    { eventId: '2024-01-13_MISSING', marketType: 'moneyline', side: 'home', price: -110, strategyStake: 50, createdAt: '2024-01-13T00:00:00Z', primaryBook: 'draftkings', type: 'pure_arb', edgeEstimate: 0.01 }
  ];

  const results = new Map([
    ['2024-01-10_A_B', { eventId: '2024-01-10_A_B', final: { homeScore: 14, awayScore: 10 } }],
    ['2024-01-11_A_B', { eventId: '2024-01-11_A_B', final: { homeScore: 7, awayScore: 24 } }],
    ['2024-01-12_A_B', { eventId: '2024-01-12_A_B', final: { homeScore: 17, awayScore: 20 } }]
  ]);

  const summary = simulatePnL(signals, results);
  assert(summary.evaluatedSignals === 3, 'should evaluate 3 signals');
  assert(summary.missingResults === 1, 'should count missing result');
  assert(summary.breakdownByBook.draftkings.signalCount === 1, 'book breakdown');
  assert(summary.breakdownByType.pure_arb.signalCount === 2, 'type breakdown');
  console.log('✓ pnlSimulator evaluates outcomes and aggregates');
})();

