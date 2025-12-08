/**
 * src/latency/bookLatencyModel.js
 * 
 * Pure deterministic module for calculating cross-book latency stats.
 * 
 * Responsibilities:
 * 1. Group events by market (eventId + marketKey + marketType)
 * 2. Within each max-market group, cluster changes into "moves" (based on time proximity)
 * 3. For each moves-cluster:
 *    - Determine first mover (min timestamp)
 *    - Calculate lag for others
 * 4. Aggregate stats
 */

/**
 * Calculates latency stats from a list of line change events.
 * 
 * @param {Array<Object>} events - Array of line change events.
 *                                 Must have: eventId, book, marketType, timestamp (or detectable time)
 *                                 Optional: side, marketKey
 * @returns {Object} Summary stats
 */
function buildBookLatencyStats(events) {
    if (!events || events.length === 0) {
        return createEmptyStats();
    }

    // 1. Normalize and Sort events by time
    const sortedEvents = events.map(e => ({
        ...e,
        // Ensure timestamp is number
        timestamp: new Date(e.timestamp || e.detected_at).getTime()
    })).sort((a, b) => a.timestamp - b.timestamp);

    // 2. Group by Market
    // Key = eventId + marketType + (side or marketKey)
    const eventsByMarket = groupEventsByMarket(sortedEvents);

    // 3. Process groups to find "Move Clusters" and calculate lag
    const perBookStats = {}; // { bookName: { lags: [] } }
    let totalSamples = 0;

    for (const marketKey in eventsByMarket) {
        const marketEvents = eventsByMarket[marketKey];

        // Cluster into "Move Events" based on time gap (e.g. > 60s gap implies distinct move)
        // This is a heuristic: if lines change within a short window, they are related.
        const clusters = clusterEventsByTime(marketEvents, 60000); // 60s gap

        for (const cluster of clusters) {
            if (cluster.length < 2) continue; // Need at least 2 books to compare

            // Find unique books in this cluster to ensure we are comparing DIFFERENT books
            const uniqueBooks = new Set(cluster.map(e => e.book));
            if (uniqueBooks.size < 2) continue;

            // Identify First Mover
            // Cluster is already sorted by time because input was sorted
            const firstMover = cluster[0];
            const firstTimestamp = firstMover.timestamp;

            // Calculate lag for all books (including first mover, to record "0" lag or "winner" status)
            // Note: If a book updates MULTIPLE times in a cluster, we usually take the FIRST update as their reaction time.
            const booksSeenInCluster = new Set();

            for (const event of cluster) {
                if (booksSeenInCluster.has(event.book)) continue; // Only count first reaction per book per wave
                booksSeenInCluster.add(event.book);

                const lag = event.timestamp - firstTimestamp;

                if (!perBookStats[event.book]) {
                    perBookStats[event.book] = { lags: [] };
                }
                perBookStats[event.book].lags.push(lag);
                totalSamples++;
            }
        }
    }

    // 4. Summarize Stats
    const finalStats = {
        byBook: {},
        totalSamples
    };

    for (const [book, data] of Object.entries(perBookStats)) {
        const lags = data.lags.sort((a, b) => a - b);
        const sum = lags.reduce((a, b) => a + b, 0);
        const avg = sum / lags.length;
        const mid = Math.floor(lags.length / 2);
        const median = lags.length % 2 !== 0 ? lags[mid] : (lags[mid - 1] + lags[mid]) / 2;

        finalStats.byBook[book] = {
            sampleCount: lags.length,
            avgLagMs: Math.round(avg),
            medianLagMs: Math.round(median)
        };
    }

    return finalStats;
}

/**
 * Helpers
 */

function createEmptyStats() {
    return { byBook: {}, totalSamples: 0 };
}

function groupEventsByMarket(events) {
    const groups = {};
    for (const e of events) {
        // Generate unique key for the specific line
        // e.g. "EVT_123:spread:home"
        const key = `${e.eventId}:${e.marketType}:${e.side || 'na'}:${e.marketKey || ''}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
    }
    return groups;
}

function clusterEventsByTime(events, gapMs) {
    const clusters = [];
    if (events.length === 0) return clusters;

    let currentCluster = [events[0]];

    for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const curr = events[i];

        if (curr.timestamp - prev.timestamp > gapMs) {
            // Gap exceeded, start new cluster
            clusters.push(currentCluster);
            currentCluster = [];
        }
        currentCluster.push(curr);
    }

    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    return clusters;
}

module.exports = {
    buildBookLatencyStats
};
