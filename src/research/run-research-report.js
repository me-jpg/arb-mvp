/**
 * src/research/run-research-report.js
 * 
 * CLI to generate aggregated research reports from the dataset.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { summarizeByBook, summarizeByStrategy, summarizeEdgeCalibration } = require('./reportGenerator');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};
args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const DEFAULT_LOGS = path.join(process.cwd(), 'logs');
const DATASET_PATH = kwargs.dataset || path.join(DEFAULT_LOGS, 'research', 'dataset.jsonl');
const LIMIT = parseInt(kwargs.limit) || 0;

/**
 * Load dataset rows from JSONL file (streaming).
 */
async function loadDataset(filePath, limit = 0) {
    const rows = [];
    if (!fs.existsSync(filePath)) {
        console.error(`Dataset not found: ${filePath}`);
        return rows;
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            rows.push(JSON.parse(line));
            count++;
            if (limit > 0 && count >= limit) break;
        } catch (e) {
            // Skip malformed lines
        }
    }

    return rows;
}

/**
 * Format and print the report.
 */
function printReport(rows) {
    console.log('=== RESEARCH REPORT ===');
    console.log(`Rows: ${rows.length}\n`);

    // Per-book summary
    const byBook = summarizeByBook(rows);
    const bookKeys = Object.keys(byBook).sort((a, b) => byBook[b].totalStake - byBook[a].totalStake);

    if (bookKeys.length > 0) {
        console.log('Per-book:');
        for (const book of bookKeys) {
            const stats = byBook[book];
            const roi = stats.roi !== null ? stats.roi.toFixed(1) : 'N/A';
            const profit = stats.realizedProfit.toFixed(0);
            const stake = stats.totalStake.toFixed(0);

            console.log(`  ${book.padEnd(15)} count ${stats.count.toString().padStart(4)}, stake ${stake.padStart(8)}, profit ${profit.padStart(8)}, ROI ${roi.padStart(6)}%`);
        }
        console.log('');
    }

    // Per-strategy summary
    const byStrategy = summarizeByStrategy(rows);
    const stratKeys = Object.keys(byStrategy).sort((a, b) => byStrategy[b].totalStake - byStrategy[a].totalStake);

    if (stratKeys.length > 0) {
        console.log('Per-strategy:');
        for (const strat of stratKeys) {
            const stats = byStrategy[strat];
            const roi = stats.roi !== null ? stats.roi.toFixed(1) : 'N/A';

            console.log(`  ${strat.padEnd(20)} count ${stats.count.toString().padStart(4)}, ROI ${roi.padStart(6)}%`);
        }
        console.log('');
    }

    // Edge calibration
    const calibration = summarizeEdgeCalibration(rows);
    const nonEmpty = calibration.filter(b => b.count > 0);

    if (nonEmpty.length > 0) {
        console.log('Edge calibration (avg EV vs realized):');
        for (const bucket of nonEmpty) {
            const edge = bucket.avgEdge !== null ? bucket.avgEdge.toFixed(1) : 'N/A';
            const ev = bucket.avgEV !== null ? bucket.avgEV.toFixed(1) : 'N/A';
            const realized = bucket.avgRealized !== null ? bucket.avgRealized.toFixed(1) : 'N/A';

            console.log(`  ${bucket.bucketLabel.padEnd(10)} count ${bucket.count.toString().padStart(4)}, avgEdge ${edge.padStart(6)}, avgEV ${ev.padStart(6)}, avgRealized ${realized.padStart(6)}`);
        }
    }
}

async function run() {
    const rows = await loadDataset(DATASET_PATH, LIMIT);

    if (rows.length === 0) {
        console.log('No dataset rows found. Run `npm run research:dataset` first.');
        process.exit(0);
    }

    printReport(rows);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
