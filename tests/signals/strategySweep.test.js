#!/usr/bin/env node
// tests/signals/strategySweep.test.js
// Tests for strategy grid search

const { buildStrategyGrid, runStrategySweep, getGridInfo } = require('../../src/signals/strategySweep');
const { defaultStrategyConfig } = require('../../src/signals/strategyEngine');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

console.log('\n=== strategySweep.test.js ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: buildStrategyGrid returns expected number of configs
// ─────────────────────────────────────────────────────────────────────────────
{
  const grid = buildStrategyGrid(defaultStrategyConfig, {
    minEdge: [0.02, 0.03],
    stakeMode: ['flat', 'edge_scaled'],
    maxSignalsPerEvent: [1],
    maxTotalStakePerBook: [5000]
  });
  
  assert(grid.length === 4, `Expected 4 configs (2x2x1x1), got ${grid.length}`);
  assert(grid[0].minEdge === 0.02, 'First config should have minEdge 0.02');
  assert(grid[0].stakeMode === 'flat', 'First config should have stakeMode flat');
  assert(grid[0]._gridKey.includes('min=2%'), 'Config should have _gridKey');
  console.log('✓ Test 1: buildStrategyGrid returns expected number of configs');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Grid includes all combinations
// ─────────────────────────────────────────────────────────────────────────────
{
  const grid = buildStrategyGrid(defaultStrategyConfig, {
    minEdge: [0.01, 0.02],
    stakeMode: ['flat'],
    maxSignalsPerEvent: [1, 2],
    maxTotalStakePerBook: [1000]
  });
  
  assert(grid.length === 4, `Expected 4 configs, got ${grid.length}`);
  
  // Check we have all combinations
  const keys = grid.map(c => `${c.minEdge}-${c.maxSignalsPerEvent}`);
  assert(keys.includes('0.01-1'), 'Missing 0.01-1');
  assert(keys.includes('0.01-2'), 'Missing 0.01-2');
  assert(keys.includes('0.02-1'), 'Missing 0.02-1');
  assert(keys.includes('0.02-2'), 'Missing 0.02-2');
  
  console.log('✓ Test 2: Grid includes all combinations');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: getGridInfo reports correct dimensions
// ─────────────────────────────────────────────────────────────────────────────
{
  const info = getGridInfo({
    minEdge: [0.01, 0.02, 0.03],
    stakeMode: ['flat'],
    maxSignalsPerEvent: [1, 2],
    maxTotalStakePerBook: [5000]
  });
  
  assert(info.totalConfigs === 6, `Expected 6 configs, got ${info.totalConfigs}`);
  assert(info.dimensions.minEdge.length === 3, 'minEdge should have 3 values');
  console.log('✓ Test 3: getGridInfo reports correct dimensions');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: runStrategySweep returns valid structure on empty signals
// ─────────────────────────────────────────────────────────────────────────────
{
  // This will fail to load signals (no file or empty) - should not crash
  const result = runStrategySweep({
    limit: 1,
    gridOverrides: {
      minEdge: [0.01],
      stakeMode: ['flat'],
      maxSignalsPerEvent: [1],
      maxTotalStakePerBook: [1000]
    }
  });
  
  // Either no signals found, or a valid structure
  assert(typeof result.loadedSignals === 'number', 'loadedSignals should be a number');
  assert(Array.isArray(result.results), 'results should be an array');
  
  console.log('✓ Test 4: runStrategySweep returns valid structure');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Configs inherit from defaultStrategyConfig
// ─────────────────────────────────────────────────────────────────────────────
{
  const grid = buildStrategyGrid(defaultStrategyConfig, {
    minEdge: [0.05],
    stakeMode: ['flat'],
    maxSignalsPerEvent: [1],
    maxTotalStakePerBook: [2000]
  });
  
  assert(grid.length === 1, 'Should have 1 config');
  const cfg = grid[0];
  
  // Should have overridden values
  assert(cfg.minEdge === 0.05, 'minEdge should be 0.05');
  assert(cfg.stakeMode === 'flat', 'stakeMode should be flat');
  
  // Should inherit from default
  assert(cfg.flatStake !== undefined, 'Should inherit flatStake from default');
  assert(cfg.allowedTypes !== undefined, 'Should inherit allowedTypes from default');
  
  console.log('✓ Test 5: Configs inherit from defaultStrategyConfig');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Results sorted by EV descending
// ─────────────────────────────────────────────────────────────────────────────
{
  // This is a bit hard to test without mock signals, but we can check
  // the sweep returns results in a consistent order
  const result = runStrategySweep({
    gridOverrides: {
      minEdge: [0.01, 0.02],
      stakeMode: ['flat'],
      maxSignalsPerEvent: [1],
      maxTotalStakePerBook: [5000]
    }
  });
  
  // Check ordering (if results exist)
  if (result.results.length >= 2) {
    const ev1 = result.results[0].metrics.expectedValue;
    const ev2 = result.results[1].metrics.expectedValue;
    assert(ev1 >= ev2, 'Results should be sorted by EV descending');
    console.log('✓ Test 6: Results sorted by EV descending');
  } else {
    console.log('✓ Test 6: Results sorted by EV descending (skipped - not enough results)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: evPerStake is 0 when totalStake is 0
// ─────────────────────────────────────────────────────────────────────────────
{
  // With very high minEdge, likely no signals selected
  const result = runStrategySweep({
    gridOverrides: {
      minEdge: [0.99], // 99% - nothing will qualify
      stakeMode: ['flat'],
      maxSignalsPerEvent: [1],
      maxTotalStakePerBook: [1000]
    }
  });
  
  if (result.results.length > 0) {
    const r = result.results[0];
    // If totalStake is 0, evPerStake should be 0 (not NaN/Infinity)
    if (r.metrics.totalStake === 0) {
      assert(r.metrics.evPerStake === 0, 'evPerStake should be 0 when totalStake is 0');
      console.log('✓ Test 7: evPerStake is 0 when totalStake is 0');
    } else {
      assert(Number.isFinite(r.metrics.evPerStake), 'evPerStake should be finite');
      console.log('✓ Test 7: evPerStake is finite');
    }
  } else {
    console.log('✓ Test 7: evPerStake handling (skipped - no results)');
  }
}

console.log('\n=== All strategySweep tests passed! ===\n');

