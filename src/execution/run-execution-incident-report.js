/**
 * src/execution/run-execution-incident-report.js
 * 
 * CLI for generating execution incident reports from log files.
 * Read-only operation - no changes to logs or live systems.
 */

const fs = require('fs');
const path = require('path');
const { parseExecutionLogLine, filterExecutionEvents, buildIncidentTimeline } = require('./executionAuditLogLoader');

// Default log file path
const DEFAULT_LOG_FILE = path.join(process.cwd(), 'logs', 'execution', 'execution-events.jsonl');

/**
 * Parse CLI arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const filters = {};
    let logFile = DEFAULT_LOG_FILE;

    for (const arg of args) {
        if (arg.startsWith('--arbId=')) {
            filters.arbId = arg.split('=')[1];
        } else if (arg.startsWith('--eventId=')) {
            filters.eventId = arg.split('=')[1];
        } else if (arg.startsWith('--orderId=')) {
            filters.orderId = arg.split('=')[1];
        } else if (arg.startsWith('--legId=')) {
            filters.legId = arg.split('=')[1];
        } else if (arg.startsWith('--since=')) {
            filters.since = arg.split('=')[1];
        } else if (arg.startsWith('--until=')) {
            filters.until = arg.split('=')[1];
        } else if (arg.startsWith('--logFile=')) {
            logFile = arg.split('=')[1];
        }
    }

    return { filters, logFile };
}

/**
 * Load and parse log file.
 */
function loadLogFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Log file not found: ${filePath}`);
        return [];
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        const events = [];
        for (const line of lines) {
            const parsed = parseExecutionLogLine(line);
            if (parsed) {
                events.push(parsed);
            }
        }

        return events;
    } catch (err) {
        console.error(`Error reading log file: ${err.message}`);
        return [];
    }
}

/**
 * Format and print incident report.
 */
function printReport(timeline) {
    console.log('=== EXECUTION INCIDENT REPORT ===\n');
    console.log(`Arb ID: ${timeline.arbId || 'N/A'}`);
    console.log(`Event ID: ${timeline.eventId || 'N/A'}`);
    console.log(`Time Range: ${timeline.meta.firstTimestamp || 'N/A'} → ${timeline.meta.lastTimestamp || 'N/A'}`);
    console.log(`Mode: ${timeline.meta.mode || 'unknown'}`);
    console.log(`Advisory Level: ${timeline.meta.advisoryLevel || 'unknown'}`);
    console.log(`Total Events: ${timeline.meta.totalEvents}\n`);

    const legIds = Object.keys(timeline.legs);

    if (legIds.length === 0) {
        console.log('No legs found in timeline.');
        return;
    }

    console.log('Legs:\n');

    for (const legId of legIds) {
        const leg = timeline.legs[legId];
        console.log(`  - Leg ${legId} [Book: ${leg.book || 'unknown'}]`);

        for (const exec of leg.executions) {
            const timestamp = exec.timestamp || 'NO_TIME';
            const status = exec.status || 'UNKNOWN';
            const filled = exec.filledStake !== null ? exec.filledStake : 'N/A';
            const remaining = exec.remainingStake !== null ? exec.remainingStake : 'N/A';
            const errorCode = exec.errorCode || 'NONE';
            const errorMsg = exec.errorMessage ? ` (${exec.errorMessage})` : '';

            console.log(`    * ${timestamp} | status=${status} | filled=${filled} | remaining=${remaining} | errorCode=${errorCode}${errorMsg}`);
        }

        console.log('');
    }
}

/**
 * Main execution.
 */
function main() {
    const { filters, logFile } = parseArgs();

    console.log(`Loading log file: ${logFile}\n`);

    // Load events
    const allEvents = loadLogFile(logFile);
    console.log(`Loaded ${allEvents.length} total events\n`);

    // Filter events
    const filteredEvents = filterExecutionEvents(allEvents, filters);
    console.log(`Filtered to ${filteredEvents.length} events matching criteria\n`);

    if (filteredEvents.length === 0) {
        console.log('No execution events found for given filters.');
        return;
    }

    // Build timeline
    const timeline = buildIncidentTimeline(filteredEvents);

    // Print report
    printReport(timeline);
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { main, parseArgs, loadLogFile, printReport };
