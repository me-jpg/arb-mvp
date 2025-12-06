const { buildPlannedOrderFromSignal } = require('../../src/execution/orderPlanner');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function run() {
  const signal = {
    id: 'sig1',
    eventId: 'EVT1',
    primaryBook: 'draftkings',
    marketType: 'spread',
    side: 'home',
    price: -110,
    metadata: { line: -3.5, stakePrimary: 75 },
    edgeEstimate: 0.04,
    confidence: 0.9
  };

  const planned = buildPlannedOrderFromSignal(signal, { strategyId: 'stratA' });
  assert(planned, 'planned should exist');
  assert(planned.eventId === 'EVT1', 'eventId mapped');
  assert(planned.book === 'draftkings', 'book mapped');
  assert(planned.line === -3.5, 'line mapped');
  assert(planned.stake === 75, 'stake resolved from metadata');
  assert(planned.sourceSignalId === 'sig1', 'sourceSignalId set');
  assert(planned.strategyId === 'stratA', 'strategyId set');
  console.log('✓ orderPlanner maps signal to PlannedOrder');
})();

