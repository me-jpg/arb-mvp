// src/signals/strategySweep.js
// Strategy grid search over historical signals

const { loadSignals } = require('./signalLoader');
const { applyStrategy, defaultStrategyConfig } = require('./strategyEngine');

/**
 * Build a grid of strategy configurations to test
 * @param {Object} baseConfig - Base config (defaults to defaultStrategyConfig)
 * @param {Object} overrides - Grid dimensions to override
 * @returns {Array} Array of config objects with metadata
 */
function buildStrategyGrid(baseConfig = defaultStrategyConfig, overrides = {}) {
  // Default grid dimensions - small to avoid explosion
  const gridDimensions = {
    minEdge: overrides.minEdge || [0.02, 0.03, 0.04, 0.05],
    stakeMode: overrides.stakeMode || ['flat', 'edge_scaled'],
    maxSignalsPerEvent: overrides.maxSignalsPerEvent || [1, 2],
    maxTotalStakePerBook: overrides.maxTotalStakePerBook || [3000, 5000]
  };

  const configs = [];

  // Generate all combinations
  for (const minEdge of gridDimensions.minEdge) {
    for (const stakeMode of gridDimensions.stakeMode) {
      for (const maxSignalsPerEvent of gridDimensions.maxSignalsPerEvent) {
        for (const maxTotalStakePerBook of gridDimensions.maxTotalStakePerBook) {
          configs.push({
            // Spread base config first, then override with grid values
            ...baseConfig,
            minEdge,
            stakeMode,
            maxSignalsPerEvent,
            maxTotalStakePerBook,
            // Metadata for identification
            _gridKey: `min=${(minEdge * 100).toFixed(0)}% ${stakeMode.slice(0, 4)} perEvt=${maxSignalsPerEvent} perBook=${maxTotalStakePerBook}`
          });
        }
      }
    }
  }

  return configs;
}

/**
 * Run strategy sweep over a grid of configurations
 * @param {Object} options - { limit, book, type, gridOverrides }
 * @returns {Object} { loadedSignals, results: [...] }
 */
function runStrategySweep(options = {}) {
  const {
    limit = 2000,
    book = null,
    type = null,
    gridOverrides = {}
  } = options;

  // Load signals once
  const signals = loadSignals({ limit, book, type });
  
  if (signals.length === 0) {
    return {
      loadedSignals: 0,
      results: []
    };
  }

  // Build strategy grid
  const configs = buildStrategyGrid(defaultStrategyConfig, gridOverrides);

  // Run each config and collect results
  const results = [];

  for (const config of configs) {
    const result = applyStrategy(signals, config);

    // Compute EV per stake (handle division by zero)
    const evPerStake = result.totalStake > 0 
      ? result.expectedValue / result.totalStake 
      : 0;

    results.push({
      config: {
        minEdge: config.minEdge,
        stakeMode: config.stakeMode,
        maxSignalsPerEvent: config.maxSignalsPerEvent,
        maxTotalStakePerBook: config.maxTotalStakePerBook,
        _gridKey: config._gridKey
      },
      metrics: {
        loadedSignals: signals.length,
        selectedSignals: result.selectedSignals.length,
        rejectedSignals: result.rejectedSignalsCount,
        totalStake: result.totalStake,
        avgEdgeEstimate: result.avgEdgeEstimate,
        expectedValue: result.expectedValue,
        evPerStake
      }
    });
  }

  // Sort by EV descending (best configs first)
  results.sort((a, b) => b.metrics.expectedValue - a.metrics.expectedValue);

  return {
    loadedSignals: signals.length,
    gridSize: configs.length,
    results
  };
}

/**
 * Get grid dimensions info
 * @param {Object} gridOverrides - Optional overrides
 * @returns {Object} Grid dimension info
 */
function getGridInfo(gridOverrides = {}) {
  const dimensions = {
    minEdge: gridOverrides.minEdge || [0.02, 0.03, 0.04, 0.05],
    stakeMode: gridOverrides.stakeMode || ['flat', 'edge_scaled'],
    maxSignalsPerEvent: gridOverrides.maxSignalsPerEvent || [1, 2],
    maxTotalStakePerBook: gridOverrides.maxTotalStakePerBook || [3000, 5000]
  };

  const totalConfigs = dimensions.minEdge.length * 
                       dimensions.stakeMode.length * 
                       dimensions.maxSignalsPerEvent.length * 
                       dimensions.maxTotalStakePerBook.length;

  return {
    dimensions,
    totalConfigs
  };
}

module.exports = {
  runStrategySweep,
  buildStrategyGrid,
  getGridInfo
};




