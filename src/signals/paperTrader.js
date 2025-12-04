// src/signals/paperTrader.js
// Simulates paper trading on generated signals

/**
 * Simulate taking signals and compute expected P&L
 * @param {Array} signals - Array of Signal objects
 * @param {Object} options - Configuration
 * @returns {Object} Simulation results
 */
function simulateSignals(signals = [], options = {}) {
  const {
    stakePerSignal = 50,
    // Placeholder for future: actual win rate lookup
    // For now, we use edgeEstimate to model expected value
  } = options;

  if (!signals || signals.length === 0) {
    return {
      signalCount: 0,
      totalStake: 0,
      avgEdgeEstimate: 0,
      expectedValue: 0,
      byType: {}
    };
  }

  const signalCount = signals.length;
  const totalStake = signalCount * stakePerSignal;

  // Calculate average edge
  let totalEdge = 0;
  const byType = {};

  for (const signal of signals) {
    const edge = signal.edgeEstimate || 0;
    totalEdge += edge;

    // Group by type
    const type = signal.type || 'unknown';
    if (!byType[type]) {
      byType[type] = { count: 0, totalEdge: 0, totalStake: 0 };
    }
    byType[type].count++;
    byType[type].totalEdge += edge;
    byType[type].totalStake += stakePerSignal;
  }

  const avgEdgeEstimate = totalEdge / signalCount;

  // Simple expected value model:
  // EV = totalStake * avgEdgeEstimate
  // This assumes edgeEstimate represents the expected return percentage
  const expectedValue = totalStake * avgEdgeEstimate;

  // Calculate per-type stats
  for (const type of Object.keys(byType)) {
    const stats = byType[type];
    stats.avgEdge = stats.totalEdge / stats.count;
    stats.expectedValue = stats.totalStake * stats.avgEdge;
  }

  return {
    signalCount,
    totalStake,
    avgEdgeEstimate,
    expectedValue,
    byType
  };
}

/**
 * Format simulation results for display
 * @param {Object} results - From simulateSignals()
 * @returns {string} Formatted string
 */
function formatSimulationResults(results) {
  const lines = [];
  
  lines.push(`Signals generated: ${results.signalCount}`);
  lines.push(`Total stake: $${results.totalStake.toFixed(2)}`);
  lines.push(`Avg edge estimate: ${(results.avgEdgeEstimate * 100).toFixed(2)}%`);
  lines.push(`Expected P&L (hypothetical): ${results.expectedValue >= 0 ? '+' : ''}$${results.expectedValue.toFixed(2)}`);

  if (Object.keys(results.byType).length > 1) {
    lines.push('');
    lines.push('By signal type:');
    for (const [type, stats] of Object.entries(results.byType)) {
      lines.push(`  ${type}: ${stats.count} signals, EV: $${stats.expectedValue.toFixed(2)}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  simulateSignals,
  formatSimulationResults
};

