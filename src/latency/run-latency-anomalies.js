/**
 * src/latency/run-latency-anomalies.js
 * 
 * CLI to detect latency anomalies.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../../config');
const { buildLatencyBaselines, detectLatencyAnomalies } = require('./latencyAnomalyDetector');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};
args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const LOG_FILE = kwargs.file || config.logs?.lineChanges || 'logs/line-changes.jsonl';
const LIMIT = parseInt(kwargs.limit) || 0;
const LOOKBACK_MS = parseInt(kwargs.lookbackMs) || 86400000; // 24 hours
const THRESHOLD_STD_DEVS = parseFloat(kwargs.thresholdStdDevs) || 3;
const MIN_SAMPLES = parseInt(kwargs.minSamples) || 100;

/**
 * Stream-read JSONL file.
 */
async function streamReadJsonl(filePath, limit = 0) {
    const results = [];
    if (!fs.existsSync(filePath)) return results;

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            results.push(JSON.parse(line));
            count++;
            if (limit > 0 && count >= limit) break;
        } catch (e) {
            // Skip malformed lines
        }
    }

    return results;
}

async function run() {
    console.log('=== LATENCY ANOMALY REPORT ===');

    const absolutePath = path.isAbsolute(LOG_FILE)
        ? LOG_FILE
        : path.resolve(process.cwd(), LOG_FILE);

    if (!fs.existsSync(absolutePath)) {
        console.error(`Log file not found: ${absolutePath}`);
        console.log('No anomalies detected (no data).');
        process.exit(0);
    }

    // Load events
    const events = await streamReadJsonl(absolutePath, LIMIT);
    console.log(`Events analyzed: ${events.length}`);

    if (events.length === 0) {
        console.log('No anomalies detected (no data).');
        process.exit(0);
    }

    // Build baselines
    const baselines = buildLatencyBaselines(events, {
        lookbackMs: LOOKBACK_MS,
        minSamples: MIN_SAMPLES
    });

    const booksWithBaselines = Object.keys(baselines.byBook);
    console.log(`Books with baselines: ${booksWithBaselines.join(', ') || '(none)'}`);
    console.log('');

    if (booksWithBaselines.length === 0) {
        console.log('No anomalies detected (insufficient baseline data).');
        process.exit(0);
    }

    // Detect anomalies
    const anomalies = detectLatencyAnomalies(events, baselines, {
        thresholdStdDevs: THRESHOLD_STD_DEVS,
        minSamples: MIN_SAMPLES
    });

    if (anomalies.length === 0) {
        console.log('No anomalies detected.');
        process.exit(0);
    }

    // Separate by severity
    const critical = anomalies.filter(a => a.severity === 'critical');
    const warnings = anomalies.filter(a => a.severity === 'warn');

    if (critical.length > 0) {
        console.log('Critical anomalies:');
        for (const anom of critical) {
            const timestamp = anom.at || '(timestamp unknown)';
            console.log(`  [${timestamp}] ${anom.book}: z=${anom.zScore.toFixed(1)}, lag=${Math.round(anom.observedLagMs)}ms (baseline ${Math.round(anom.baselineAvgLagMs)}±${Math.round(anom.baselineStdLagMs)}ms)`);
        }
        console.log('');
    }

    if (warnings.length > 0) {
        console.log('Warnings:');
        for (const anom of warnings) {
            const timestamp = anom.at || '(timestamp unknown)';
            console.log(`  [${timestamp}] ${anom.book}: z=${anom.zScore.toFixed(1)}, lag=${Math.round(anom.observedLagMs)}ms (baseline ${Math.round(anom.baselineAvgLagMs)}±${Math.round(anom.baselineStdLagMs)}ms)`);
        }
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
