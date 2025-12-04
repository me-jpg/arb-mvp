#!/usr/bin/env node
// src/signals/print-signal-summary.js
// CLI script to summarize historical signals from signals.jsonl

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const LOGS_DIR = path.join(process.cwd(), 'logs');
const SIGNALS_LOG = path.join(LOGS_DIR, 'signals.jsonl');

const DEFAULT_LIMIT = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: DEFAULT_LIMIT,
    book: null,
    type: null,
    since: null,
    verbose: false
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10) || DEFAULT_LIMIT;
    } else if (arg.startsWith('--book=')) {
      options.book = arg.split('=')[1];
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1];
    } else if (arg.startsWith('--since=')) {
      options.since = arg.split('=')[1];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Signal Summary - Analyze historical signals from logs

Usage: node src/signals/print-signal-summary.js [options]

Options:
  --limit=N           Max signals to analyze (default: ${DEFAULT_LIMIT})
  --book=NAME         Filter by primaryBook (e.g., --book=draftkings)
  --type=TYPE         Filter by signal type (e.g., --type=stale_vs_book)
  --since=ISO         Only include signals after this timestamp
  --verbose, -v       Show sample signals at the end
  --help, -h          Show this help message

Examples:
  npm run signals:summary
  npm run signals:summary -- --limit=500 --book=draftkings
  npm run signals:summary -- --since=2025-12-01T00:00:00Z --verbose
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// JSONL Reading
// ─────────────────────────────────────────────────────────────────────────────

function readSignalsFromFile(filepath, limit) {
  if (!fs.existsSync(filepath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    // Take last N lines
    const lastLines = lines.slice(-limit);
    
    // Parse JSON, skip malformed lines
    const signals = [];
    for (const line of lastLines) {
      try {
        const obj = JSON.parse(line);
        // Basic validation - must have id, type, edgeEstimate
        if (obj && obj.id && obj.type && typeof obj.edgeEstimate === 'number') {
          signals.push(obj);
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
    
    return signals;
  } catch (err) {
    console.error(`Error reading ${filepath}:`, err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtering
// ─────────────────────────────────────────────────────────────────────────────

function filterSignals(signals, options) {
  let filtered = signals;

  if (options.book) {
    filtered = filtered.filter(s => s.primaryBook === options.book);
  }

  if (options.type) {
    filtered = filtered.filter(s => s.type === options.type);
  }

  if (options.since) {
    const sinceTime = new Date(options.since).getTime();
    if (!isNaN(sinceTime)) {
      filtered = filtered.filter(s => {
        const createdAt = new Date(s.createdAt).getTime();
        return !isNaN(createdAt) && createdAt >= sinceTime;
      });
    }
  }

  return filtered;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Computation
// ─────────────────────────────────────────────────────────────────────────────

function safeEdge(edge) {
  if (typeof edge !== 'number' || !Number.isFinite(edge)) return null;
  return edge;
}

function safeConfidence(conf) {
  if (typeof conf !== 'number' || !Number.isFinite(conf)) return null;
  return conf;
}

function computeGlobalStats(signals) {
  const eventIds = new Set();
  const books = new Set();
  const types = new Set();
  
  let totalEdge = 0;
  let edgeCount = 0;
  let minEdge = Infinity;
  let maxEdge = -Infinity;
  
  let totalConf = 0;
  let confCount = 0;

  for (const sig of signals) {
    if (sig.eventId) eventIds.add(sig.eventId);
    if (sig.primaryBook) books.add(sig.primaryBook);
    if (sig.type) types.add(sig.type);

    const edge = safeEdge(sig.edgeEstimate);
    if (edge !== null) {
      totalEdge += edge;
      edgeCount++;
      if (edge > 0 && edge < minEdge) minEdge = edge;
      if (edge > maxEdge) maxEdge = edge;
    }

    const conf = safeConfidence(sig.confidence);
    if (conf !== null) {
      totalConf += conf;
      confCount++;
    }
  }

  return {
    totalSignals: signals.length,
    distinctEvents: eventIds.size,
    booksSeen: [...books],
    typesSeen: [...types],
    avgEdgeEstimate: edgeCount > 0 ? totalEdge / edgeCount : 0,
    minEdgeEstimate: minEdge === Infinity ? 0 : minEdge,
    maxEdgeEstimate: maxEdge === -Infinity ? 0 : maxEdge,
    avgConfidence: confCount > 0 ? totalConf / confCount : 0
  };
}

function computePerBookStats(signals) {
  const bookStats = new Map();

  for (const sig of signals) {
    const book = sig.primaryBook || 'unknown';
    if (!bookStats.has(book)) {
      bookStats.set(book, { count: 0, totalEdge: 0, edgeCount: 0, minEdge: Infinity, maxEdge: -Infinity, totalConf: 0, confCount: 0 });
    }
    const stats = bookStats.get(book);
    stats.count++;

    const edge = safeEdge(sig.edgeEstimate);
    if (edge !== null) {
      stats.totalEdge += edge;
      stats.edgeCount++;
      if (edge > 0 && edge < stats.minEdge) stats.minEdge = edge;
      if (edge > stats.maxEdge) stats.maxEdge = edge;
    }

    const conf = safeConfidence(sig.confidence);
    if (conf !== null) {
      stats.totalConf += conf;
      stats.confCount++;
    }
  }

  // Convert to array with computed averages
  const result = [];
  for (const [book, stats] of bookStats) {
    result.push({
      book,
      signalCount: stats.count,
      avgEdge: stats.edgeCount > 0 ? stats.totalEdge / stats.edgeCount : 0,
      minEdge: stats.minEdge === Infinity ? 0 : stats.minEdge,
      maxEdge: stats.maxEdge === -Infinity ? 0 : stats.maxEdge,
      avgConf: stats.confCount > 0 ? stats.totalConf / stats.confCount : 0
    });
  }

  // Sort by signal count descending
  return result.sort((a, b) => b.signalCount - a.signalCount);
}

function computePerTypeStats(signals) {
  const typeStats = new Map();

  for (const sig of signals) {
    const type = sig.type || 'unknown';
    if (!typeStats.has(type)) {
      typeStats.set(type, { count: 0, totalEdge: 0, edgeCount: 0, totalConf: 0, confCount: 0 });
    }
    const stats = typeStats.get(type);
    stats.count++;

    const edge = safeEdge(sig.edgeEstimate);
    if (edge !== null) {
      stats.totalEdge += edge;
      stats.edgeCount++;
    }

    const conf = safeConfidence(sig.confidence);
    if (conf !== null) {
      stats.totalConf += conf;
      stats.confCount++;
    }
  }

  const result = [];
  for (const [type, stats] of typeStats) {
    result.push({
      type,
      signalCount: stats.count,
      avgEdge: stats.edgeCount > 0 ? stats.totalEdge / stats.edgeCount : 0,
      avgConf: stats.confCount > 0 ? stats.totalConf / stats.confCount : 0
    });
  }

  return result.sort((a, b) => b.signalCount - a.signalCount);
}

function computeEdgeDistribution(signals) {
  const buckets = [
    { label: '< 1%', min: -Infinity, max: 0.01, count: 0 },
    { label: '1–2%', min: 0.01, max: 0.02, count: 0 },
    { label: '2–3%', min: 0.02, max: 0.03, count: 0 },
    { label: '3–5%', min: 0.03, max: 0.05, count: 0 },
    { label: '5–10%', min: 0.05, max: 0.10, count: 0 },
    { label: '≥ 10%', min: 0.10, max: Infinity, count: 0 }
  ];

  let validCount = 0;

  for (const sig of signals) {
    const edge = safeEdge(sig.edgeEstimate);
    if (edge === null) continue;
    
    validCount++;
    for (const bucket of buckets) {
      if (edge >= bucket.min && edge < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  // Add percentages
  for (const bucket of buckets) {
    bucket.percent = validCount > 0 ? (bucket.count / validCount) * 100 : 0;
  }

  return buckets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pad(str, len, align = 'left') {
  str = String(str);
  if (align === 'right') {
    return str.padStart(len);
  }
  return str.padEnd(len);
}

function pct(val) {
  return (val * 100).toFixed(1) + '%';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const options = parseArgs();

  console.log(`
======================================================================
📊 SIGNAL SUMMARY
======================================================================
Reading from: ${SIGNALS_LOG}
Limit: ${options.limit}${options.book ? `\nBook filter: ${options.book}` : ''}${options.type ? `\nType filter: ${options.type}` : ''}${options.since ? `\nSince: ${options.since}` : ''}
======================================================================
`);

  // Load signals
  const allSignals = readSignalsFromFile(SIGNALS_LOG, options.limit);
  
  if (allSignals.length === 0) {
    console.log(`⚠️  No signals found in ${SIGNALS_LOG}

To generate signals:
1. Run the HF tracker: npm run hf:run
2. Run the latency analyzer: npm run latency:once
3. Run signal analysis: npm run signals:analyze
4. Re-run this summary: npm run signals:summary
`);
    return;
  }

  console.log(`📥 Loaded ${allSignals.length} signals from file`);

  // Filter
  const signals = filterSignals(allSignals, options);

  if (signals.length === 0) {
    console.log(`⚠️  No signals match the filter criteria.`);
    return;
  }

  console.log(`📊 Analyzing ${signals.length} signals after filtering\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // Global Stats
  // ─────────────────────────────────────────────────────────────────────────
  const global = computeGlobalStats(signals);

  console.log(`======================================================================
  GLOBAL STATS
======================================================================
Total Signals:     ${global.totalSignals}
Distinct Events:   ${global.distinctEvents}
Books Seen:        ${global.booksSeen.join(', ') || 'none'}
Types Seen:        ${global.typesSeen.join(', ') || 'none'}

Avg Edge:          ${pct(global.avgEdgeEstimate)}
Min Edge:          ${pct(global.minEdgeEstimate)}
Max Edge:          ${pct(global.maxEdgeEstimate)}
Avg Confidence:    ${(global.avgConfidence * 100).toFixed(1)}%
`);

  // ─────────────────────────────────────────────────────────────────────────
  // Per-Book Stats
  // ─────────────────────────────────────────────────────────────────────────
  const bookStats = computePerBookStats(signals);

  if (bookStats.length > 0) {
    console.log(`======================================================================
  PER-BOOK SUMMARY
======================================================================
${pad('Book', 14)} ${pad('Signals', 8, 'right')} ${pad('Avg Edge', 10, 'right')} ${pad('Min Edge', 10, 'right')} ${pad('Max Edge', 10, 'right')} ${pad('Avg Conf', 10, 'right')}
----------------------------------------------------------------------`);
    
    for (const s of bookStats) {
      console.log(`${pad(s.book, 14)} ${pad(s.signalCount, 8, 'right')} ${pad(pct(s.avgEdge), 10, 'right')} ${pad(pct(s.minEdge), 10, 'right')} ${pad(pct(s.maxEdge), 10, 'right')} ${pad((s.avgConf * 100).toFixed(0) + '%', 10, 'right')}`);
    }
    console.log('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Per-Type Stats
  // ─────────────────────────────────────────────────────────────────────────
  const typeStats = computePerTypeStats(signals);

  if (typeStats.length > 0) {
    console.log(`======================================================================
  PER-TYPE SUMMARY
======================================================================
${pad('Type', 20)} ${pad('Signals', 8, 'right')} ${pad('Avg Edge', 10, 'right')} ${pad('Avg Conf', 10, 'right')}
----------------------------------------------------------------------`);
    
    for (const s of typeStats) {
      console.log(`${pad(s.type, 20)} ${pad(s.signalCount, 8, 'right')} ${pad(pct(s.avgEdge), 10, 'right')} ${pad((s.avgConf * 100).toFixed(0) + '%', 10, 'right')}`);
    }
    console.log('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Distribution
  // ─────────────────────────────────────────────────────────────────────────
  const edgeDist = computeEdgeDistribution(signals);

  console.log(`======================================================================
  EDGE DISTRIBUTION
======================================================================
${pad('Bucket', 12)} ${pad('Count', 8, 'right')} ${pad('Percent', 10, 'right')}
----------------------------------------------------------------------`);

  for (const b of edgeDist) {
    const bar = '█'.repeat(Math.round(b.percent / 5)); // Simple bar chart
    console.log(`${pad(b.label, 12)} ${pad(b.count, 8, 'right')} ${pad(b.percent.toFixed(1) + '%', 10, 'right')}  ${bar}`);
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // Verbose: Sample Signals
  // ─────────────────────────────────────────────────────────────────────────
  if (options.verbose) {
    const samples = signals.slice(-5); // Last 5 signals
    console.log(`======================================================================
  SAMPLE SIGNALS (last ${samples.length})
======================================================================`);
    
    for (const sig of samples) {
      // Compact view
      const compact = {
        createdAt: sig.createdAt,
        type: sig.type,
        eventId: sig.eventId ? sig.eventId.slice(0, 40) : null,
        primaryBook: sig.primaryBook,
        referenceBook: sig.referenceBook,
        edgeEstimate: sig.edgeEstimate,
        confidence: sig.confidence
      };
      console.log(JSON.stringify(compact, null, 2));
      console.log('');
    }
  }

  console.log(`💡 Tip: Use --book=NAME, --type=TYPE, --since=ISO to filter, --verbose to see samples.
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

main();

