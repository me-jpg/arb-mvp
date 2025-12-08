#!/usr/bin/env node
/**
 * src/metrics/run-latency-report.js
 * 
 * CLI tool for cross-book latency analysis.
 */

const CONFIG = require('../../config');
const { getLatencyMetricsConfig } = require('../../config');
const db = require('../utils/db');
const latencyAnalytics = require('./latencyAnalytics');

/**
 * Core CLI handler (pure-ish, testable).
 * @param {Object} options - CLI options
 * @param {Object} deps - Dependencies for testing
 * @returns {Promise<Object>} Result with windowMinutes and summary
 */
async function runLatencyReportCli(options, deps) {
    const { windowMinutes: windowMinutesOption, json } = options;
    const { config, dbFactory, latencyAnalytics: analytics } = deps;

    // Resolve effective window
    const latencyConfig = getLatencyMetricsConfig(config);
    const windowMinutes = typeof windowMinutesOption === 'number'
        ? windowMinutesOption
        : latencyConfig.windowMinutes;

    // Create DB client
    const dbClient = await dbFactory();

    try {
        // Load latency events
        const events = await analytics.loadLatencyEvents(dbClient, { windowMinutes });

        // Compute statistics
        const stats = analytics.computeCrossBookLatency(events, {
            windowMinutes,
            minEventsPerBook: latencyConfig.minEventsPerBook,
            maxBooks: latencyConfig.maxBooks
        });

        // Summarize
        const summary = analytics.summarizeLatencyByBook(stats, { windowMinutes });

        // Output
        if (json) {
            console.log(JSON.stringify({ latencySummary: summary }, null, 2));
        } else {
            printPrettyReport(summary, latencyConfig);
        }

        return {
            windowMinutes,
            summary
        };
    } finally {
        if (dbClient && dbClient.close) {
            await dbClient.close();
        }
    }
}

/**
 * Print pretty report.
 */
function printPrettyReport(summary, config) {
    console.log('=== CROSS-BOOK LATENCY REPORT ===');
    console.log(`Window: ${summary.global.windowMinutes} minutes`);
    console.log(`Total Events: ${summary.global.totalEvents}`);
    console.log(`Books (minEventsPerBook = ${config.minEventsPerBook}):`);

    if (summary.perBook.length === 0) {
        console.log('  (no books with sufficient samples)');
    } else {
        for (const book of summary.perBook) {
            console.log(`- ${book.book}: avg=${book.avgLagMs}ms, p95=${book.p95LagMs}ms, max=${book.maxLagMs}ms, samples=${book.sampleCount}`);
        }
    }
}

/**
 * Build CLI runtime (parse args, create deps).
 */
function buildCliRuntime() {
    // Parse arguments
    const args = {
        windowMinutes: null,
        json: false
    };

    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--windowMinutes=')) {
            args.windowMinutes = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--json') {
            args.json = true;
        }
    }

    // Build dependencies
    const deps = {
        config: CONFIG,
        dbFactory: async () => await db.connect(),
        latencyAnalytics: {
            loadLatencyEvents: latencyAnalytics.loadLatencyEvents,
            computeCrossBookLatency: latencyAnalytics.computeCrossBookLatency,
            summarizeLatencyByBook: latencyAnalytics.summarizeLatencyByBook
        }
    };

    return { options: args, deps };
}

// Script entry point
if (require.main === module) {
    (async () => {
        try {
            const { options, deps } = buildCliRuntime();
            await runLatencyReportCli(options, deps);
            process.exit(0);
        } catch (err) {
            console.error('[latency-report] ERROR:', err.message || err);
            process.exit(1);
        }
    })();
}

module.exports = {
    runLatencyReportCli
};
