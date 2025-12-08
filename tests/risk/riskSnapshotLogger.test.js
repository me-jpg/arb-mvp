/**
 * tests/risk/riskSnapshotLogger.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { captureRiskSnapshot, LOG_FILE } = require('../../src/risk/riskSnapshotLogger');

// Create a mock context for clean test logic or just use file inspection
// Since logger uses a hardcoded path, we should check if we can override it via env/args or just clean up?
// For pure testing, inspecting the actual file output is fine if we append to it.

console.log('=== riskSnapshotLogger.test.js ===\n');

// 1. Capture snapshot
const context = { source: 'test-runner', notes: ['unit-test'] };
const snapshot = captureRiskSnapshot(context);

assert(snapshot, 'Snapshot should be returned');
assert(snapshot.takenAt, 'Snapshot needs timestamp');
assert(typeof snapshot.bankroll === 'number', 'Bankroll should be number');
assert(snapshot.exposure, 'Exposure object missing');
assert(snapshot.source === 'test-runner', 'Source should match context');

console.log('✓ captureRiskSnapshot returned valid object');

// 2. Verify file write
// Read last line of LOG_FILE
if (fs.existsSync(LOG_FILE)) {
    const content = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    const lastLine = content[content.length - 1];
    const savedSnap = JSON.parse(lastLine);

    assert(savedSnap.takenAt === snapshot.takenAt, 'File content should match returned snapshot');
    assert(savedSnap.notes.includes('unit-test'), 'Notes should be persisted');

    console.log('✓ Snapshot persisted to JSONL file');
} else {
    throw new Error(`Log file not found at ${LOG_FILE}`);
}

console.log('\n=== All risk logger tests passed ===\n');
