/**
 * src/execution/run-execution-health.js
 * 
 * CLI for execution health analysis.
 */

const path = require('path');
const { loadExecutionHealth } = require('../metrics/executionHealthLoader');

// Parse args
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
const FILE_PATH = kwargs.file || path.join(process.cwd(), 'logs', 'execution-events.jsonl');

async function run() {
    console.log('=== EXECUTION HEALTH ANALYSIS ===\n');

    const health = await loadExecutionHealth({
        limit: LIMIT,
        windowMinutes: WINDOW_MINUTES,
        filePath: FILE_PATH
    });

    if (health.error) {
        console.log(`Error: ${health.error}\n`);
        return;
    }

    // Global summary
    console.log('Global Summary:');
    console.log(`  Total executions: ${health.global.total}`);
    console.log(`  Fills: ${health.global.fills} (${(health.global.fillRate * 100).toFixed(1)}%)`);
    console.log(`  Rejects: ${health.global.rejects} (${(health.global.rejectRate * 100).toFixed(1)}%)`);
    console.log(`  Partials: ${health.global.partials} (${(health.global.partialRate * 100).toFixed(1)}%)`);
    console.log('');

    // Per-book breakdown
    if (health.perBook.length > 0) {
        console.log('Per-Book Breakdown:');
        console.log('  Book         Total   Fills   Rejects   Fill%    Reject%');
        console.log('  ' + '-'.repeat(60));

        for (const book of health.perBook.slice(0, 10)) {
            const bookName = book.book.padEnd(12);
            const total = String(book.total).padStart(5);
            const fills = String(book.fills).padStart(5);
            const rejects = String(book.rejects).padStart(7);
            const fillPct = (book.fillRate * 100).toFixed(1).padStart(6);
            const rejectPct = (book.rejectRate * 100).toFixed(1).padStart(8);

            console.log(`  ${bookName} ${total}   ${fills}   ${rejects}   ${fillPct}%   ${rejectPct}%`);
        }
        console.log('');
    }

    // Failure modes
    if (health.failureModes.length > 0) {
        console.log('Top Failure Modes:');
        console.log('  Type              Count    Percentage');
        console.log('  ' + '-'.repeat(45));

        for (const mode of health.failureModes.slice(0, 5)) {
            const typeName = mode.type.padEnd(18);
            const count = String(mode.count).padStart(5);
            const pct = (mode.pct * 100).toFixed(1).padStart(10);

            console.log(`  ${typeName} ${count}    ${pct}%`);
        }
        console.log('');
    }

    // Systemic alerts
    if (health.systemicAlerts.length > 0) {
        console.log('Systemic Alerts:');

        for (const alert of health.systemicAlerts) {
            const badge = alert.severity === 'high' ? '🔴' : '🟡';
            console.log(`  ${badge} [${alert.severity.toUpperCase()}] ${alert.book}: ${alert.message}`);
        }
        console.log('');
    } else {
        console.log('✅ No systemic issues detected\n');
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
