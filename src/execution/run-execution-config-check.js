#!/usr/bin/env node
/**
 * src/execution/run-execution-config-check.js
 * 
 * CLI tool to validate execution configuration.
 * Prints PASS/FAIL report with errors and warnings.
 */

const CONFIG = require('../../config');
const { getExecutionProfileConfig } = require('../../config');
const { validateExecutionConfig } = require('./executionConfigValidator');

/**
 * Parse CLI arguments.
 */
function parseArgs(argv) {
    const args = {
        profile: null
    };

    for (const arg of argv.slice(2)) {
        if (arg.startsWith('--profile=')) {
            args.profile = arg.split('=')[1];
        }
    }

    return args;
}

/**
 * Print validation report.
 */
function printReport(result) {
    console.log('=== EXECUTION CONFIG CHECK ===');
    console.log(`Profile: ${result.profileName || 'none'}`);
    console.log(`Mode: ${result.mode || 'unknown'}`);
    console.log('');

    if (result.ok) {
        console.log('RESULT: PASS');
    } else {
        console.log('RESULT: FAIL');
    }

    console.log('');

    if (result.errors.length > 0) {
        console.log('Errors:');
        for (const error of result.errors) {
            console.log(`  - ${error}`);
        }
        console.log('');
    }

    if (result.warnings.length > 0) {
        console.log('Warnings:');
        for (const warning of result.warnings) {
            console.log(`  - ${warning}`);
        }
        console.log('');
    }
}

/**
 * Main function.
 */
function main() {
    const args = parseArgs(process.argv);

    // Load base config
    let effectiveConfig = CONFIG;

    // Apply profile if specified
    if (args.profile) {
        effectiveConfig = getExecutionProfileConfig(CONFIG, args.profile);
        // Set profileName in config for validator
        if (!effectiveConfig.execution) effectiveConfig.execution = {};
        effectiveConfig.execution.profileName = args.profile;
    }

    // Validate
    const result = validateExecutionConfig(effectiveConfig);

    // Print report
    printReport(result);

    // Exit with appropriate code
    process.exit(result.ok ? 0 : 1);
}

// Only run if executed directly
if (require.main === module) {
    main();
}

module.exports = { parseArgs, printReport, main };
