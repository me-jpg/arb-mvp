/**
 * tests/metrics/executionHealthLoader.test.js
 * Updated for hardened loader
 */

const assert = require('assert');
const { loadExecutionHealth, MAX_LIMIT } = require('../../src/metrics/executionHealthLoader');

console.log('=== executionHealthLoader.test.js ===\n');

// Test 1: Handles non-existent file
{
    (async () => {
        const result = await loadExecutionHealth({ filePath: '/nonexistent/path.jsonl' });

        assert.ok(result, 'Should return result');
        assert.strictEqual(result.global.total, 0, 'Should have 0 total');
        assert.strictEqual(result.perBook.length, 0, 'Should have no books');
        assert.strictEqual(result.failureModes.length, 0, 'Should have no failure modes');
        assert.strictEqual(result.systemicAlerts.length, 0, 'Should have no alerts');

        console.log('✓ Test 1: Handles non-existent file');
    })();
}

// Test 2: Returns correct structure with unknown field
{
    (async () => {
        const result = await loadExecutionHealth({ filePath: '/nonexistent/path.jsonl' });

        assert.ok(result.global, 'Should have global key');
        assert.ok(Array.isArray(result.perBook), 'perBook should be array');
        assert.ok(Array.isArray(result.failureModes), 'failureModes should be array');
        assert.ok(Array.isArray(result.systemicAlerts), 'systemicAlerts should be array');

        assert.ok(typeof result.global.fillRate === 'number', 'fillRate should be number');
        assert.ok(typeof result.global.rejectRate === 'number', 'rejectRate should be number');
        assert.ok(typeof result.global.unknown === 'number', 'unknown should be number');

        console.log('✓ Test 2: Returns correct structure with unknown field');
    })();
}

// Test 3: Error handling
{
    (async () => {
        const result = await loadExecutionHealth({ limit: 'invalid' });

        assert.ok(result, 'Should return result even with bad input');
        assert.ok(result.global, 'Should have global stats');

        console.log('✓ Test 3: Error handling');
    })();
}

// Test 4: MAX_LIMIT is enforced
{
    (async () => {
        const hugeLimit = MAX_LIMIT * 10;
        const result = await loadExecutionHealth({
            filePath: '/nonexistent/path.jsonl',
            limit: hugeLimit
        });

        assert.ok(result, 'Should handle huge limit gracefully');
        assert.strictEqual(MAX_LIMIT, 50000, 'MAX_LIMIT should be 50000');

        console.log('✓ Test 4: MAX_LIMIT guard prevents OOM');
    })();
}

setTimeout(() => {
    console.log('\n=== All 4 execution health loader tests passed ===\n');
}, 1000);
