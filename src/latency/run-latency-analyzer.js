// src/latency/run-latency-analyzer.js
// CLI entry point for Phase 3 latency analysis
// Usage:
//   node src/latency/run-latency-analyzer.js --once    # Run once and exit
//   node src/latency/run-latency-analyzer.js --daemon  # Run in loop (default)

require('dotenv').config();
const { analyzeLatencyForRange } = require('./latencyAnalyzer');
const { detectStaleLinesForRange } = require('./staleLineDetector');
const latencyLogger = require('./latencyLogger');
const db = require('../utils/db');
const config = require('../../config');

// Parse CLI args
const args = process.argv.slice(2);
const MODE_ONCE = args.includes('--once');
const MODE_DAEMON = args.includes('--daemon') || !MODE_ONCE;

let cycleCount = 0;
let isRunning = false;
let cycleInProgress = false;  // FIXED: Track if cycle is running for graceful shutdown
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initialize() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PHASE 3: LATENCY & STALE LINE ANALYZER');
  console.log('='.repeat(60));
  console.log(`🔧 Mode: ${MODE_ONCE ? 'once' : 'daemon'}`);
  console.log(`⏱️  Window: ${config.latency.windowMs}ms`);
  console.log(`🔄 Interval: ${config.latency.intervalMs}ms`);
  console.log(`⚠️  Stale threshold: ${config.latency.staleThresholdMs}ms`);
  console.log(`📈 Min windows: ${config.latency.minWindowsPerBook}`);
  console.log('='.repeat(60));

  // Connect to database
  if (!config.database?.enabled) {
    throw new Error('Database must be enabled for latency analysis (set DB_ENABLED=true)');
  }

  await db.connect();
  console.log('\n✅ Latency analyzer initialized\n');
}

async function runCycle() {
  cycleCount++;
  cycleInProgress = true;
  const cycleStart = Date.now();

  try {
    console.log(`\n📊 LATENCY CYCLE ${cycleCount} - ${new Date().toLocaleTimeString()}`);
    console.log('─'.repeat(60));

    // Define time range: analyze last N minutes worth of data
    // Use a reasonable lookback that won't OOM (10 minutes by default)
    const endTime = Date.now();
    const lookbackMs = Math.min(config.latency.windowMs * 20, 10 * 60 * 1000); // Max 10 min
    const startTime = endTime - lookbackMs;

    // Analyze latency - FIXED: no pre-check of db.connected, let query throw
    const latencyMetrics = await analyzeLatencyForRange(db, {
      startTime,
      endTime,
      windowMs: config.latency.windowMs
    });
    
    // Filter by min windows
    const qualifiedMetrics = latencyMetrics.filter(m => 
      m.totalWindows >= config.latency.minWindowsPerBook
    );

    console.log(`📈 Book latency metrics (${qualifiedMetrics.length} books qualified):`);
    if (qualifiedMetrics.length > 0) {
      // Sort without mutating - create copy
      [...qualifiedMetrics]
        .sort((a, b) => b.fractionFirstToMove - a.fractionFirstToMove)
        .forEach(m => {
          const firstPct = (m.fractionFirstToMove * 100).toFixed(1);
          const lastPct = (m.fractionLastToMove * 100).toFixed(1);
          const delay = m.avgDelayMsVsFastest;
          console.log(`   ${m.book}: ${firstPct}% first | ${lastPct}% last | avg delay: ${delay}ms | windows: ${m.totalWindows}`);
        });
    } else {
      console.log('   (no books met minimum window threshold)');
    }

    // Detect stale lines
    const staleLines = await detectStaleLinesForRange(db, {
      startTime,
      endTime,
      staleThresholdMs: config.latency.staleThresholdMs
    });
    
    console.log(`\n⚠️  Stale lines detected: ${staleLines.length}`);
    if (staleLines.length > 0) {
      staleLines.slice(0, 5).forEach(s => {
        const duration = Math.round(s.staleDurationMs);
        console.log(`   ${s.staleBook} stale vs ${s.referenceBook} - ${s.eventId} ${s.marketType}: ${duration}ms`);
      });
      if (staleLines.length > 5) {
        console.log(`   ... and ${staleLines.length - 5} more`);
      }
    }

    // Log to JSONL (async, non-blocking)
    latencyLogger.logLatencySummary({
      latencyMetrics: qualifiedMetrics,
      staleLines,
      cycleNumber: cycleCount
    });

    const cycleDuration = Date.now() - cycleStart;
    console.log(`\n⏱️  Cycle time: ${cycleDuration}ms`);
    
    // Calculate total windows safely
    let totalWindows = 0;
    for (const m of latencyMetrics) {
      totalWindows += m.totalWindows;
    }
    console.log(`📊 Summary: ${qualifiedMetrics.length} books, ${totalWindows} windows, ${staleLines.length} stale lines`);

    // Reset error counter on success
    consecutiveErrors = 0;
    
    return { latencyMetrics: qualifiedMetrics, staleLines };

  } catch (error) {
    consecutiveErrors++;
    console.error(`❌ Cycle error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error.message);
    
    // If too many consecutive errors, bail out
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error('🛑 Too many consecutive errors, stopping...');
      isRunning = false;
    }
    
    return { latencyMetrics: [], staleLines: [] };
  } finally {
    cycleInProgress = false;
  }
}

async function runLoop() {
  const INTERVAL_MS = config.latency.intervalMs;

  while (isRunning) {
    const cycleStart = Date.now();

    await runCycle();
    
    // Check if we should stop (could have been set by error handler)
    if (!isRunning) break;

    const elapsed = Date.now() - cycleStart;
    const delay = Math.max(0, INTERVAL_MS - elapsed);

    // FIXED: If cycle took longer than interval, log warning but don't pile up
    if (delay === 0 && elapsed > INTERVAL_MS) {
      console.warn(`⚠️  Cycle took ${elapsed}ms, longer than interval ${INTERVAL_MS}ms`);
    }

    if (delay > 0 && isRunning) {
      await sleep(delay);
    }
  }
}

async function shutdown() {
  console.log('\n🛑 Shutdown requested...');
  isRunning = false;

  // FIXED: Wait for current cycle to finish before closing DB
  if (cycleInProgress) {
    console.log('⏳ Waiting for current cycle to complete...');
    // Poll until cycle finishes (max 30 seconds)
    const maxWait = 30000;
    const start = Date.now();
    while (cycleInProgress && (Date.now() - start) < maxWait) {
      await sleep(100);
    }
    if (cycleInProgress) {
      console.warn('⚠️  Cycle did not complete in time, forcing shutdown');
    }
  }

  // Now safe to close DB
  try {
    await db.close();
  } catch (err) {
    console.error('Error closing DB:', err.message);
  }

  console.log(`📊 Total cycles: ${cycleCount}`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  try {
    await initialize();
    
    if (MODE_ONCE) {
      // Single run mode
      await runCycle();
      await shutdown();
    } else {
      // Daemon mode
      isRunning = true;
      await runLoop();
      await shutdown();
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
