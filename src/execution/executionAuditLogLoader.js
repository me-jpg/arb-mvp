/**
 * src/execution/executionAuditLogLoader.js
 * 
 * Pure functions for parsing and aggregating execution audit logs.
 * No file I/O - works with arrays of events.
 */

/**
 * Parse a single JSONL log line.
 * @param {string} line - Raw log line
 * @returns {Object|null} Parsed object or null on error
 */
function parseExecutionLogLine(line) {
    if (!line || typeof line !== 'string' || line.trim() === '') {
        return null;
    }

    try {
        return JSON.parse(line.trim());
    } catch {
        return null;
    }
}

/**
 * Filter execution events by criteria.
 * @param {Array<Object>} events - Array of parsed events
 * @param {Object} filters - Filter criteria
 * @param {string} filters.arbId - Filter by arbId
 * @param {string} filters.eventId - Filter by eventId
 * @param {string} filters.orderId - Filter by orderId
 * @param {string} filters.legId - Filter by legId
 * @param {string|number} filters.since - Start timestamp (ISO or epoch)
 * @param {string|number} filters.until - End timestamp (ISO or epoch)
 * @returns {Array<Object>} Filtered and sorted events
 */
function filterExecutionEvents(events, filters = {}) {
    if (!Array.isArray(events)) {
        return [];
    }

    let filtered = events.filter(event => {
        if (!event) return false;

        // Filter by arbId
        if (filters.arbId && event.arbId !== filters.arbId) {
            return false;
        }

        // Filter by eventId
        if (filters.eventId && event.eventId !== filters.eventId) {
            return false;
        }

        // Filter by orderId
        if (filters.orderId && event.orderId !== filters.orderId) {
            return false;
        }

        // Filter by legId
        if (filters.legId && event.legId !== filters.legId) {
            return false;
        }

        // Time range filters
        if (filters.since || filters.until) {
            const eventTime = event.timestamp ? new Date(event.timestamp).getTime() : null;
            if (!eventTime) return false;

            if (filters.since) {
                const sinceTime = new Date(filters.since).getTime();
                if (eventTime < sinceTime) return false;
            }

            if (filters.until) {
                const untilTime = new Date(filters.until).getTime();
                if (eventTime > untilTime) return false;
            }
        }

        return true;
    });

    // Sort by timestamp ascending
    filtered.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
    });

    return filtered;
}

/**
 * Build incident timeline from filtered events.
 * @param {Array<Object>} events - Filtered execution events
 * @returns {Object} Structured timeline
 */
function buildIncidentTimeline(events) {
    if (!Array.isArray(events) || events.length === 0) {
        return {
            arbId: null,
            eventId: null,
            legs: {},
            meta: {
                firstTimestamp: null,
                lastTimestamp: null,
                mode: null,
                advisoryLevel: null,
                totalEvents: 0
            }
        };
    }

    const legs = {};
    let arbId = null;
    let eventId = null;
    let mode = null;
    let advisoryLevel = null;
    let firstTimestamp = null;
    let lastTimestamp = null;

    for (const event of events) {
        // Extract metadata from first event with each field
        if (!arbId && event.arbId) arbId = event.arbId;
        if (!eventId && event.eventId) eventId = event.eventId;
        if (!mode && event.mode) mode = event.mode;
        if (!advisoryLevel && event.level) advisoryLevel = event.level;

        // Track time range
        if (event.timestamp) {
            if (!firstTimestamp) firstTimestamp = event.timestamp;
            lastTimestamp = event.timestamp;
        }

        // Group by legId or orderId
        const legKey = event.legId || event.orderId || 'unknown';

        if (!legs[legKey]) {
            legs[legKey] = {
                legId: legKey,
                book: event.book || null,
                executions: []
            };
        }

        // Add execution record
        legs[legKey].executions.push({
            timestamp: event.timestamp || null,
            status: event.status || null,
            filledStake: event.filledStake || event.filled || null,
            remainingStake: event.remainingStake || event.remaining || null,
            errorCode: event.errorCode || event.error || null,
            errorMessage: event.errorMessage || event.message || null,
            raw: event
        });
    }

    return {
        arbId,
        eventId,
        legs,
        meta: {
            firstTimestamp,
            lastTimestamp,
            mode,
            advisoryLevel,
            totalEvents: events.length
        }
    };
}

module.exports = {
    parseExecutionLogLine,
    filterExecutionEvents,
    buildIncidentTimeline
};
