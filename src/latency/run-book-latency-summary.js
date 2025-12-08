/**
 * src/latency/run-book-latency-summary.js
 * 
 * CLI to generate book latency stats from line-change logs.
 * 
 * Usage:
 *   node src/latency/run-book-latency-summary.js --file=logs/line-changes.jsonl --limit=50000
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { buildBookLatencyStats } = require('./bookLatencyModel');

// --- Argument Parsing ---
const args = process.argv.slice(2);
const kwargs = {};
args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const LOG_FILE = kwargs.file || 'logs/line-changes.jsonl';
const LIMIT = parseInt(kwargs.limit) || Infinity;
const FILTER_BOOKS = kwargs.books ? kwargs.books.split(',') : null;

async function run() {
    console.log('=== BOOK LATENCY SUMMARY ===');
    console.log(`Reading from: ${LOG_FILE}`);
    console.log(`Limit: ${LIMIT === Infinity ? 'None' : LIMIT}`);
    if (FILTER_BOOKS) console.log(`Books filter: ${FILTER_BOOKS.join(', ')}`);
    console.log('--------------------------------------------------');

    const absolutePath = path.isAbsolute(LOG_FILE)
        ? LOG_FILE
        : path.resolve(process.cwd(), LOG_FILE);

    if (!fs.existsSync(absolutePath)) {
        console.error(`Error: File not found at ${absolutePath}`);
        process.exit(1);
    }

    const events = [];
    let lineCount = 0;

    try {
        const fileStream = fs.createReadStream(absolutePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const event = JSON.parse(line);

                // Normalize partial logs if needed, but assuming standard format
                // Check filters
                if (FILTER_BOOKS && !FILTER_BOOKS.includes(event.book)) {
                    continue;
                }

                // Ensure required fields
                if (!event.eventId || !event.book || !event.marketType) {
                    // skip malformed
                    continue;
                }

                // Use timestamp or detected_at
                if (!event.timestamp && !event.detected_at) continue;

                events.push(event);
                lineCount++;

                if (lineCount >= LIMIT) break;

            } catch (e) {
                // ignore bad lines
            }
        }
    } catch (err) {
        console.error('Error reading log file:', err.message);
        process.exit(1);
    }

    console.log(`Processed ${events.length} events from ${lineCount} lines.`);
    console.log('Calculating stats...\n');

    // Run Model
    const stats = buildBookLatencyStats(events);

    // Print Results
    if (stats.totalSamples < 100) {
        console.warn(`WARNING: Low sample count (${stats.totalSamples}). Results may be noisy.\n`);
    }

    console.log(`Total Samples (Book Reactions): ${stats.totalSamples}`);
    console.log('--------------------------------------------------');
    // Sort books by average lag (lowest/most negative first = fastest)
    const sortedBooks = Object.entries(stats.byBook).sort((a, b) => a[1].avgLagMs - b[1].avgLagMs);

    // Format Table
    // Name | AvgLag | MedianLag | Samples
    console.log('Book          | Avg Lag (ms) | Median (ms) | Samples');
    console.log('--------------|--------------|-------------|--------');

    for (const [book, data] of sortedBooks) {
        const name = book.padEnd(13, ' ');
        const avg = `${data.avgLagMs > 0 ? '+' : ''}${data.avgLagMs}`.padEnd(12, ' ');
        const med = `${data.medianLagMs > 0 ? '+' : ''}${data.medianLagMs}`.padEnd(11, ' ');
        console.log(`${name} | ${avg} | ${med} | ${data.sampleCount}`);
    }

    console.log('--------------------------------------------------');
    console.log('Note: Negative lag means the book is typically faster than the group average start time.');
    console.log('(Specifically: lag = MyTime - FirstMoverTime. So First Mover has 0ms lag. Lower avg = more often First Mover).');

}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
