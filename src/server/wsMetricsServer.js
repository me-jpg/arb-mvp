/**
 * src/server/wsMetricsServer.js
 * 
 * Lightweight WebSocket server for streaming HF + latency metrics.
 * No framework dependencies - uses Node's built-in http + ws library.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Build metrics payload from current state.
 */
function buildMetricsPayload(data) {
    const {
        hfSummary,
        latencyAnomalies,
        executionSummary,
        riskSummary,
        researchSummary,
        arbExposureSummary,
        executionHealth
    } = data;

    // Derive advisory status if health data available
    let executionHealthAdvisory = null;
    if (executionHealth) {
        try {
            const { deriveExecutionHealthStatus } = require('../execution/executionHealthAdvisor');
            executionHealthAdvisory = deriveExecutionHealthStatus(executionHealth);
        } catch (err) {
            console.error('[wsMetrics] executionHealthAdvisory error:', err.message);
        }
    }

    return {
        ts: new Date().toISOString(),
        hf: hfSummary,
        latency: latencyAnomalies,
        execution: executionSummary,
        risk: riskSummary,
        research: researchSummary,
        arbExposure: arbExposureSummary,
        executionHealth,
        executionHealthAdvisory
    };
}

/**
 * Load recent HF events and compute top volatile markets.
 */
async function getTopVolatileMarkets(options = {}) {
    const { maxMarkets = 20, logPath = 'logs/line-changes.jsonl', limit = 5000 } = options;

    try {
        const { buildMarketState } = require('../hf/marketStateEngine');

        // Stream read recent events
        const events = [];
        if (!fs.existsSync(logPath)) return [];

        const fileStream = fs.createReadStream(logPath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let count = 0;
        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                events.push(JSON.parse(line));
                count++;
                if (limit > 0 && count >= limit) break;
            } catch (e) {
                // Skip malformed
            }
        }

        if (events.length === 0) return [];

        const states = buildMarketState(events);

        // Sort by volatility and return top N
        return states
            .sort((a, b) => (b.volatilityScore || 0) - (a.volatilityScore || 0))
            .slice(0, maxMarkets)
            .map(s => ({
                eventId: s.eventId,
                marketType: s.marketType,
                volatilityScore: s.volatilityScore,
                totalMoves: s.totalMoves
            }));
    } catch (err) {
        console.error('[ws-metrics] Failed to load HF markets:', err.message);
        return [];
    }
}

/**
 * Get recent latency anomalies.
 */
async function getRecentLatencyAnomalies(options = {}) {
    const { maxAnomalies = 20, logPath = 'logs/line-changes.jsonl', limit = 10000 } = options;

    try {
        const { buildLatencyBaselines, detectLatencyAnomalies } = require('../latency/latencyAnomalyDetector');

        // Stream read recent events
        const events = [];
        if (!fs.existsSync(logPath)) return [];

        const fileStream = fs.createReadStream(logPath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let count = 0;
        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                events.push(JSON.parse(line));
                count++;
                if (limit > 0 && count >= limit) break;
            } catch (e) {
                // Skip malformed
            }
        }

        if (events.length === 0) return [];

        const baselines = buildLatencyBaselines(events);
        const anomalies = detectLatencyAnomalies(events, baselines);

        return anomalies.slice(0, maxAnomalies);
    } catch (err) {
        console.error('[ws-metrics] Failed to detect anomalies:', err.message);
        return [];
    }
}

/**
 * Start WebSocket metrics server.
 * @param {Object} options
 * @param {number} options.port - Port to listen on
 * @param {number} options.intervalMs - Push interval in milliseconds
 * @param {number} options.maxAnomalies - Max anomalies to include
 * @param {number} options.maxTopMarkets - Max top markets to include
 * @param {Function} options.getTopVolatileMarkets - Optional injected function
 * @param {Function} options.getRecentLatencyAnomalies - Optional injected function
 */
function startWsMetricsServer(options = {}) {
    const {
        port = 4090,
        intervalMs = 3000,
        maxAnomalies = 20,
        maxTopMarkets = 20,
        getTopVolatileMarkets: injectedGetMarkets,
        getRecentLatencyAnomalies: injectedGetAnomalies
    } = options;

    const WebSocket = require('ws');

    // Create HTTP server
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('WebSocket Metrics Server\n');
    });

    // Create WebSocket server
    const wss = new WebSocket.Server({ server });

    wss.on('error', (err) => {
        console.error('[ws-metrics] WebSocket Server error:', err.message);
    });

    const clients = new Set();

    wss.on('connection', (ws) => {
        console.log('[ws-metrics] Client connected');
        clients.add(ws);

        ws.on('close', () => {
            console.log('[ws-metrics] Client disconnected');
            clients.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('[ws-metrics] WebSocket error:', err.message);
            clients.delete(ws);
        });
    });

    // Periodically push metrics
    const interval = setInterval(async () => {
        if (clients.size === 0) return;

        try {
            // Get data
            const getMarkets = injectedGetMarkets || getTopVolatileMarkets;
            const getAnomalies = injectedGetRecentLatencyAnomalies || getRecentLatencyAnomalies;

            const { loadExecutionSummary, loadRiskSummary } = require('../metrics/executionRiskLoaders');
            const { loadResearchSummary } = require('../metrics/researchSummaryLoader');
            const { loadArbExposureSummary } = require('../metrics/arbExposureSummaryLoader');

            const [topMarkets, anomalies, executionSummary, riskSummary, researchData, arbExposureData] = await Promise.all([
                getMarkets({ maxMarkets: maxTopMarkets }),
                getAnomalies({ maxAnomalies }),
                loadExecutionSummary({ limit: 5000 }),
                loadRiskSummary({ limit: 1000 }),
                loadResearchSummary({ maxRows: 5000 }),
                loadArbExposureSummary({ limitSignals: 3000, limitExec: 3000 })
            ]);

            // Derive top books and strategies by ROI
            const topBooks = Object.entries(researchData.byBook || {})
                .map(([book, stats]) => ({
                    book,
                    roi: stats.totalStake > 0 ? (stats.realizedProfit / stats.totalStake) : 0,
                    count: stats.count
                }))
                .sort((a, b) => b.roi - a.roi)
                .slice(0, 3);

            const topStrategies = Object.entries(researchData.byStrategy || {})
                .map(([strategyId, stats]) => ({
                    strategyId,
                    roi: stats.totalStake > 0 ? (stats.realizedProfit / stats.totalStake) : 0,
                    count: stats.count
                }))
                .sort((a, b) => b.roi - a.roi)
                .slice(0, 3);

            const researchSummary = {
                rowCount: researchData.rowCount,
                topBooks,
                topStrategies,
                mlBaseline: researchData.mlBaseline ? {
                    count: researchData.mlBaseline.count,
                    edgeDirectionAccuracy: researchData.mlBaseline.edgeDirectionAccuracy
                } : null
            };

            // Format arbExposure for WS payload
            const byBookArray = Object.entries(arbExposureData.byBook || {}).map(([book, stats]) => ({
                book,
                unhedgedPairs: stats.unhedgedPairs,
                unhedgedExposure: stats.unhedgedExposure
            }));

            const arbExposureSummary = {
                groups: arbExposureData.groups,
                pairs: arbExposureData.pairs,
                fullyHedged: arbExposureData.fullyHedged,
                unhedgedSingleLeg: arbExposureData.unhedgedSingleLeg,
                noFill: arbExposureData.noFill,
                totalUnhedgedExposure: arbExposureData.totalUnhedgedExposure,
                byBook: byBookArray,
                worstUnhedged: (arbExposureData.worstUnhedged || []).slice(0, 5)
            };

            // Load execution health
            let executionHealth = null;
            try {
                const { loadExecutionHealth } = require('../metrics/executionHealthLoader');
                executionHealth = await loadExecutionHealth({ limit: 5000, windowMinutes: 30 });
            } catch (err) {
                console.error('[wsMetrics] executionHealth error:', err.message);
            }

            const payload = buildMetricsPayload({
                hfSummary: { topVolatileMarkets: topMarkets },
                latencyAnomalies: { anomalies },
                executionSummary,
                riskSummary: riskSummary.latest,
                researchSummary,
                arbExposureSummary,
                executionHealth
            });

            const message = JSON.stringify(payload);

            // Broadcast to all clients
            for (const client of clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            }
        } catch (err) {
            console.error('[ws-metrics] Failed to build/send metrics:', err.message);
        }
    }, intervalMs);

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[ws-metrics] Port ${port} is already in use.`);
            console.warn('[ws-metrics] Metrics server will not start.');
        } else {
            console.error('[ws-metrics] Server error:', err);
        }
    });

    server.listen(port, () => {
        console.log(`[ws-metrics] listening on ws://localhost:${port}`);
    });

    // Cleanup function
    const shutdown = () => {
        clearInterval(interval);
        wss.close();
        server.close();
    };

    return { server, wss, shutdown };
}

module.exports = {
    startWsMetricsServer,
    buildMetricsPayload
};
