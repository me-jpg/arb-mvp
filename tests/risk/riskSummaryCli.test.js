/**
 * tests/risk/riskSummaryCli.test.js
 * 
 * Verifies that the risk summary CLI logic runs without error.
 * Uses a temporary file to ensure deterministic input.
 */

const { spawnSync } = require('child_process');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('=== riskSummaryCli.test.js ===\n');

const CLI_PATH = path.join(__dirname, '../../src/risk/run-risk-summary.js');

// Create temp file
const tempDir = os.tmpdir();
const tempFile = path.join(tempDir, `risk-test-${Date.now()}.jsonl`);

const mockSnapshot = {
    takenAt: new Date().toISOString(),
    bankroll: 10000,
    exposure: {
        total: 500,
        byBook: { 'draftkings': 300, 'betmgm': 200 }
    },
    currentDayLoss: -50,
    mode: 'test',
    source: 'test-cli'
};

fs.writeFileSync(tempFile, JSON.stringify(mockSnapshot) + '\n');

try {
    // Run CLI pointing to temp file
    const result = spawnSync('node', [CLI_PATH, `--file=${tempFile}`, '--limit=1'], { encoding: 'utf8' });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        console.error('STDERR:', result.stderr);
        throw new Error(`CLI exited with ${result.status}`);
    }

    const stdout = result.stdout;

    // Debug output if needed
    // console.log(stdout);

    // Basic Output Validation
    assert(stdout.includes('=== RISK SUMMARY ==='), 'Missing header');
    assert(stdout.includes('Snapshots: 1'), 'Should find 1 snapshot');
    assert(stdout.includes('Bankroll:'), 'Missing Bankroll info');
    assert(stdout.includes('draftkings'), 'Missing book breakdown');

    console.log('✓ CLI ran successfully and produced summary');

} catch (e) {
    console.error('FAIL:', e);
    process.exit(1);
} finally {
    // Cleanup
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
}

console.log('\n=== All risk CLI tests passed ===\n');
