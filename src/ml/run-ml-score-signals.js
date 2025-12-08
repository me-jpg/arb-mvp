/**
 * src/ml/run-ml-score-signals.js
 * 
 * CLI to inspect ML scoring on historical signals.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { scoreBatch } = require('./modelAdapter');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};

args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const SIGNALS_PATH = kwargs.signals || path.join(process.cwd(), 'logs', 'signals.jsonl');
const LIMIT = kwargs.limit ? parseInt(kwargs.limit, 10) : Infinity;
const MODE = kwargs.mode || 'baseline';
const MIN_SCORE = kwargs.minScore ? parseFloat(kwargs.minScore) : null;

/**
 * Stream-read JSONL file.
 */
async function streamReadJsonl(filePath, limit = Infinity) {
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
            if (count >= limit) break;
        } catch (e) {
            // Skip malformed
        }
    }

    return results;
}

async function run() {
    console.log('=== ML SIGNAL SCORE REPORT ===\n');

    // Load signals
    const signals = await streamReadJsonl(SIGNALS_PATH, LIMIT);
    console.log(`Signals loaded: ${signals.length}`);

    if (signals.length === 0) {
        console.log('No signals found.');
        process.exit(0);
    }

    // Convert to ML examples
    const examples = signals.map(sig => ({
        id: sig.signalId || sig.id || 'unknown',
        features: {
            edgeEstimate: sig.edgeEstimate ?? null,
            bookAvgLagMs: sig.metadata?.bookAvgLagMs ?? null,
            marketVolatilityScore: sig.metadata?.volatilityScore ?? sig.volatilityScore ?? null,
            stakePlanned: sig.stakePlanned ?? sig.strategyStake ?? null
        }
    }));

    // Score batch
    const scored = scoreBatch(examples, { mode: MODE });
    console.log(`Scored: ${scored.length}\n`);

    // Filter by minScore if provided
    let passing = scored;
    if (MIN_SCORE !== null) {
        passing = scored.filter(s => s.score >= MIN_SCORE);
        console.log(`Passing minScore (${MIN_SCORE}): ${passing.length}\n`);
    }

    // Compute stats
    if (scored.length > 0) {
        const scores = scored.map(s => s.score);
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

        console.log('Score stats:');
        console.log(`  min: ${min.toFixed(2)}`);
        console.log(`  max: ${max.toFixed(2)}`);
        console.log(`  avg: ${avg.toFixed(2)}\n`);
    }

    // Show top 5
    if (scored.length > 0) {
        const sorted = [...scored].sort((a, b) => b.score - a.score).slice(0, 5);
        console.log('Top 5:');
        for (const item of sorted) {
            const edge = item.rawFeatures.edgeEstimate ?? 'N/A';
            const lag = item.rawFeatures.bookAvgLagMs ?? 'N/A';
            console.log(`  signal ${item.id.padEnd(15)} score ${item.score.toFixed(2).padStart(6)}  edge ${typeof edge === 'number' ? edge.toFixed(2) : edge}  bookAvgLagMs ${lag}`);
        }
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
