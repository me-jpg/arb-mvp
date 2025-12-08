#!/usr/bin/env node
/**
 * src/server/run-ws-metrics-server.js
 * 
 * CLI to start the WebSocket metrics server.
 */

const config = require('../../config');
const { startWsMetricsServer } = require('./wsMetricsServer');

const port = config.wsMetrics?.port || parseInt(process.env.WS_METRICS_PORT || '4090', 10);
const intervalMs = config.wsMetrics?.intervalMs || parseInt(process.env.WS_METRICS_INTERVAL_MS || '3000', 10);
const maxAnomalies = config.wsMetrics?.maxAnomalies || 20;
const maxTopMarkets = config.wsMetrics?.maxTopMarkets || 20;

startWsMetricsServer({
    port,
    intervalMs,
    maxAnomalies,
    maxTopMarkets
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[ws-metrics] Shutting down...');
    process.exit(0);
});
