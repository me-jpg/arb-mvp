#!/usr/bin/env node
// src/signals/run-strategy-sweep.js
// CLI for running strategy grid search over historical signals

const { runStrategySweep, getGridInfo } = require('./strategySweep');
const { getSignalsLogPath } = require('./signalLoader');

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: 2000,
    book: null,
    type: null
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10) || 2000;
    } else if (arg.startsWith('--book=')) {
      options.book = arg.split('=')[1];
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: node run-strategy-sweep.js [options]

Options:
  --limit=N     Max signals to load (default: 2000)
  --book=NAME   Filter by primaryBook
  --type=TYPE   Filter by signal type (pure_arb, stale_vs_book, etc.)
  --help        Show this help

Example:
  npm run signals:sweep
  npm run signals:sweep -- --limit=500 --type=pure_arb
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function padRight(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function padLeft(str, len) {
  const s = String(str);
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

function formatPercent(val, decimals = 2) {
  if (!Number.isFinite(val)) return '---';
  return (val * 100).toFixed(decimals) + '%';
}

function formatMoney(val, decimals = 2) {
  if (!Number.isFinite(val)) return '---';
  return '$' + val.toFixed(decimals);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const options = parseArgs();

  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        🎛️  STRATEGY GRID SEARCH                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  // Show grid info
  const gridInfo = getGridInfo();
  console.log(`📊 Grid dimensions:`);
  console.log(`   minEdge:            ${gridInfo.dimensions.minEdge.map(v => formatPercent(v, 0)).join(', ')}`);
  console.log(`   stakeMode:          ${gridInfo.dimensions.stakeMode.join(', ')}`);
  console.log(`   maxSignalsPerEvent: ${gridInfo.dimensions.maxSignalsPerEvent.join(', ')}`);
  console.log(`   maxTotalStakePerBook: ${gridInfo.dimensions.maxTotalStakePerBook.map(v => '$' + v).join(', ')}`);
  console.log(`   Total configs: ${gridInfo.totalConfigs}`);

  console.log(`\n📂 Signals source: ${getSignalsLogPath()}`);
  console.log(`   Pre-filters: limit=${options.limit}${options.book ? ` book=${options.book}` : ''}${options.type ? ` type=${options.type}` : ''}`);

  // Run sweep
  const { loadedSignals, gridSize, results } = runStrategySweep(options);

  console.log(`\n📈 Loaded signals: ${loadedSignals}`);

  if (loadedSignals === 0) {
    console.log(`\n⚠️  No signals found. Run HF tracker + signals:analyze first.`);
    console.log(`   See: docs/LATENCY_DEMO_RUNBOOK.md`);
    process.exit(0);
  }

  if (results.length === 0) {
    console.log(`\n⚠️  No strategy results. Grid may be empty.`);
    process.exit(0);
  }

  // Check if all results have zero selections
  const totalSelected = results.reduce((sum, r) => sum + r.metrics.selectedSignals, 0);
  if (totalSelected === 0) {
    console.log(`\n⚠️  All configs selected 0 signals. Consider lowering minEdge threshold.`);
  }

  // Print results table
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`  CONFIG                                               SEL   STAKE        EV    EV/STAKE`);
  console.log(`${'─'.repeat(90)}`);

  for (const r of results) {
    const cfg = r.config;
    const m = r.metrics;

    // Format config key: "min=2% flat perEvt=2 perBook=5000"
    const minEdgeStr = padRight(`min=${(cfg.minEdge * 100).toFixed(0)}%`, 7);
    const stakeModeStr = padRight(cfg.stakeMode.slice(0, 6), 7);
    const perEvtStr = padRight(`pE=${cfg.maxSignalsPerEvent}`, 5);
    const perBookStr = padRight(`pB=${cfg.maxTotalStakePerBook}`, 9);
    const configStr = `${minEdgeStr} ${stakeModeStr} ${perEvtStr} ${perBookStr}`;

    // Format metrics
    const selStr = padLeft(m.selectedSignals, 5);
    const stakeStr = padLeft(formatMoney(m.totalStake, 2), 10);
    const evStr = padLeft(formatMoney(m.expectedValue, 2), 10);
    const evPerStakeStr = padLeft(formatPercent(m.evPerStake, 2), 9);

    console.log(`  ${padRight(configStr, 50)} ${selStr} ${stakeStr} ${evStr} ${evPerStakeStr}`);
  }

  console.log(`${'═'.repeat(90)}`);

  // Summary
  const bestResult = results[0];
  if (bestResult && bestResult.metrics.expectedValue > 0) {
    console.log(`\n🏆 Best config by EV:`);
    console.log(`   ${bestResult.config._gridKey}`);
    console.log(`   Selected: ${bestResult.metrics.selectedSignals} signals`);
    console.log(`   Stake: ${formatMoney(bestResult.metrics.totalStake)}`);
    console.log(`   EV: ${formatMoney(bestResult.metrics.expectedValue)}`);
    console.log(`   EV/Stake: ${formatPercent(bestResult.metrics.evPerStake)}`);
  }

  // Best by EV/Stake
  const sortedByEfficiency = [...results].sort((a, b) => b.metrics.evPerStake - a.metrics.evPerStake);
  const bestEfficiency = sortedByEfficiency[0];
  if (bestEfficiency && bestEfficiency.metrics.evPerStake > 0 && bestEfficiency !== bestResult) {
    console.log(`\n🎯 Best config by EV/Stake (capital efficiency):`);
    console.log(`   ${bestEfficiency.config._gridKey}`);
    console.log(`   Selected: ${bestEfficiency.metrics.selectedSignals} signals`);
    console.log(`   Stake: ${formatMoney(bestEfficiency.metrics.totalStake)}`);
    console.log(`   EV: ${formatMoney(bestEfficiency.metrics.expectedValue)}`);
    console.log(`   EV/Stake: ${formatPercent(bestEfficiency.metrics.evPerStake)}`);
  }

  console.log(`\n💡 Tip: Use --type=pure_arb or --type=stale_vs_book to segment analysis.`);
}

main();

