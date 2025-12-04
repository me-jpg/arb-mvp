#!/usr/bin/env node
// src/server/metricsServer.js
// Lightweight HTTP API for signal and latency metrics

const http = require('http');
const url = require('url');
const { loadSignals, getSignalsLogPath } = require('../signals/signalLoader');
const { generateSummary } = require('../signals/signalSummaryCore');
const { applyStrategy, defaultStrategyConfig } = require('../signals/strategyEngine');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.METRICS_PORT || '8788', 10);

// ─────────────────────────────────────────────────────────────────────────────
// Request Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseQueryParams(req) {
  const parsed = url.parse(req.url, true);
  return parsed.query || {};
}

function getPath(req) {
  const parsed = url.parse(req.url, true);
  return parsed.pathname;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse helpers for strategy params
// ─────────────────────────────────────────────────────────────────────────────

function parseFloat2(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInt2(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/signals/summary
 * Query params: limit, book, type, since
 */
function handleSignalsSummary(req, res) {
  const query = parseQueryParams(req);
  
  const options = {
    limit: parseInt2(query.limit, 1000),
    book: query.book || null,
    type: query.type || null,
    since: query.since || null
  };

  const signals = loadSignals(options);
  const summary = generateSummary(signals);

  sendJson(res, 200, {
    meta: {
      signalsLoaded: signals.length,
      signalsPath: getSignalsLogPath(),
      filters: options
    },
    ...summary
  });
}

/**
 * GET /api/signals/strategy
 * Query params: limit, book, type, minEdge, maxEdge, flatStake, stakeMode, maxPerEvent, maxTotalPerBook, excludeBook
 */
function handleSignalsStrategy(req, res) {
  const query = parseQueryParams(req);
  
  // Loader options
  const loaderOptions = {
    limit: parseInt2(query.limit, 1000),
    book: query.book || null,
    type: query.type || null
  };

  // Strategy config from query params
  const strategyConfig = {};
  
  if (query.minEdge !== undefined) {
    strategyConfig.minEdge = parseFloat2(query.minEdge, defaultStrategyConfig.minEdge);
  }
  if (query.maxEdge !== undefined) {
    strategyConfig.maxEdge = parseFloat2(query.maxEdge, defaultStrategyConfig.maxEdge);
  }
  if (query.flatStake !== undefined) {
    strategyConfig.flatStake = parseFloat2(query.flatStake, defaultStrategyConfig.flatStake);
  }
  if (query.stakeMode !== undefined && ['flat', 'edge_scaled'].includes(query.stakeMode)) {
    strategyConfig.stakeMode = query.stakeMode;
  }
  if (query.maxPerEvent !== undefined) {
    strategyConfig.maxSignalsPerEvent = parseInt2(query.maxPerEvent, defaultStrategyConfig.maxSignalsPerEvent);
  }
  if (query.maxTotalPerBook !== undefined) {
    strategyConfig.maxTotalStakePerBook = parseFloat2(query.maxTotalPerBook, defaultStrategyConfig.maxTotalStakePerBook);
  }
  
  // Handle excludeBook (can be string or array)
  if (query.excludeBook) {
    const excludeBooks = Array.isArray(query.excludeBook) 
      ? query.excludeBook 
      : [query.excludeBook];
    strategyConfig.excludedBooks = excludeBooks;
  }

  // Load and apply strategy
  const signals = loadSignals(loaderOptions);
  const result = applyStrategy(signals, strategyConfig);

  // Format exposureByBook and exposureByType as arrays
  const exposureByBook = Object.entries(result.exposureByBook).map(([book, stats]) => ({
    book,
    signalCount: stats.signalCount,
    totalStake: stats.totalStake
  })).sort((a, b) => b.totalStake - a.totalStake);

  const exposureByType = Object.entries(result.exposureByType).map(([type, stats]) => ({
    type,
    signalCount: stats.signalCount,
    totalStake: stats.totalStake
  })).sort((a, b) => b.totalStake - a.totalStake);

  // Sample signals (truncate metadata for readability)
  const sampleSignals = result.selectedSignals.slice(0, 5).map(sig => ({
    id: sig.id,
    type: sig.type,
    eventId: sig.eventId,
    primaryBook: sig.primaryBook,
    referenceBook: sig.referenceBook,
    edgeEstimate: sig.edgeEstimate,
    confidence: sig.confidence,
    strategyStake: sig.strategyStake
  }));

  sendJson(res, 200, {
    strategyConfig: result.strategyConfig,
    counts: {
      loadedSignals: signals.length,
      selectedSignals: result.selectedSignals.length,
      rejectedSignals: result.rejectedSignalsCount
    },
    totals: {
      totalStake: result.totalStake,
      avgEdgeEstimate: result.avgEdgeEstimate,
      expectedValue: result.expectedValue
    },
    exposureByBook,
    exposureByType,
    sampleSignals
  });
}

/**
 * GET /api/health
 */
function handleHealth(req, res) {
  sendJson(res, 200, { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
}

/**
 * GET / - API index
 */
function handleIndex(req, res) {
  sendJson(res, 200, {
    name: 'ArbMVP Metrics API',
    version: '1.0.0',
    endpoints: [
      { method: 'GET', path: '/api/health', description: 'Health check' },
      { method: 'GET', path: '/api/signals/summary', description: 'Signal analytics summary', params: ['limit', 'book', 'type', 'since'] },
      { method: 'GET', path: '/api/signals/strategy', description: 'Strategy simulation', params: ['limit', 'book', 'type', 'minEdge', 'maxEdge', 'flatStake', 'stakeMode', 'maxPerEvent', 'maxTotalPerBook', 'excludeBook'] }
    ]
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

function handleRequest(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Only GET allowed
  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  const path = getPath(req);

  try {
    switch (path) {
      case '/':
        handleIndex(req, res);
        break;
      case '/api/health':
        handleHealth(req, res);
        break;
      case '/api/signals/summary':
        handleSignalsSummary(req, res);
        break;
      case '/api/signals/strategy':
        handleSignalsStrategy(req, res);
        break;
      default:
        sendError(res, 404, `Not found: ${path}`);
    }
  } catch (err) {
    console.error('Request error:', err);
    sendError(res, 500, err.message || 'Internal server error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`
======================================================================
📊 METRICS API SERVER
======================================================================
Port: ${PORT}
Time: ${new Date().toISOString()}

Endpoints:
  GET /                        API index
  GET /api/health              Health check
  GET /api/signals/summary     Signal analytics summary
  GET /api/signals/strategy    Strategy simulation

Examples:
  curl http://localhost:${PORT}/api/signals/summary?limit=200
  curl http://localhost:${PORT}/api/signals/strategy?minEdge=0.03&stakeMode=edge_scaled
======================================================================
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down metrics server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

