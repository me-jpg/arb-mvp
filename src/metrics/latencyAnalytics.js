/**
 * src/metrics/latencyAnalytics.js
 * 
 * Cross-book latency analytics module.
 * Read-only analysis over HF data.
 */

const db = require('../utils/db');

/**
 * Load latency events from HF database.
 * @param {Object} dbClient - Database client
 * @param {Object} options - Options
 * @param {number} options.windowMinutes - Time window in minutes
 * @returns {Promise<Array>} Array of latency events
 */
async function loadLatencyEvents(dbClient, options) {
    const { windowMinutes = 15 } = options;

    const nowMs = Date.now();
    const fromMs = nowMs - (windowMinutes * 60 * 1000);

    try {
        // Query line_changes for movements within window
        const query = `
      SELECT event_id, book, market_type, created_at
      FROM line_changes
      WHERE created_at >= ?
      ORDER BY event_id, market_type, created_at ASC
    `;

        const rows = await dbClient.all(query, [new Date(fromMs).toISOString()]);

        // Group by (event_id, market_type) to find first movers
        const groups = {};

        for (const row of rows) {
            const key = `${row.event_id}:${row.market_type}`;
            if (!groups[key]) {
                groups[key] = {
                    eventId: row.event_id,
                    marketType: row.market_type,
                    bookTimestamps: {}
                };
            }

            const ts = new Date(row.created_at).getTime();
            if (!groups[key].bookTimestamps[row.book]) {
                groups[key].bookTimestamps[row.book] = ts;
            }
        }

        // Convert groups to latency events
        const events = [];

        for (const group of Object.values(groups)) {
            const timestamps = Object.entries(group.bookTimestamps);
            if (timestamps.length < 2) continue; // Need at least 2 books

            // Find earliest timestamp and book
            timestamps.sort((a, b) => a[1] - b[1]);
            const [firstBook, firstTs] = timestamps[0];

            // Compute lags for other books
            const laggingBooks = {};
            for (let i = 1; i < timestamps.length; i++) {
                const [book, ts] = timestamps[i];
                const lagMs = ts - firstTs;
                if (lagMs >= 0) {
                    laggingBooks[book] = lagMs;
                }
            }

            if (Object.keys(laggingBooks).length > 0) {
                events.push({
                    eventId: group.eventId,
                    marketType: group.marketType,
                    firstBook,
                    laggingBooks,
                    timestampMs: firstTs
                });
            }
        }

        return events;
    } catch (error) {
        console.error('Error loading latency events:', error);
        return [];
    }
}

/**
 * Compute cross-book latency statistics.
 * @param {Array} events - Latency events from loadLatencyEvents
 * @param {Object} options - Options
 * @returns {Object} Latency statistics
 */
function computeCrossBookLatency(events, options) {
    const { windowMinutes = 15, minEventsPerBook = 20, maxBooks = 20 } = options;

    // Collect lag values per book
    const bookLags = {};

    for (const event of events) {
        for (const [book, lagMs] of Object.entries(event.laggingBooks)) {
            if (!bookLags[book]) {
                bookLags[book] = [];
            }
            bookLags[book].push(lagMs);
        }
    }

    // Compute stats per book
    const books = {};

    for (const [book, lags] of Object.entries(bookLags)) {
        const sampleCount = lags.length;

        // Filter by minimum sample count
        if (sampleCount < minEventsPerBook) continue;

        // Sort for percentile calculation
        const sortedLags = [...lags].sort((a, b) => a - b);

        // Compute stats
        const avgLagMs = lags.reduce((sum, lag) => sum + lag, 0) / sampleCount;
        const p95Index = Math.floor(sampleCount * 0.95);
        const p95LagMs = sortedLags[p95Index] || sortedLags[sampleCount - 1];
        const maxLagMs = sortedLags[sampleCount - 1];

        books[book] = {
            sampleCount,
            avgLagMs: Math.round(avgLagMs),
            p95LagMs: Math.round(p95LagMs),
            maxLagMs: Math.round(maxLagMs)
        };
    }

    // Limit to maxBooks (worst first)
    const bookEntries = Object.entries(books);
    if (bookEntries.length > maxBooks) {
        bookEntries.sort((a, b) => b[1].p95LagMs - a[1].p95LagMs);
        const limitedBooks = {};
        for (let i = 0; i < maxBooks; i++) {
            limitedBooks[bookEntries[i][0]] = bookEntries[i][1];
        }
        Object.keys(books).forEach(book => {
            if (!limitedBooks[book]) delete books[book];
        });
    }

    return {
        books,
        global: {
            windowMinutes,
            totalEvents: events.length,
            booksConsidered: Object.keys(books)
        }
    };
}

/**
 * Summarize latency stats by book for dashboard.
 * @param {Object} latencyStats - Stats from computeCrossBookLatency
 * @param {Object} options - Options
 * @returns {Object} Dashboard-friendly summary
 */
function summarizeLatencyByBook(latencyStats, options = {}) {
    const perBook = [];

    for (const [book, stats] of Object.entries(latencyStats.books || {})) {
        perBook.push({
            book,
            sampleCount: stats.sampleCount,
            avgLagMs: stats.avgLagMs,
            p95LagMs: stats.p95LagMs,
            maxLagMs: stats.maxLagMs
        });
    }

    // Sort by worst latency first (p95 descending)
    perBook.sort((a, b) => b.p95LagMs - a.p95LagMs);

    return {
        perBook,
        global: latencyStats.global || {
            windowMinutes: 0,
            totalEvents: 0,
            booksConsidered: []
        }
    };
}

module.exports = {
    loadLatencyEvents,
    computeCrossBookLatency,
    summarizeLatencyByBook
};
