/**
 * tests/execution/runExecutionScenarioCli.test.js
 * 
 * Integration tests for execution scenario CLI.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseArgs, loadScenario, printReport } = require('../../src/execution/run-execution-scenario');

console.log('=== Execution Scenario CLI Tests ===\\n');

// Test scenario directory
const TEST_SCENARIO_DIR = path.join(__dirname, '../..', 'logs', 'test-scenarios');
const TEST_SCENARIO_FILE = path.join(TEST_SCENARIO_DIR, 'test-scenario.json');

/**
 * Setup: create test scenario file
 */
function setupTestScenario() {
    if (!fs.existsSync(TEST_SCENARIO_DIR)) {
        fs.mkdirSync(TEST_SCENARIO_DIR, { recursive: true });
    }

    const testScenario = {
        id: 'test-cli-scenario',
        mode: 'simulation',
        arbs: [
            {
                arbId: 'ARB_CLI_1',
                legs: [
                    { legId: 'leg1', book: 'draftkings', eventId: 'evt1', marketType: 'moneyline', side: 'home', price: -110, stake: 100 },
                    { legId: 'leg2', book: 'fanduel', eventId: 'evt1', marketType: 'moneyline', side: 'away', price: +105, stake: 105 }
                ]
            }
        ]
    };

    fs.writeFileSync(TEST_SCENARIO_FILE, JSON.stringify(testScenario, null, 2), 'utf8');
}

/**
 * Cleanup: remove test scenario file
 */
function cleanupTestScenario() {
    if (fs.existsSync(TEST_SCENARIO_FILE)) {
        fs.unlinkSync(TEST_SCENARIO_FILE);
    }
}

/**
 * Test: parseArgs
 */
{
    const originalArgv = process.argv;
    process.argv = ['node', 'script.js', '--file=/path/to/scenario.json'];

    const { file } = parseArgs();

    assert.strictEqual(file, '/path/to/scenario.json');

    process.argv = originalArgv;
    console.log('✓ parseArgs: CLI arguments parsed correctly');
}

/**
 * Test: loadScenario - valid file
 */
{
    setupTestScenario();

    const scenario = loadScenario(TEST_SCENARIO_FILE);

    assert.strictEqual(scenario.id, 'test-cli-scenario');
    assert.strictEqual(scenario.mode, 'simulation');
    assert.strictEqual(scenario.arbs.length, 1);

    cleanupTestScenario();
    console.log('✓ loadScenario: loads valid scenario file');
}

/**
 * Test: loadScenario - invalid JSON
 */
{
    const invalidFile = path.join(TEST_SCENARIO_DIR, 'invalid.json');

    if (!fs.existsSync(TEST_SCENARIO_DIR)) {
        fs.mkdirSync(TEST_SCENARIO_DIR, { recursive: true });
    }

    fs.writeFileSync(invalidFile, '{invalid json}', 'utf8');

    // Capture exit
    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => { exitCode = code; };

    try {
        loadScenario(invalidFile);
    } catch {
        // Expected to exit
    }

    process.exit = originalExit;

    assert.strictEqual(exitCode, 1, 'Should exit with code 1 for invalid JSON');

    fs.unlinkSync(invalidFile);
    console.log('✓ loadScenario: handles invalid JSON');
}

/**
 * Test: printReport
 */
{
    const result = {
        scenarioId: 'test-print',
        mode: 'simulation',
        arbs: [
            {
                arbId: 'ARB_TEST',
                executionResult: {
                    overallStatus: 'completed',
                    legs: [
                        {
                            legId: 'leg1',
                            book: 'draftkings',
                            status: 'filled',
                            filledStake: 100,
                            remainingStake: 0,
                            errorCode: null
                        }
                    ]
                }
            }
        ]
    };

    // Capture console output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(' '));

    printReport(result);

    console.log = originalLog;

    assert.ok(logs.some(l => l.includes('test-print')), 'Should print scenarioId');
    assert.ok(logs.some(l => l.includes('ARB_TEST')), 'Should print arbId');
    assert.ok(logs.some(l => l.includes('leg1')), 'Should print legId');
    console.log('✓ printReport: formats output correctly');
}

/**
 * Test: printReport with hedging
 */
{
    const result = {
        scenarioId: 'test-hedge',
        mode: 'live_simulated',
        arbs: [
            {
                arbId: 'ARB_HEDGE',
                executionResult: {
                    overallStatus: 'partial',
                    legs: [
                        { legId: 'leg1', book: 'draftkings', status: 'filled', filledStake: 100, remainingStake: 0 },
                        { legId: 'leg2', book: 'fanduel', status: 'rejected', filledStake: 0, remainingStake: 105 }
                    ],
                    hedgingPlan: {
                        hedges: [
                            { hedgeId: 'hedge1', side: 'away', stake: 100 },
                            { hedgeId: 'hedge2', side: 'home', stake: 50 }
                        ]
                    }
                }
            }
        ]
    };

    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(' '));

    printReport(result);

    console.log = originalLog;

    assert.ok(logs.some(l => l.includes('Hedging')), 'Should print hedging section');
    assert.ok(logs.some(l => l.includes('Hedges: 2')), 'Should print hedge count');
    console.log('✓ printReport: includes hedging information');
}

console.log('\\n=== All scenario CLI tests passed ===\\n');
