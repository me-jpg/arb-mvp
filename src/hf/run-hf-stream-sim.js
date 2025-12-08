/**
 * src/hf/run-hf-stream-sim.js
 * 
 * CLI to simulate HF streaming from logs.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../../config');
const { runHfStreamFromEvents } = require('./hfStreamEngine');

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
const WINDOW_MS = parseInt(kwargs.windowMs) || 60000;

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
    console.log('[HF-STREAM] Starting simulation...');

    const absolutePath = path.isAbsolute(LOG_FILE)
        ? LOG_FILE
        : path.resolve(process.cwd(), LOG_FILE);

    if (!fs.existsSync(absolutePath)) {
        console.error(`Log file not found: ${absolutePath}`);
        process.exit(0);
    }

    // Load events
    const events = await streamReadJsonl(absolutePath, LIMIT);
    console.log(`[HF-STREAM] Loaded ${events.length} events`);

    if (events.length === 0) {
        console.log('[HF-STREAM] No events to process');
        process.exit(0);
    }

    // Track progress
    let processedCount = 0;
    const marketVolatility = new Map(); // marketId -> volatilityScore
    let topVolMarket = null;
    let topVolScore = 0;

    const onTick = ({ event, feature, marketState }) => {
        processedCount++;

        // Update market volatility tracking
        const marketId = `${marketState.eventId}_${marketState.marketType}_${marketState.marketKey || 'default'}`;
        marketVolatility.set(marketId, marketState.volatilityScore);

        if (marketState.volatilityScore > topVolScore) {
            topVolScore = marketState.volatilityScore;
            topVolMarket = marketId;
        }

        // Print progress every 1000 events
        if (processedCount % 1000 === 0) {
            console.log(`[HF-STREAM] events=${processedCount} markets=${marketVolatility.size} topVolMarket=${topVolMarket || 'N/A'} vol=${topVolScore.toFixed(2)}`);
        }
    };

    const onBatchEnd = ({ count, lastTimestamp }) => {
        console.log('\n=== HF STREAM SIM SUMMARY ===');
        console.log(`Events processed: ${count}`);
        console.log(`Unique markets: ${marketVolatility.size}`);

        if (topVolMarket) {
            console.log(`Top volatile market: ${topVolMarket} (volatility ${topVolScore.toFixed(2)})`);
        } else {
            console.log('No volatile markets detected');
        }
    };

    // Run stream
    runHfStreamFromEvents(events, {
        windowMs: WINDOW_MS,
        onTick,
        onBatchEnd
    });
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
