/**
 * src/risk/run-risk-summary.js
 * 
 * CLI to inspect risk snapshots.
 * Usage: node src/risk/run-risk-summary.js --limit=5
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { LOG_FILE } = require('./riskSnapshotLogger');

// Args
const args = process.argv.slice(2);
const kwargs = {};
args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const SNAPSHOT_FILE = kwargs.file || LOG_FILE;
const LIMIT = parseInt(kwargs.limit) || Infinity;

async function run() {
    console.log('=== RISK SUMMARY ===');

    const absolutePath = path.isAbsolute(SNAPSHOT_FILE)
        ? SNAPSHOT_FILE
        : path.resolve(process.cwd(), SNAPSHOT_FILE);

    if (!fs.existsSync(absolutePath)) {
        console.log(`No risk snapshots found at: ${absolutePath}`);
        console.log('Run a paper session (npm run session:paper) to generate some.');
        process.exit(0);
    }

    // Read snapshots
    const snapshots = [];
    try {
        const fileStream = fs.createReadStream(absolutePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const snap = JSON.parse(line);
                snapshots.push(snap);
            } catch (e) {
                // skip bad lines
            }
        }
    } catch (err) {
        console.error(`Error reading ${absolutePath}:`, err.message);
        process.exit(1);
    }

    if (snapshots.length === 0) {
        console.log('File exists but contains no valid snapshots.');
        process.exit(0);
    }

    // Apply limit (take last N)
    const displaySnapshots = (LIMIT !== Infinity && LIMIT < snapshots.length)
        ? snapshots.slice(-LIMIT)
        : snapshots;

    console.log(`Snapshots: ${displaySnapshots.length} (of ${snapshots.length} total) from ${path.basename(absolutePath)}`);

    // Latest Snapshot Analysis
    const latest = displaySnapshots[displaySnapshots.length - 1];
    const dateStr = new Date(latest.takenAt).toLocaleString();

    // Currency formatter
    const fmt = (n) => `$${(n || 0).toFixed(2)}`;

    console.log(`\nLatest (${dateStr}):`);
    console.log(`  Bankroll: ${fmt(latest.bankroll)}`);

    const exp = latest.exposure;
    console.log(`  Exposure: total ${fmt(exp.total)}`);

    if (Object.keys(exp.byBook).length > 0) {
        console.log('    By book:');
        for (const [book, amount] of Object.entries(exp.byBook)) {
            if (amount > 0) console.log(`      ${book.padEnd(12)}: ${fmt(amount)}`);
        }
    }

    console.log(`\n  Current day loss: ${fmt(latest.currentDayLoss)}`);
    console.log(`  Mode: ${latest.mode}`);
    if (latest.source) console.log(`  Source: ${latest.source}`);

    // Max Exposure Analysis (across displayed window)
    const maxExpByBook = {};
    let maxTotalExposure = 0;

    for (const snap of displaySnapshots) {
        if (snap.exposure.total > maxTotalExposure) maxTotalExposure = snap.exposure.total;

        for (const [book, amount] of Object.entries(snap.exposure.byBook)) {
            if (!maxExpByBook[book] || amount > maxExpByBook[book]) {
                maxExpByBook[book] = amount;
            }
        }
    }

    console.log('\nMax exposure seen (in window):');
    console.log(`  Peak Total: ${fmt(maxTotalExposure)}`);

    const booksWithExp = Object.keys(maxExpByBook).filter(k => maxExpByBook[k] > 0);
    if (booksWithExp.length > 0) {
        console.log('  Peak By Book:');
        for (const book of booksWithExp) {
            console.log(`    ${book.padEnd(12)}: ${fmt(maxExpByBook[book])}`);
        }
    } else {
        console.log('  (No exposure recorded)');
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
