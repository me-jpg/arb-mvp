/**
 * tests/execution/executionIncidentReport.test.js
 * 
 * Integration tests for execution incident report CLI.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { main, parseArgs, loadLogFile, printReport } = require('../../src/execution/run-execution-incident-report');
const { buildIncidentTimeline } = require('../../src/execution/executionAuditLogLoader');

console.log('=== Execution Incident Report CLI Tests ===\\n');

// Test log directory
const TEST_LOG_DIR = path.join(__dirname, '../..', 'logs', 'test-execution');
const TEST_LOG_FILE = path.join(TEST_LOG_DIR, 'test-execution-events.jsonl');

/**
 * Setup: create test log file
 */
function setupTestLog() {
    if (!fs.existsSync(TEST_LOG_DIR)) {
        fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
    }

    const testEvents = [
        { arbId: 'ARB_123', eventId: 'evt1', legId: 'leg1', book: 'draftkings', timestamp: '2025-01-01T00:00:00Z', status: 'filled', filledStake: 100, remainingStake: 0 },
        { arbId: 'ARB_123', eventId: 'evt1', legId: 'leg2', book: 'fanduel', timestamp: '2025-01-01T00:01:00Z', status: 'partial_filled', filledStake: 50, remainingStake: 50 },
        { arbId: 'ARB_456', eventId: 'evt2', legId: 'leg3', book: 'betmgm', timestamp: '2025-01-01T01:00:00Z', status: 'rejected', errorCode: 'LIMIT' },
        '{invalid json}',  // Test robustness
        '',  // Empty line
        { arbId: 'ARB_123', eventId: 'evt1', legId: 'leg1', book: 'draftkings', timestamp: '2025-01-01T00:02:00Z', status: 'filled', filledStake: 100, remainingStake: 0 }
    ];

    const content = testEvents.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n');
    fs.writeFileSync(TEST_LOG_FILE, content, 'utf8');
}

/**
 * Cleanup: remove test log file
 */
function cleanupTestLog() {
    if (fs.existsSync(TEST_LOG_FILE)) {
        fs.unlinkSync(TEST_LOG_FILE);
    }
}

/**
 * Test: parseArgs
 */
{
    const originalArgv = process.argv;
    process.argv = ['node', 'script.js', '--arbId=ARB_123', '--eventId=evt1', '--logFile=/custom/path.jsonl'];

    const { filters, logFile } = parseArgs();

    assert.strictEqual(filters.arbId, 'ARB_123');
    assert.strictEqual(filters.eventId, 'evt1');
    assert.strictEqual(logFile, '/custom/path.jsonl');

    process.argv = originalArgv;
    console.log('✓ parseArgs: CLI arguments parsed correctly');
}

/**
 * Test: loadLogFile
 */
{
    setupTestLog();

    const events = loadLogFile(TEST_LOG_FILE);

    assert.ok(events.length > 0, 'Should load events');
    assert.ok(events.length < 6, 'Should skip invalid lines');  // 6 lines, but invalid/empty skipped
    assert.strictEqual(events[0].arbId, 'ARB_123');

    cleanupTestLog();
    console.log('✓ loadLogFile: loads and parses valid events');
}

/**
 * Test: loadLogFile - file not found
 */
{
    const events = loadLogFile('/nonexistent/file.jsonl');
    assert.strictEqual(events.length, 0, 'Should return empty array for nonexistent file');
    console.log('✓ loadLogFile: handles missing file gracefully');
}

/**
 * Test: Report for specific arbId
 */
{
    setupTestLog();

    const events = loadLogFile(TEST_LOG_FILE);
    const { filterExecutionEvents } = require('../../src/execution/executionAuditLogLoader');

    const filtered = filterExecutionEvents(events, { arbId: 'ARB_123' });
    const timeline = buildIncidentTimeline(filtered);

    assert.strictEqual(timeline.arbId, 'ARB_123');
    assert.strictEqual(timeline.meta.totalEvents, 3, 'Should have 3 events for ARB_123');
    assert.ok(timeline.legs.leg1);
    assert.ok(timeline.legs.leg2);

    cleanupTestLog();
    console.log('✓ Report by arbId: filters and aggregates correctly');
}

/**
 * Test: No matching events
 */
{
    setupTestLog();

    const events = loadLogFile(TEST_LOG_FILE);
    const { filterExecutionEvents } = require('../../src/execution/executionAuditLogLoader');

    const filtered = filterExecutionEvents(events, { arbId: 'NONEXISTENT' });

    assert.strictEqual(filtered.length, 0);

    cleanupTestLog();
    console.log('✓ No matching events: empty filter results');
}

/**
 * Test: Time range filtering
 */
{
    setupTestLog();

    const events = loadLogFile(TEST_LOG_FILE);
    const { filterExecutionEvents } = require('../../src/execution/executionAuditLogLoader');

    const filtered = filterExecutionEvents(events, {
        since: '2025-01-01T00:00:30Z',
        until: '2025-01-01T00:01:30Z'
    });

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].legId, 'leg2');

    cleanupTestLog();
    console.log('✓ Time range filtering: works correctly');
}

/**
 * Test: Robustness - invalid JSON skipped
 */
{
    setupTestLog();

    const content = fs.readFileSync(TEST_LOG_FILE, 'utf8');
    assert.ok(content.includes('{invalid json}'), 'Test file should contain invalid JSON');

    const events = loadLogFile(TEST_LOG_FILE);

    // Should load valid events, skip invalid
    assert.ok(events.every(e => e.arbId), 'All loaded events should be valid');

    cleanupTestLog();
    console.log('✓ Robustness: invalid JSON lines skipped');
}

/**
 * Test: print Report (basic smoke test)
 */
{
    const timeline = {
        arbId: 'ARB_TEST',
        eventId: 'evt_test',
        legs: {
            leg1: {
                legId: 'leg1',
                book: 'draftkings',
                executions: [
                    { timestamp: '2025-01-01T00:00:00Z', status: 'filled', filledStake: 100, remainingStake: 0, errorCode: null }
                ]
            }
        },
        meta: {
            firstTimestamp: '2025-01-01T00:00:00Z',
            lastTimestamp: '2025-01-01T00:00:00Z',
            mode: 'simulation',
            advisoryLevel: 'ok',
            totalEvents: 1
        }
    };

    // Just ensure it doesn't throw
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(' '));

    printReport(timeline);

    console.log = originalLog;

    assert.ok(logs.some(l => l.includes('ARB_TEST')), 'Should print arbId');
    assert.ok(logs.some(l => l.includes('leg1')), 'Should print legId');
    console.log('✓ printReport: formats output without errors');
}

console.log('\\n=== All incident report CLI tests passed ===\\n');
