/**
 * src/api/server.js
 * 
 * REST API server for B2B sports betting data platform.
 * Exposes endpoints for live odds, line movements, and latency metrics.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('../utils/db');
const config = require('../../config');
const { startWsMetricsServer } = require('../server/wsMetricsServer');

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: db.connected ? 'connected' : 'disconnected'
    });
});

// ============================================
// ADMIN ROUTES
// ============================================
const adminRoutes = require('./admin-routes');
const path = require('path');

app.use('/api/v1/admin', adminRoutes);

// Serve Admin Dashboard HTML
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/dashboard.html'));
});

// ============================================
// API v1 ENDPOINTS
// ============================================

/**
 * GET /api/v1/odds/live/:sport
 * Get latest odds for a specific sport across all books
 */
app.get('/api/v1/odds/live/:sport', async (req, res) => {
    try {
        const { sport } = req.params;
        const validSports = ['nfl', 'nba', 'mlb', 'nhl', 'ncaab', 'ncaaf'];

        if (!validSports.includes(sport.toLowerCase())) {
            return res.status(400).json({
                error: 'Invalid sport',
                validSports
            });
        }

        const odds = await db.getLatestOdds(sport.toLowerCase());

        res.json({
            sport: sport.toLowerCase(),
            timestamp: new Date().toISOString(),
            count: odds.length,
            data: odds
        });
    } catch (error) {
        console.error('Error fetching live odds:', error);
        res.status(500).json({ error: 'Failed to fetch live odds' });
    }
});

/**
 * GET /api/v1/odds/movement/:eventId
 * Get line movement history for a specific event
 */
app.get('/api/v1/odds/movement/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;

        const movements = await db.getLineMovements(eventId);

        res.json({
            eventId,
            timestamp: new Date().toISOString(),
            count: movements.length,
            data: movements
        });
    } catch (error) {
        console.error('Error fetching line movements:', error);
        res.status(500).json({ error: 'Failed to fetch line movements' });
    }
});

/**
 * GET /api/v1/books/latency
 * Get latency metrics for all books
 */
app.get('/api/v1/books/latency', async (req, res) => {
    try {
        const latency = await db.getLatencyMetrics();

        res.json({
            timestamp: new Date().toISOString(),
            count: latency.length,
            data: latency
        });
    } catch (error) {
        console.error('Error fetching latency metrics:', error);
        res.status(500).json({ error: 'Failed to fetch latency metrics' });
    }
});

/**
 * GET /api/v1/events
 * Get all tracked events
 */
app.get('/api/v1/events', async (req, res) => {
    try {
        const { sport, limit = 50 } = req.query;
        const events = await db.getEvents(sport, parseInt(limit));

        res.json({
            timestamp: new Date().toISOString(),
            count: events.length,
            data: events
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

/**
 * GET /api/v1/edges
 * Get detected edges/arbitrages
 */
app.get('/api/v1/edges', async (req, res) => {
    try {
        const { minEdge = 0, limit = 100 } = req.query;
        const edges = await db.getEdges(parseFloat(minEdge), parseInt(limit));

        res.json({
            timestamp: new Date().toISOString(),
            count: edges.length,
            data: edges
        });
    } catch (error) {
        console.error('Error fetching edges:', error);
        res.status(500).json({ error: 'Failed to fetch edges' });
    }
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'GET /api/v1/odds/live/:sport',
            'GET /api/v1/odds/movement/:eventId',
            'GET /api/v1/books/latency',
            'GET /api/v1/events',
            'GET /api/v1/edges'
        ]
    });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================
const cron = require('node-cron');
const { main: runScrapeJob } = require('../jobs/scrape-odds');

// ... existing code ...

async function startServer() {
    try {
        // Connect to database
        if (config.database?.enabled) {
            await db.connect();
            console.log('✅ Database connected');
        } else {
            console.log('⚠️  Database disabled - API will return empty data');
        }

        // Schedule Scrape Job (Every 60 seconds)
        console.log('⏰ Initializing Scraper Cron Job (Every 60s)...');
        cron.schedule('* * * * *', async () => {
            console.log('[Cron] Triggering scrape job...');
            try {
                // We restart standard logging for the cron mainly
                await runScrapeJob(true); // true = keepAlive (don't exit process)
            } catch (err) {
                console.error('[Cron] Scrape job failed:', err);
            }
        });

        app.listen(PORT, () => {
            // ... existing log lines ...
            console.log(`\n${'='.repeat(50)}`);
            console.log(`🚀 Sports Betting Odds API v1.0.0`);
            console.log(`${'='.repeat(50)}`);
            console.log(`Server running on port ${PORT}`);
            console.log(`Cron Scraper: ACTIVE (* * * * *)`);
            console.log(`\nEndpoints:`);
            console.log(`  Health:     http://localhost:${PORT}/health`);
            console.log(`  Live Odds:  http://localhost:${PORT}/api/v1/odds/live/:sport`);
            console.log(`  Movements:  http://localhost:${PORT}/api/v1/odds/movement/:eventId`);
            console.log(`  Latency:    http://localhost:${PORT}/api/v1/books/latency`);
            console.log(`  Events:     http://localhost:${PORT}/api/v1/events`);
            console.log(`  Edges:      http://localhost:${PORT}/api/v1/edges`);

            // Start WebSocket Metrics Server
            try {
                const wsPort = process.env.WS_METRICS_PORT || 4090;
                startWsMetricsServer({ port: wsPort });
                console.log(`  Streaming:  ws://localhost:${wsPort}`);
            } catch (err) {
                console.error('Failed to start WS Metrics Server:', err);
            }

            console.log(`${'='.repeat(50)}\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// ... rest of file ...

module.exports = { app, startServer };
