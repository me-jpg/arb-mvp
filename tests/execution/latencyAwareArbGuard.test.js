/**
 * tests/execution/latencyAwareArbGuard.test.js
 * 
 * Unit tests for latency-aware arb guard.
 */

const assert = require('assert');
const { evaluateArbLatency } = require('../../src/execution/latencyAwareArbGuard');

console.log('=== Latency-Aware Arb Guard Tests ===\\n');

const nowMs = Date.now();

/**
 * Test: Disabled guard
 */
{
    const arbPlan = {
        id: 'arb1',
        legs: [
            { legId: 'leg1', lastUpdatedAt: nowMs - 10000 }  // Very old
        ]
    };

    const latencyConfig = { enabled: false };

    const result = evaluateArbLatency(arbPlan, latencyConfig, nowMs);

    assert.strictEqual(result.shouldSkip, false);
    assert.strictEqual(result.reasons.length, 0);
    assert.strictEqual(result.metrics, null);
    console.log('✓ Disabled guard: no-op regardless of age');
}

/**
 * Test: Fresh legs
 */
{
    const arbPlan = {
        id: 'arb2',
        legs: [
            { legId: 'leg1', lastUpdatedAt: nowMs - 100 },
            { legId: 'leg2', lastUpdatedAt: nowMs - 200 }
        ]
    };

    const latencyConfig = {
        enabled: true,
        maxLegAgeMs: 2000,
        maxSkewBetweenLegsMs: 1500,
        action: 'skip'
    };

    const result = evaluateArbLatency(arbPlan, latencyConfig, nowMs);

    assert.strictEqual(result.shouldSkip, false);
    assert.strictEqual(result.reasons.length, 0);
    assert.ok(result.metrics);
    assert.ok(result.metrics.maxAgeMs < 2000);
    assert.ok(result.metrics.skewMs < 1500);
    console.log('✓ Fresh legs: no violations, shouldSkip=false');
}

/**
 * Test: Max age exceeded
 */
{
    const arbPlan = {
        id: 'arb3',
        legs: [
            { legId: 'leg1', lastUpdatedAt: nowMs - 3000 }  // Exceeds 2000ms
        ]
    };

    const latencyConfig = {
        enabled: true,
        maxLegAgeMs: 2000,
        maxSkewBetweenLegsMs: 1500,
        action: 'skip'
    };

    const result = evaluateArbLatency(arbPlan, latencyConfig, nowMs);

    assert.strictEqual(result.shouldSkip, true);
    assert.ok(result.reasons.includes('max_leg_age_exceeded'));
    assert.ok(result.metrics.maxAgeMs >= 3000);
    console.log('✓ Max age exceeded: shouldSkip=true');
}

/**
 * Test: Skew exceeded
 */
{
    const arbPlan = {
        id: 'arb4',
        legs: [
            { legId: 'leg1', lastUpdatedAt: nowMs - 100 },    // Fresh
            { legId: 'leg2', lastUpdatedAt: nowMs - 2000 }     // Stale, skew=1900ms > 1500ms
        ]
    };

    const latencyConfig = {
        enabled: true,
        maxLegAgeMs: 3000,      // Both legs pass individual age check
        maxSkewBetweenLegsMs: 1500,
        action: 'skip'
    };

    const result = evaluateArbLatency(arbPlan, latencyConfig, nowMs);

    assert.strictEqual(result.shouldSkip, true);
    assert.ok(result.reasons.includes('leg_skew_exceeded'));
    assert.ok(result.metrics.skewMs > 1500);
    console.log('✓ Skew exceeded: shouldSkip=true');
}

/**
 * Test: Missing timestamp
 */
{
    const arbPlan = {
        id: 'arb5',
        legs: [
            { legId: 'leg1', lastUpdatedAt: nowMs - 100 },
            { legId: 'leg2' }  // Missing timestamp
        ]
    };

    const latencyConfig = {
        enabled: true,
        maxLegAgeMs: 2000,
        maxSkewBetweenLegsMs: 1500,
        action: 'skip'
    };

    const result = evaluateArbLatency(arbPlan, latencyConfig, nowMs);

    assert.ok(result.reasons.includes('missing_timestamp'));
    console.log('✓ Missing timestamp: reason added');
}

/**
 * Test: warn_only action
 */
{
    const arbPlan = {
        id: 'arb6',
        legs: [
            { legId: 'leg1', lastUpdatedAt: nowMs - 3000 }  // Exceeds max age
        ]
    };

    const latencyConfig = {
        enabled: true,
        maxLegAgeMs: 2000,
        maxSkewBetweenLegsMs: 1500,
        action: 'warn_only'  // Don't skip, just warn
    };

    const result = evaluateArbLatency(arbPlan, latencyConfig, nowMs);

    assert.strictEqual(result.shouldSkip, false);  // warn_only doesn't skip
    assert.ok(result.reasons.includes('max_leg_age_exceeded'));
    assert.ok(result.metrics);
    console.log('✓ warn_only action: shouldSkip=false with reasons');
}

console.log('\\n=== All latency guard tests passed ===\\n');
