/**
 * src/execution/run-execution-scenario.js
 * 
 * CLI for running execution scenarios from JSON files.
 * Read-only operation with synthetic execution.
 */

const fs = require('fs');
const path = require('path');
const { runExecutionScenario } = require('./executionScenarioHarness');
const config = require('../config');

/**
 * Parse CLI arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    let file = null;

    for (const arg of args) {
        if (arg.startsWith('--file=')) {
            file = arg.split('=')[1];
        }
    }

    return { file };
}

/**
 * Load scenario from JSON file.
 */
function loadScenario(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Scenario file not found: ${filePath}`);
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error(`Error loading scenario: ${err.message}`);
        process.exit(1);
    }
}

/**
 * Print scenario report.
 */
function printReport(result) {
    console.log('=== EXECUTION SCENARIO REPORT ===\n');
    console.log(`Scenario: ${result.scenarioId}`);
    console.log(`Mode: ${result.mode}`);
    console.log(`Arbs: ${result.arbs.length}\n`);

    for (const arbResult of result.arbs) {
        console.log(`Arb ${arbResult.arbId}:`);
        console.log(`  OverallStatus: ${arbResult.executionResult.overallStatus}`);
        console.log(`  Legs:`);

        for (const leg of arbResult.executionResult.legs) {
            const legId = leg.legId || 'unknown';
            const book = leg.book || 'unknown';
            const status = leg.status || 'unknown';
            const filled = leg.filledStake !== undefined ? leg.filledStake : 'N/A';
            const remaining = leg.remainingStake !== undefined ? leg.remainingStake : 'N/A';
            const errorCode = leg.errorCode || 'NONE';

            console.log(`    - ${legId} | book=${book} | status=${status} | filled=${filled} | remaining=${remaining} | errorCode=${errorCode}`);
        }

        // Print hedging if present
        if (arbResult.executionResult.hedgingPlan) {
            const hedges = arbResult.executionResult.hedgingPlan.hedges || [];
            console.log(`  Hedging:`);
            console.log(`    Hedges: ${hedges.length}`);

            if (hedges.length > 0) {
                for (const hedge of hedges.slice(0, 3)) {  // Show first 3
                    console.log(`    - ${hedge.hedgeId} | side=${hedge.side} | stake=${hedge.stake}`);
                }
                if (hedges.length > 3) {
                    console.log(`    ... and ${hedges.length - 3} more`);
                }
            }
        }

        console.log('');
    }
}

/**
 * Main execution.
 */
function main() {
    const { file } = parseArgs();

    if (!file) {
        console.error('Usage: node run-execution-scenario.js --file=<path>');
        process.exit(1);
    }

    console.log(`Loading scenario: ${file}\n`);

    const scenario = loadScenario(file);

    console.log(`Running scenario: ${scenario.id}\n`);

    const result = runExecutionScenario(scenario, config);

    printReport(result);
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { main, parseArgs, loadScenario, printReport };
