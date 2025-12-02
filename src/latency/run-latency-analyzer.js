// src/latency/run-latency-analyzer.js
require('dotenv').config();
const { analyzeLatency } = require('./LatencyAnalyzer');
const { detectStaleLines } = require('./staleLineDetector');
const latencyLogger = require('./latencyLogger');
const db = require('../utils/db');
const config = require('../../config');
const wsServer = require('../websocket/ws-server');

let cycleCount = 0;
let isRunning = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initialize() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 LATENCY & STALE LINE ANALYZER');
  console.log('='.repeat(60));
  console.log(`⏱️  Window: ${config.latency.windowMs}ms`);
  console.log(`🔄 Interval: ${config.latency.intervalMs}ms`);
  console.log(`⚠️  Stale threshold: ${config.latency.staleThresholdMs}ms`);
  console.log(`📈 Min windows: ${config.latency.minWindowsPerBook}`);
  console.log('='.repeat(60));

  // Connect to database
  if (!config.database?.enabled) {
    throw new Error('Database must be enabled for latency analysis');
  }

  await db.connect();
  if (!db.connected) {
    throw new Error('Database connection failed');
  }

  console.log('\n✅ Latency analyzer initialized\n');
}

async function runCycle() {
  cycleCount++;
  const cycleStart = Date.now();

  try {
    console.log(`\n📊 LATENCY CYCLE ${cycleCount} - ${new Date().toLocaleTimeString()}`);
    console.log('─'.repeat(60));

    // Analyze latency
    const metrics = await analyzeLatency(db, config.latency.windowMs);
    
    // Filter by min windows
    const qualifiedMetrics = metrics.filter(m => 
      m.totalWindows >= config.latency.minWindowsPerBook
    );

    // Broadcast latency metrics
    qualifiedMetrics.forEach(metric => {
      wsServer.sendMessage('latency_metric', metric);
    });

    console.log(`📈 Book latency metrics (${qualifiedMetrics.length} books):`);
    qualifiedMetrics
      .sort((a, b) => b.firstMoverFraction - a.firstMoverFraction)
      .forEach(m => {
        const pct = (m.firstMoverFraction * 100).toFixed(1);
        const delay = Math.round(m.avgDelayMs);
        console.log(`   ${m.book}: ${pct}% first mover | avg delay: ${delay}ms | windows: ${m.totalWindows}`);
      });

    // Detect stale lines
    const staleLines = await detectStaleLines(db, config.latency.staleThresholdMs);
    
    console.log(`\n⚠️  Stale lines detected: ${staleLines.length}`);
    if (staleLines.length > 0) {
      staleLines.slice(0, 5).forEach(s => {
        console.log(`   ${s.book} - ${s.eventId} ${s.marketType} ${s.side}: ${Math.round(s.stalenessMs)}ms stale`);
      });
      if (staleLines.length > 5) {
        console.log(`   ... and ${staleLines.length - 5} more`);
      }
    }

    // Log to JSONL
    qualifiedMetrics.forEach(metric => {
      latencyLogger.logLatencyMetric(metric);
    });

    staleLines.forEach(staleLine => {
      latencyLogger.logStaleLine(staleLine);
    });

    const cycleDuration = Date.now() - cycleStart;
    console.log(`\n⏱️  Cycle time: ${cycleDuration}ms`);

  } catch (error) {
    console.error('❌ Cycle error:', error.message);
  }
}

async function runLoop() {
  const INTERVAL_MS = config.latency.intervalMs;

  while (isRunning) {
    const cycleStart = Date.now();

    await runCycle();

    const elapsed = Date.now() - cycleStart;
    const delay = Math.max(0, INTERVAL_MS - elapsed);

    if (delay > 0) {
      await sleep(delay);
    }
  }
}

async function shutdown() {
  console.log('\n🛑 Shutting down...');
  isRunning = false;

  if (db.connected) {
    await db.close();
  }

  console.log(`📊 Total cycles: ${cycleCount}`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  try {
    await initialize();
    isRunning = true;
    await runLoop();
  } catch (error) {
    console.error('Fatal error:', error);
    await shutdown();
  }
}

main();