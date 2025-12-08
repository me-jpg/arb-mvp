/**
 * tests/execution/executionAuditLogLoader.test.js
 * 
 * Unit tests for execution audit log loader.
 */

const assert = require('assert');
const { parseExecutionLogLine, filterExecutionEvents, buildIncidentTimeline } = require('../../src/execution/executionAuditLogLoader');

console.log('=== Execution Audit Log Loader Tests ===\\n');

/**
 * Test: parseExecutionLogLine - valid JSON
 */
{
    const line = '{"arbId":"arb1","eventId":"evt1","status":"filled"}';
    const result = parseExecutionLogLine(line);

    assert.ok(result, 'Should parse valid JSON');
    assert.strictEqual(result.arbId, 'arb1');
    assert.strictEqual(result.eventId, 'evt1');
    assert.strictEqual(result.status, 'filled');
    console.log('✓ parseExecutionLogLine: valid JSON parsed');
}

/**
 * Test: parseExecutionLogLine - invalid JSON
 */
{
    const line = '{invalid json}';
    const result = parseExecutionLogLine(line);

    assert.strictEqual(result, null, 'Should return null for invalid JSON');
    console.log('✓ parseExecutionLogLine: invalid JSON → null');
}

/**
 * Test: parseExecutionLogLine - empty/null input
 */
{
    assert.strictEqual(parseExecutionLogLine(''), null);
    assert.strictEqual(parseExecutionLogLine(null), null);
    assert.strictEqual(parseExecutionLogLine(undefined), null);
    console.log('✓ parseExecutionLogLine: empty/null input → null');
}

/**
 * Test: parseExecutionLogLine - partial fields
 */
{
    const line = '{"arbId":"arb2"}';  // Missing other fields
    const result = parseExecutionLogLine(line);

    assert.ok(result);
    assert.strictEqual(result.arbId, 'arb2');
    console.log('✓ parseExecutionLogLine: partial fields parsed');
}

/**
 * Test: filterExecutionEvents - by arbId
 */
{
    const events = [
        { arbId: 'arb1', eventId: 'evt1', timestamp: '2025-01-01T00:00:00Z' },
        { arbId: 'arb2', eventId: 'evt2', timestamp: '2025-01-01T00:01:00Z' },
        { arbId: 'arb1', eventId: 'evt3', timestamp: '2025-01-01T00:02:00Z' }
    ];

    const filtered = filterExecutionEvents(events, { arbId: 'arb1' });

    assert.strictEqual(filtered.length, 2);
    assert.strictEqual(filtered[0].eventId, 'evt1');
    assert.strictEqual(filtered[1].eventId, 'evt3');
    console.log('✓ filterExecutionEvents: filter by arbId');
}

/**
 * Test: filterExecutionEvents - by eventId
 */
{
    const events = [
        { arbId: 'arb1', eventId: 'evt1', timestamp: '2025-01-01T00:00:00Z' },
        { arbId: 'arb2', eventId: 'evt2', timestamp: '2025-01-01T00:01:00Z' }
    ];

    const filtered = filterExecutionEvents(events, { eventId: 'evt2' });

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].arbId, 'arb2');
    console.log('✓ filterExecutionEvents: filter by eventId');
}

/**
 * Test: filterExecutionEvents - by time range
 */
{
    const events = [
        { arbId: 'arb1', timestamp: '2025-01-01T00:00:00Z' },
        { arbId: 'arb1', timestamp: '2025-01-01T01:00:00Z' },
        { arbId: 'arb1', timestamp: '2025-01-01T02:00:00Z' }
    ];

    const filtered = filterExecutionEvents(events, {
        since: '2025-01-01T00:30:00Z',
        until: '2025-01-01T01:30:00Z'
    });

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].timestamp, '2025-01-01T01:00:00Z');
    console.log('✓ filterExecutionEvents: filter by time range');
}

/**
 * Test: filterExecutionEvents - combined filters
 */
{
    const events = [
        { arbId: 'arb1', eventId: 'evt1', timestamp: '2025-01-01T00:00:00Z' },
        { arbId: 'arb1', eventId: 'evt2', timestamp: '2025-01-01T01:00:00Z' },
        { arbId: 'arb2', eventId: 'evt1', timestamp: '2025-01-01T00:30:00Z' }
    ];

    const filtered = filterExecutionEvents(events, {
        arbId: 'arb1',
        eventId: 'evt1'
    });

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].timestamp, '2025-01-01T00:00:00Z');
    console.log('✓ filterExecutionEvents: combined filters');
}

/**
 * Test: filterExecutionEvents - sorted by timestamp
 */
{
    const events = [
        { arbId: 'arb1', timestamp: '2025-01-01T02:00:00Z' },
        { arbId: 'arb1', timestamp: '2025-01-01T00:00:00Z' },
        { arbId: 'arb1', timestamp: '2025-01-01T01:00:00Z' }
    ];

    const filtered = filterExecutionEvents(events, {});

    assert.strictEqual(filtered[0].timestamp, '2025-01-01T00:00:00Z');
    assert.strictEqual(filtered[1].timestamp, '2025-01-01T01:00:00Z');
    assert.strictEqual(filtered[2].timestamp, '2025-01-01T02:00:00Z');
    console.log('✓ filterExecutionEvents: sorted by timestamp');
}

/**
 * Test: buildIncidentTimeline - empty events
 */
{
    const timeline = buildIncidentTimeline([]);

    assert.strictEqual(timeline.arbId, null);
    assert.strictEqual(timeline.eventId, null);
    assert.deepStrictEqual(timeline.legs, {});
    assert.strictEqual(timeline.meta.totalEvents, 0);
    console.log('✓ buildIncidentTimeline: empty events handled');
}

/**
 * Test: buildIncidentTimeline - single leg
 */
{
    const events = [
        {
            arbId: 'arb1',
            eventId: 'evt1',
            legId: 'leg1',
            book: 'draftkings',
            timestamp: '2025-01-01T00:00:00Z',
            status: 'filled',
            filledStake: 100,
            remainingStake: 0
        }
    ];

    const timeline = buildIncidentTimeline(events);

    assert.strictEqual(timeline.arbId, 'arb1');
    assert.strictEqual(timeline.eventId, 'evt1');
    assert.ok(timeline.legs.leg1);
    assert.strictEqual(timeline.legs.leg1.book, 'draftkings');
    assert.strictEqual(timeline.legs.leg1.executions.length, 1);
    assert.strictEqual(timeline.legs.leg1.executions[0].status, 'filled');
    console.log('✓ buildIncidentTimeline: single leg grouped correctly');
}

/**
 * Test: buildIncidentTimeline - multiple legs
 */
{
    const events = [
        { legId: 'leg1', book: 'draftkings', timestamp: '2025-01-01T00:00:00Z', status: 'filled' },
        { legId: 'leg2', book: 'fanduel', timestamp: '2025-01-01T00:01:00Z', status: 'partial_filled' },
        { legId: 'leg1', book: 'draftkings', timestamp: '2025-01-01T00:02:00Z', status: 'filled' }
    ];

    const timeline = buildIncidentTimeline(events);

    assert.strictEqual(Object.keys(timeline.legs).length, 2);
    assert.ok(timeline.legs.leg1);
    assert.ok(timeline.legs.leg2);
    assert.strictEqual(timeline.legs.leg1.executions.length, 2);
    assert.strictEqual(timeline.legs.leg2.executions.length, 1);
    console.log('✓ buildIncidentTimeline: multiple legs grouped');
}

/**
 * Test: buildIncidentTimeline - time range metadata
 */
{
    const events = [
        { legId: 'leg1', timestamp: '2025-01-01T00:00:00Z' },
        { legId: 'leg1', timestamp: '2025-01-01T02:00:00Z' }
    ];

    const timeline = buildIncidentTimeline(events);

    assert.strictEqual(timeline.meta.firstTimestamp, '2025-01-01T00:00:00Z');
    assert.strictEqual(timeline.meta.lastTimestamp, '2025-01-01T02:00:00Z');
    assert.strictEqual(timeline.meta.totalEvents, 2);
    console.log('✓ buildIncidentTimeline: time range metadata');
}

/**
 * Test: buildIncidentTimeline - mode and advisory extraction
 */
{
    const events = [
        { legId: 'leg1', mode: 'live', level: 'warning' },
        { legId: 'leg1', mode: 'paper' }  // mode already set, won't override
    ];

    const timeline = buildIncidentTimeline(events);

    assert.strictEqual(timeline.meta.mode, 'live');
    assert.strictEqual(timeline.meta.advisoryLevel, 'warning');
    console.log('✓ buildIncidentTimeline: mode and advisory extracted');
}

console.log('\\n=== All audit log loader tests passed ===\\n');
