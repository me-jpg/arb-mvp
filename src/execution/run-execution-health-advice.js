/**
 * src/execution/run-execution-health-advice.js
 * 
 * CLI for execution health advisory.
 */

const path = require('path');
const { loadExecutionHealth } = require('../metrics/executionHealthLoader');
const { deriveExecutionHealthStatus, shouldHaltExecution } = require('./executionHealthAdvisor');

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
const JSON_OUTPUT = kwargs.json === true || kwargs.json === 'true';

async function run() {
    const healthSummary = await loadExecutionHealth({
        limit: LIMIT,
        windowMinutes: WINDOW_MINUTES,
        filePath: FILE_PATH
    });

    const advisory = deriveExecutionHealthStatus(healthSummary);
    const haltRecommended = shouldHaltExecution(healthSummary);

    if (JSON_OUTPUT) {
        console.log(JSON.stringify({
            healthSummary,
            advisory,
            haltRecommended
        }, null, 2));
        return;
    }

    // Pretty print
    console.log('=== EXECUTION HEALTH ADVISOR ===\n');

    const levelDisplay = advisory.level === 'ok' ? 'OK'
        : advisory.level === 'degraded' ? 'DEGRADED'
            : 'HALT RECOMMENDED';

    console.log(`Level: ${levelDisplay}`);
    console.log(`Recommended: ${haltRecommended ? 'HALT' : 'CONTINUE'} (advisory only)\n`);

    if (advisory.reasons && advisory.reasons.length > 0) {
        console.log('Reasons:');
        advisory.reasons.forEach(r => console.log(`  - ${r}`));
        console.log('');
    }

    if (advisory.metrics) {
        const m = advisory.metrics;
        console.log('Metrics:');
        if (m.globalFillRate !== null) {
            console.log(`  Global Fill Rate:    ${(m.globalFillRate * 100).toFixed(1)}%`);
        }
        if (m.globalRejectRate !== null) {
            console.log(`  Global Reject Rate:  ${(m.globalRejectRate * 100).toFixed(1)}%`);
        }
        if (m.worstBook) {
            console.log(`  Worst Book:          ${m.worstBook} (${(m.worstBookRejectRate * 100).toFixed(1)}% reject)`);
        }
        if (m.unknownStatusRatio !== null) {
            console.log(`  Unknown Statuses:    ${(m.unknownStatusRatio * 100).toFixed(1)}%`);
        }
        console.log('');
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
