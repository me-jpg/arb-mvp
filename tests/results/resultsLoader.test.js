const fs = require('fs');
const path = require('path');
const { loadResults, normalizeEventId } = require('../../src/results/resultsLoader');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function run() {
  const tmpDir = path.join(__dirname, 'tmp-load');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const jsonlPath = path.join(tmpDir, 'results.jsonl');

  const rows = [
    { eventId: '2024-01-01_Team_A_vs_Team_B', final: { homeScore: 21, awayScore: 17 } },
    { eventId: '2024-01-02 Team C vs Team D', final: { homeScore: 10, awayScore: 10 } }
  ];
  fs.writeFileSync(jsonlPath, rows.map(r => JSON.stringify(r)).join('\n'));

  const map = loadResults({ resultsPath: tmpDir });
  assert(map.size === 2, 'should load two results');

  const normalized = normalizeEventId('2024-01-01_Team_A_vs_Team_B');
  const result = map.get(normalized);
  assert(result.final.homeScore === 21 && result.final.awayScore === 17, 'scores should match');

  console.log('✓ resultsLoader loads JSONL and normalizes eventId');
})();

