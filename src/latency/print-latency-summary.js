#!/usr/bin/env node
// src/latency/print-latency-summary.js
// CLI dashboard that reads JSONL logs and prints human-friendly latency summary
//
// Usage:
//   node src/latency/print-latency-summary.js
//   node src/latency/print-latency-summary.js --metrics-only
//   node src/latency/print-latency-summary.js --stale-only
//   node src/latency/print-latency-summary.js --limit=500

const fs = require('fs');
const path = require('path');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function getFlagValue(flag, defaultValue) {
  const prefix = `${flag}=`;
  const arg = args.find(a => a.startsWith(prefix));
  if (arg) {
    const val = parseInt(arg.slice(prefix.length), 10);
    return isNaN(val) ? defaultValue : val;
  }
  return defaultValue;
}

const METRICS_ONLY = hasFlag('--metrics-only');
const STALE_ONLY = hasFlag('--stale-only');
const LIMIT = getFlagValue('--limit', 200);

const SHOW_METRICS = !STALE_ONLY;
const SHOW_STALE = !METRICS_ONLY;

// ============================================================================
// File Paths
// ============================================================================

const LOGS_DIR = path.join(process.cwd(), 'logs');
const METRICS_FILE = path.join(LOGS_DIR, 'latency-metrics.jsonl');
const STALE_FILE = path.join(LOGS_DIR, 'stale-lines.jsonl');

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Read last N non-empty lines from a file, parse as JSON
 * Returns array of parsed objects (skips malformed lines with warning)
 */
function readLastNLines(filepath, n) {
  if (!fs.existsSync(filepath)) {
    return { exists: false, lines: [] };
  }

  let content;
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch (err) {
    console.warn(`⚠️  Could not read ${path.basename(filepath)}: ${err.message}`);
    return { exists: true, lines: [] };
  }

  if (!content.trim()) {
    return { exists: true, lines: [] };
  }

  const allLines = content.trim().split('\n').filter(line => line.trim());
  const lastN = allLines.slice(-n);

  const parsed = [];
  let malformedCount = 0;

  for (const line of lastN) {
    try {
      parsed.push(JSON.parse(line));
    } catch (err) {
      malformedCount++;
    }
  }

  if (malformedCount > 0) {
    console.warn(`⚠️  Skipped ${malformedCount} malformed JSON line(s) in ${path.basename(filepath)}`);
  }

  return { exists: true, lines: parsed };
}

/**
 * Pad string to fixed width (left-aligned by default)
 */
function pad(str, width, alignRight = false) {
  const s = String(str);
  if (s.length >= width) return s;
  const padding = ' '.repeat(width - s.length);
  return alignRight ? padding + s : s + padding;
}

/**
 * Format number with fixed decimal places
 */
function fmt(num, decimals = 2) {
  if (num === undefined || num === null || isNaN(num)) return '-';
  return num.toFixed(decimals);
}

// ============================================================================
// Metrics Summary
// ============================================================================

function printMetricsSummary() {
  console.log('\n' + '='.repeat(70));
  console.log(`  LATENCY METRICS SUMMARY (last ${LIMIT} metric rows)`);
  console.log('='.repeat(70));

  const { exists, lines } = readLastNLines(METRICS_FILE, LIMIT);

  if (!exists) {
    console.log('\n❌ File not found: logs/latency-metrics.jsonl');
    console.log('   Run the latency analyzer first: node src/latency/run-latency-analyzer.js --once\n');
    return;
  }

  if (lines.length === 0) {
    console.log('\n📭 No latency metrics found in recent data.\n');
    return;
  }

  // Aggregate per book
  const bookStats = {};

  for (const row of lines) {
    const book = row.book;
    if (!book) continue;

    if (!bookStats[book]) {
      bookStats[book] = {
        observations: 0,
        totalDelay: 0,
        totalFirst: 0,
        totalLast: 0
      };
    }

    const stats = bookStats[book];
    stats.observations++;
    stats.totalDelay += row.avgDelayMsVsFastest || 0;
    stats.totalFirst += row.fractionFirstToMove || 0;
    stats.totalLast += row.fractionLastToMove || 0;
  }

  // Compute averages and speed score
  const results = Object.entries(bookStats).map(([book, stats]) => {
    const avgDelay = stats.totalDelay / stats.observations;
    const avgFirst = stats.totalFirst / stats.observations;
    const avgLast = stats.totalLast / stats.observations;
    const speedScore = avgFirst - avgLast;

    return {
      book,
      observations: stats.observations,
      avgDelay,
      avgFirst,
      avgLast,
      speedScore
    };
  });

  // Sort by speedScore DESC (fastest first)
  results.sort((a, b) => b.speedScore - a.speedScore);

  // Print table
  console.log('');
  console.log(
    pad('Book', 14) +
    pad('Obs', 6, true) +
    pad('Avg Delay', 12, true) +
    pad('First%', 10, true) +
    pad('Last%', 10, true) +
    pad('SpeedScore', 12, true)
  );
  console.log('-'.repeat(70));

  for (const r of results) {
    console.log(
      pad(r.book, 14) +
      pad(r.observations, 6, true) +
      pad(fmt(r.avgDelay, 0) + 'ms', 12, true) +
      pad((r.avgFirst * 100).toFixed(1) + '%', 10, true) +
      pad((r.avgLast * 100).toFixed(1) + '%', 10, true) +
      pad(fmt(r.speedScore, 3), 12, true)
    );
  }

  console.log('');
  console.log(`📊 Total metric rows analyzed: ${lines.length}`);
  console.log('');
}

// ============================================================================
// Stale Lines Summary
// ============================================================================

function printStaleSummary() {
  console.log('\n' + '='.repeat(70));
  console.log(`  STALE LINE SUMMARY (last ${LIMIT} stale events)`);
  console.log('='.repeat(70));

  const { exists, lines } = readLastNLines(STALE_FILE, LIMIT);

  if (!exists) {
    console.log('\n📭 File not found: logs/stale-lines.jsonl');
    console.log('   No stale lines have been detected yet (this is good!).\n');
    return;
  }

  if (lines.length === 0) {
    console.log('\n✅ No stale lines found in recent data. All books are responsive!\n');
    return;
  }

  // Aggregate per staleBook
  const bookStats = {};

  for (const row of lines) {
    const book = row.staleBook;
    if (!book) continue;

    if (!bookStats[book]) {
      bookStats[book] = {
        staleCount: 0,
        totalDuration: 0
      };
    }

    const stats = bookStats[book];
    stats.staleCount++;
    stats.totalDuration += row.staleDurationMs || 0;
  }

  // Compute averages
  const results = Object.entries(bookStats).map(([book, stats]) => ({
    book,
    staleCount: stats.staleCount,
    avgDuration: stats.totalDuration / stats.staleCount
  }));

  // Sort by staleCount DESC (most stale first)
  results.sort((a, b) => b.staleCount - a.staleCount);

  // Print table
  console.log('');
  console.log(
    pad('Book', 14) +
    pad('Stale Events', 14, true) +
    pad('Avg Duration (ms)', 20, true)
  );
  console.log('-'.repeat(50));

  for (const r of results) {
    console.log(
      pad(r.book, 14) +
      pad(r.staleCount, 14, true) +
      pad(fmt(r.avgDuration, 0), 20, true)
    );
  }

  console.log('');
  console.log(`⚠️  Total stale events analyzed: ${lines.length}`);
  console.log('');
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('\n📈 LATENCY DASHBOARD');
  console.log(`   Reading from: ${LOGS_DIR}`);

  if (SHOW_METRICS) {
    printMetricsSummary();
  }

  if (SHOW_STALE) {
    printStaleSummary();
  }

  // Help hint
  if (!METRICS_ONLY && !STALE_ONLY) {
    console.log('💡 Tip: Use --metrics-only, --stale-only, or --limit=N to customize output.');
  }
}

main();

