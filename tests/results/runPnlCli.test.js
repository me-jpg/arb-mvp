const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function runCliTest() {
  const tmpDir = path.join(__dirname, 'tmp-cli');
  const logsDir = path.join(tmpDir, 'logs');
  const resultsDir = path.join(tmpDir, 'results');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const signals = [
    {
      id: 'sig1',
      createdAt: '2024-01-01T00:00:00Z',
      type: 'pure_arb',
      eventId: '2024-01-01_Team_A_vs_Team_B',
      marketType: 'moneyline',
      side: 'home',
      primaryBook: 'draftkings',
      price: -110,
      edgeEstimate: 0.05,
      strategyStake: 100
    }
  ];
  fs.writeFileSync(path.join(logsDir, 'signals.jsonl'), signals.map(s => JSON.stringify(s)).join('\n'));

  const results = [{ eventId: '2024-01-01_Team_A_vs_Team_B', final: { homeScore: 14, awayScore: 7 } }];
  fs.writeFileSync(path.join(resultsDir, 'results.jsonl'), results.map(r => JSON.stringify(r)).join('\n'));

  const cliPath = path.join(process.cwd(), 'src', 'results', 'run-pnl.js');
  const res = spawnSync('node', [cliPath, `--signals=${path.join(logsDir, 'signals.jsonl')}`, `--results=${resultsDir}`, '--limit=10'], { encoding: 'utf8' });

  assert(res.status === 0, 'CLI should exit 0');
  assert(res.stdout.includes('REALIZED P&L'), 'CLI should print summary');
  console.log('✓ run-pnl CLI works with sample data');
})();

