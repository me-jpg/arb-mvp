#!/usr/bin/env node
/**
 * src/metrics/run-latency-report.js
 * 
 * CLI tool for cross-book latency analysis.
 */

const { getLatencyMetricsConfig } = require('../../config');
const db = require('../utils/db');
const { loadLatencyEvents, computeCrossBookLatency, summarizeLatencyByBook } = require('./latencyAnalytics');

/**
 * Parse CLI arguments.
 */
function parseArgs(argv) {
    const args = {
        windowMinutes: null,
        json: false
    };

    for (const arg of argv.slice(2)) {
        if (arg.startsWith('--windowMinutes=')) {
            args.windowMinutes = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--json') {
            args.json = true;
        }
    }

    return args;
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
 * Main function.
 */
async function main() {
    let dbClient = null;

    try {
        const args = parseArgs(process.argv);
        const config = getLatencyMetricsConfig();

        // Override windowMinutes if provided
        const windowMinutes = args.windowMinutes || config.windowMinutes;

        // Create DB client
        dbClient = await db.connect();

        // Load latency events
        const events = await loadLatencyEvents(dbClient, { windowMinutes });

        // Compute statistics
        const latencyStats = computeCrossBookLatency(events, {
            windowMinutes,
            minEventsPerBook: config.minEventsPerBook,
            maxBooks: config.maxBooks
        });

        // Summarize
        const summary = summarizeLatencyByBook(latencyStats);

        // Output
        if (args.json) {
            console.log(JSON.stringify({ latencySummary: summary }, null, 2));
        } else {
            printPrettyReport(summary, config);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        if (dbClient) {
            await db.close(dbClient);
        }
    }
}

// Only run if executed directly
if (require.main === module) {
    main();
}

module.exports = { parseArgs, printPrettyReport, main };
