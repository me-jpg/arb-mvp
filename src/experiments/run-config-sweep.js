/**
 * src/experiments/run-config-sweep.js
 * 
 * CLI tool to run config sweeps with parameter grids.
 */

const { runConfigSweep } = require('./configSweepRunner');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};

args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

const LIMIT = kwargs.limit ? parseInt(kwargs.limit, 10) : 1000;
const BOOKS = kwargs.books ? kwargs.books.split(',') : null;
const MIN_EDGE = kwargs.minEdge ? parseFloat(kwargs.minEdge) : 0.02;
const STAKE_MODES = kwargs.stakeModes ? kwargs.stakeModes.split(',') : ['flat', 'edge_linear', 'kelly_fraction'];
const ML_MODES = kwargs.mlModes ? kwargs.mlModes.split(',') : ['off', 'baseline', 'edge_plus_latency'];
const LATENCY_AWARE = kwargs.latencyAware === 'true' || kwargs.latencyAware === '1';

/**
 * Generate config grid.
 */
function generateConfigs() {
    const configs = [];

    for (const stakeMode of STAKE_MODES) {
        for (const mlMode of ML_MODES) {
            const mlEnabled = mlMode !== 'off';

            const config = {
                id: `latency=${LATENCY_AWARE ? 'on' : 'off'}+ml=${mlMode}+stake=${stakeMode}`,
                strategyOptions: {
                    latencyAware: LATENCY_AWARE,
                    minEdge: MIN_EDGE
                },
                mlScoring: {
                    enabled: mlEnabled,
                    mode: mlEnabled ? mlMode : 'baseline',
                    minScore: 0
                },
                stakeSizing: {
                    mode: stakeMode,
                    flatStake: 50,
                    kellyBaseFraction: 0.5,
                    maxStakePctBankroll: 0.02,
                    minStake: 5
                }
            };

            configs.push(config);
        }
    }

    return configs;
}

async function run() {
    console.log('=== CONFIG SWEEP REPORT ===\n');

    const configs = generateConfigs();
    console.log(`Configs: ${configs.length}`);
    console.log(`Signals limit: ${LIMIT}`);
    console.log(`Min edge: ${(MIN_EDGE * 100).toFixed(1)}%`);
    console.log(`Stake modes: ${STAKE_MODES.join(', ')}`);
    console.log(`ML modes: ${ML_MODES.join(', ')}`);
    console.log(`Latency aware: ${LATENCY_AWARE}`);

    const result = await runConfigSweep(configs, {
        limit: LIMIT,
        books: BOOKS,
        minEdge: MIN_EDGE
    });

    console.log('\n=== RESULTS ===\n');

    // Top by ROI
    if (result.runs.length > 0) {
        const sorted = result.runs
            .filter(r => r.metrics && r.metrics.roi !== undefined)
            .sort((a, b) => b.metrics.roi - a.metrics.roi);

        if (sorted.length > 0) {
            console.log('Top by ROI:');
            sorted.slice(0, 3).forEach((r, i) => {
                const m = r.metrics;
                console.log(`  ${i + 1}) ${r.id}`);
                console.log(`     ROI ${(m.roi * 100).toFixed(1)}%  profit ${m.realizedProfit >= 0 ? '+' : ''}$${m.realizedProfit.toFixed(0)}  fills ${m.fills}`);
            });
            console.log('');
        }

        // Detailed results
        console.log('Detailed Results:');
        for (const run of sorted.slice(0, 5)) {
            const m = run.metrics;
            console.log(`\n  ${run.id}:`);
            console.log(`    stakeSizing:   ${run.config.stakeSizing.mode}`);
            console.log(`    mlScoring:     ${run.config.mlScoring.enabled ? run.config.mlScoring.mode : 'off'}`);
            console.log(`    latencyAware:  ${run.config.strategyOptions.latencyAware}`);
            console.log(`    signalsUsed:   ${m.signalsUsed}`);
            console.log(`    selected:      ${m.signalsSelected}`);
            console.log(`    orders:        ${m.orders}`);
            console.log(`    fills:         ${m.fills}`);
            console.log(`    totalStake:    $${m.totalStake.toFixed(2)}`);
            console.log(`    profit:        ${m.realizedProfit >= 0 ? '+' : ''}$${m.realizedProfit.toFixed(2)}`);
            console.log(`    ROI:           ${(m.roi * 100).toFixed(1)}%`);
            console.log(`    hitRate:       ${(m.hitRate * 100).toFixed(1)}%`);
            console.log(`    avgEdge:       ${(m.avgEdge * 100).toFixed(2)}%`);
        }
    } else {
        console.log('No successful runs.');
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
