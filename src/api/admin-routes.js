const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const db = require('../utils/db');
const config = require('../../config');

// Helper to read last N lines from a file
function readLastLines(filePath, maxLines = 50) {
    if (!fs.existsSync(filePath)) return [];

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        return lines.slice(-maxLines).reverse(); // Newest first
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return [];
    }
}

// GET /status - System status
router.get('/status', async (req, res) => {
    try {
        const status = {
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            database: {
                connected: db.connected,
                stats: {}
            },
            api: {
                env: process.env.NODE_ENV || 'development',
                port: process.env.PORT || 3000
            }
        };

        if (db.connected) {
            // Get table counts
            const counts = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM events) as events_count,
                    (SELECT COUNT(*) FROM odds_snapshots) as odds_count,
                    (SELECT COUNT(*) FROM line_changes) as changes_count,
                    (SELECT COUNT(*) FROM edges) as edges_count
            `);
            status.database.stats = counts.rows[0];

            // Get DB size (Postgres specific)
            try {
                const size = await db.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
                status.database.size = size.rows[0].size;
            } catch (e) {
                status.database.size = 'Unknown';
            }
        }

        res.json(status);
    } catch (error) {
        console.error('Status check failed:', error);
        res.status(500).json({ error: 'Status check failed' });
    }
});

// GET /logs - Recent logs
router.get('/logs', (req, res) => {
    try {
        const logsDir = path.join(process.cwd(), 'logs');
        const systemLogs = readLastLines(path.join(logsDir, 'cycle-summary.jsonl'), 20)
            .map(line => {
                try { return JSON.parse(line); } catch (e) { return null; }
            }).filter(Boolean);

        const errorLogs = readLastLines(path.join(logsDir, 'errors.log'), 20)
            .map(line => {
                try { return JSON.parse(line); } catch (e) { return null; }
            }).filter(Boolean);

        res.json({
            system: systemLogs,
            errors: errorLogs
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// POST /scrape - Trigger manual scrape
router.post('/scrape', (req, res) => {
    console.log('Admin triggered manual scrape...');

    // Spawn detached process
    const scraper = spawn('node', ['src/highfreq/run-hf-tracker.js', '--once'], {
        detached: true,
        stdio: 'ignore'
    });

    scraper.unref();

    res.json({
        message: 'Scraper started in background',
        pid: scraper.pid,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
