/**
 * src/experiments/configSweepRunner.js
 * 
 * Offline config sweep runner for systematic testing of strategy configurations.
 * Orchestrates multiple paper sessions with different settings.
 */

const fs = require('fs');
const path = require('path');

/**
 * Run a config sweep across multiple configurations.
 * @param {Array<Object>} configs - Array of config descriptors
 * @param {Object} options - Sweep options
 * @returns {Promise<Object>} Sweep results
 */
async function runConfigSweep(configs = [], options = {}) {
    const {
        limit = 1000,
        signalsPath = path.join(process.cwd(), 'logs', 'signals.jsonl'),
        books = null,
        minEdge = null
    } = options;

    const runs = [];

    for (const config of configs) {
        console.log(`\nRunning config: ${config.id}...`);

        try {
            // Run a simulated paper session with this config
            const metrics = await runSingleConfig(config, {
                limit,
                signalsPath,
                books,
                minEdge
            });

            runs.push({
                id: config.id,
                config,
                metrics
            });

            console.log(`  ✓ Completed: ROI ${(metrics.roi * 100).toFixed(1)}%, fills ${metrics.fills}`);
        } catch (err) {
            console.warn(`  ✗ Failed: ${err.message}`);
            runs.push({
                id: config.id,
                config,
                metrics: null,
                error: err.message
            });
        }
    }

    // Find best by ROI and profit
    const successfulRuns = runs.filter(r => r.metrics && r.metrics.roi !== undefined);
    const bestByRoi = successfulRuns.length > 0
        ? successfulRuns.reduce((best, r) => r.metrics.roi > best.metrics.roi ? r : best)
        : null;
    const bestByProfit = successfulRuns.length > 0
        ? successfulRuns.reduce((best, r) => r.metrics.realizedProfit > best.metrics.realizedProfit ? r : best)
        : null;

    return {
        runs,
        bestByRoi: bestByRoi ? { id: bestByRoi.id, roi: bestByRoi.metrics.roi } : null,
        bestByProfit: bestByProfit ? { id: bestByProfit.id, realizedProfit: bestByProfit.metrics.realizedProfit } : null
    };
}

/**
 * Run a single config (simplified paper session simulation).
 * In a real implementation, this would integrate with paperSessionRunner.
 * For now, we use a simplified approach that works with existing modules.
 */
async function runSingleConfig(config, options) {
    // This is a simplified implementation
    // In practice, you'd integrate with src/sessions/paperSessionRunner.js
    // For now, we'll simulate by loading signals and applying filters

    const { applyStrategy } = require('../signals/strategyEngine');
    const { buildPlannedOrders } = require('../execution/orderPlanner');
    const readline = require('readline');

    // Load signals
    const signals = await loadSignals(options.signalsPath, options.limit);

    // Apply strategy with config settings
    const strategyConfig = {
        ...config.strategyOptions,
        mlScoring: config.mlScoring,
        stakeSizing: config.stakeSizing,
        minEdge: options.minEdge || 0.02,
        allowedTypes: ['pure_arb', 'stale_vs_book', 'latency_edge']
    };

    const strategyResult = applyStrategy(signals, strategyConfig);
    const selectedSignals = strategyResult.selectedSignals;

    // Build planned orders
    const plannedOrders = buildPlannedOrders(selectedSignals, {
        strategyId: config.id,
        defaultStake: config.stakeSizing?.flatStake || 50
    });

    // Simulate execution (simplified - just counts)
    const fills = plannedOrders.length; // In real impl, would check execution
    const totalStake = plannedOrders.reduce((sum, o) => sum + (o.stake || 0), 0);

    // Estimate P&L (very simplified - real impl would use results)
    // Assume ~55% hit rate and ~2.0 avg odds for quick estimation
    const estimatedWins = Math.floor(fills * 0.55);
    const estimatedLosses = fills - estimatedWins;
    const realizedProfit = (estimatedWins * 50) - (estimatedLosses * 50); // Rough estimate

    const roi = totalStake > 0 ? realizedProfit / totalStake : 0;
    const hitRate = fills > 0 ? estimatedWins / fills : 0;

    return {
        signalsUsed: signals.length,
        signalsSelected: selectedSignals.length,
        orders: plannedOrders.length,
        fills,
        totalStake,
        realizedProfit,
        roi,
        hitRate,
        avgEdge: strategyResult.avgEdgeEstimate || 0,
        totalUnhedgedExposure: 0, // Would calculate from arbExposureAnalyzer
        arbFullyHedged: 0,
        arbUnhedgedSingleLeg: 0
    };
}

/**
 * Load signals from JSONL file.
 */
async function loadSignals(filePath, limit = Infinity) {
    const signals = [];
    if (!fs.existsSync(filePath)) return signals;

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            signals.push(JSON.parse(line));
            count++;
            if (count >= limit) break;
        } catch (e) {
            // Skip malformed
        }
    }

    return signals;
}

module.exports = {
    runConfigSweep
};
