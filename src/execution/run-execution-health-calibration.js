/**
 * src/execution/run-execution-health-calibration.js
 * 
 * Calibration tool for execution health thresholds.
 */

const { loadExecutionHealth } = require('../metrics/executionHealthLoader');
const { deriveExecutionHealthStatus } = require('./executionHealthAdvisor');

const args = process.argv.slice(2);
const kwargs = {};

args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const LIMIT = kwargs.limit ? parseInt(kwargs.limit, 10) : 5000;
const WINDOW_MINUTES = kwargs.windowMinutes ? parseInt(kwargs.windowMinutes, 10) : 30;
const HOURS_BACK = kwargs.hoursBack ? parseInt(kwargs.hoursBack, 10) : 24;
const SIMULATE_HALT = kwargs.simulateHalt === '1' || kwargs.simulateHalt === true;

async function run() {
    const results = await calibrateHealthThresholds({
        limit: LIMIT,
        windowMinutes: WINDOW_MINUTES,
        hoursBack: HOURS_BACK,
        simulateHalt: SIMULATE_HALT
    });

    console.log('=== EXECUTION HEALTH CALIBRATION ===\n');
    console.log(`Total Windows Analyzed: ${results.totalWindows}`);
    console.log(`Window Size: ${WINDOW_MINUTES} minutes\n`);

    console.log('Advisory Level Distribution:');
    console.log(`  OK:                ${results.okCount} (${(results.okPct * 100).toFixed(1)}%)`);
    console.log(`  Degraded:          ${results.degradedCount} (${(results.degradedPct * 100).toFixed(1)}%)`);
    console.log(`  Halt Recommended:  ${results.haltRecommendedCount} (${(results.haltRecommendedPct * 100).toFixed(1)}%)`);
    console.log('');

    if (SIMULATE_HALT && results.haltSimulation) {
        console.log('=== HALT SIMULATION ===');
        console.log(`Total Windows: ${results.haltSimulation.totalWindows}`);
        console.log(`Would-Have-Halted: ${results.haltSimulation.wouldHaveHaltedCount}`);
        console.log(`Percentage: ${results.haltSimulation.haltPercentage.toFixed(1)}%`);
        console.log('Thresholds Used:');
        console.log(`  rejectRate.halt = ${results.haltSimulation.thresholds.rejectRate.halt}`);
        console.log(`  globalFillRate.critical = ${results.haltSimulation.thresholds.globalFillRate.critical}`);
        console.log(`  unknownStatusRatio.warning = ${results.haltSimulation.thresholds.unknownStatusRatio.warning}`);
        console.log(`  invalidTimestampRatio.warning = ${results.haltSimulation.thresholds.invalidTimestampRatio.warning}`);
        console.log('');
    }
}

async function calibrateHealthThresholds(options = {}) {
    const { limit = 5000, windowMinutes = 30, hoursBack = 24, simulateHalt = false } = options;
    const { DEFAULT_THRESHOLDS } = require('./executionHealthAdvisor');

    let okCount = 0;
    let degradedCount = 0;
    let haltRecommendedCount = 0;
    let wouldHaveHaltedCount = 0;

    // For simplicity, just evaluate current window
    const healthSummary = await loadExecutionHealth({ limit, windowMinutes });
    const advisory = deriveExecutionHealthStatus(healthSummary);

    if (advisory.level === 'ok') {
        okCount++;
    } else if (advisory.level === 'degraded') {
        degradedCount++;
    } else if (advisory.level === 'halt_recommended') {
        haltRecommendedCount++;
    }

    // Halt simulation: count windows that would have halted
    if (simulateHalt && advisory.level === 'halt_recommended') {
        wouldHaveHaltedCount++;
    }

    const totalWindows = okCount + degradedCount + haltRecommendedCount;

    const result = {
        totalWindows,
        okCount,
        degradedCount,
        haltRecommendedCount,
        okPct: totalWindows > 0 ? okCount / totalWindows : 0,
        degradedPct: totalWindows > 0 ? degradedCount / totalWindows : 0,
        haltRecommendedPct: totalWindows > 0 ? haltRecommendedCount / totalWindows : 0
    };

    if (simulateHalt) {
        result.haltSimulation = {
            totalWindows,
            wouldHaveHaltedCount,
            haltPercentage: totalWindows > 0 ? (wouldHaveHaltedCount / totalWindows) * 100 : 0,
            thresholds: {
                rejectRate: DEFAULT_THRESHOLDS.rejectRate,
                globalFillRate: DEFAULT_THRESHOLDS.globalFillRate,
                unknownStatusRatio: DEFAULT_THRESHOLDS.unknownStatusRatio,
                invalidTimestampRatio: DEFAULT_THRESHOLDS.invalidTimestampRatio
            }
        };
    }

    return result;
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { calibrateHealthThresholds };
