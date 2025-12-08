/**
 * src/execution/executionScenarioHarness.js
 * 
 * End-to-end execution scenario harness.
 * Runs synthetic scenarios through the execution pipeline with scripted behaviors.
 * Pure orchestration logic - no file I/O.
 */

const { orchestrateArbExecution } = require('./arbExecutionOrchestrator');

/**
 * Scenario Schema (for documentation):
 * 
 * {
 *   id: string,
 *   mode: 'simulation' | 'paper' | 'live_simulated',
 *   configOverrides: { /* partial config */ },
 * arbs: [
 * {
        *       arbId: string,
        *       legs: [
            *         {
 *           legId: string,
            *           book: string,
            *           eventId: string,
            *           marketType: string,
            *           side: string,
            *           price: number,
            *           stake: number,
            *           behavior?: {
 *             attempts: [
                *               { status: 'filled' | 'partial_filled' | 'rejected' | 'error', filledStake?: number, errorCode?: string },
                *               ...
                *]
 *           }
    *         },
 *         ...
 *       ]
    *     },
 *     ...
 *   ]
 * }
 */

/**
 * Merge config overrides (shallow merge for simplicity).
 * @param {Object} baseConfig - Base configuration
 * @param {Object} overrides - Config overrides from scenario
 * @returns {Object} Merged config
 */
function mergeConfig(baseConfig, overrides) {
    if (!overrides || Object.keys(overrides).length === 0) {
        return baseConfig;
    }

    const merged = { ...baseConfig };

    // Shallow merge execution block
    if (overrides.execution) {
        merged.execution = {
            ...baseConfig.execution,
            ...overrides.execution
        };
    }

    // Add other top-level overrides
    for (const key in overrides) {
        if (key !== 'execution') {
            merged[key] = overrides[key];
        }
    }

    return merged;
}

/**
 * Create synthetic simulator function for a leg's scripted behavior.
 * @param {Object} leg - Leg with optional behavior.attempts
 * @returns {Function} Simulator function
 */
function createLegSimulator(leg) {
    const attempts = (leg.behavior && leg.behavior.attempts) || [];
    let attemptIndex = 0;

    return (request, options) => {
        // Default: full fill if no behavior specified
        if (attempts.length === 0) {
            return {
                status: 'filled',
                filled: leg.stake,
                remaining: 0
            };
        }

        // Use scripted attempt
        const attempt = attempts[attemptIndex] || attempts[attempts.length - 1];
        attemptIndex++;

        const result = {
            status: attempt.status || 'filled',
            filled: attempt.filledStake !== undefined ? attempt.filledStake : leg.stake,
            remaining: attempt.filledStake !== undefined ? (leg.stake - attempt.filledStake) : 0
        };

        if (attempt.errorCode) {
            result.error = attempt.errorCode;
        }

        if (attempt.errorMessage) {
            result.message = attempt.errorMessage;
        }

        return result;
    };
}

/**
 * Create combined simulator that routes to appropriate leg simulator.
 * @param {Array} legs - Array of legs with behaviors
 * @returns {Function} Combined simulator
 */
function createCombinedSimulator(legs) {
    const simulators = {};

    for (const leg of legs) {
        simulators[leg.legId] = createLegSimulator(leg);
    }

    return (request, options) => {
        const legId = request.plannedOrder?.legId || request.plannedOrder?.orderId;
        const simulator = simulators[legId];

        if (!simulator) {
            // Default full fill
            return {
                status: 'filled',
                filled: request.plannedOrder?.stake || 100,
                remaining: 0
            };
        }

        return simulator(request, options);
    };
}

/**
 * Run execution scenario through the pipeline.
 * @param {Object} scenario - Scenario definition
 * @param {Object} baseConfig - Base configuration
 * @returns {Object} Scenario results
 */
function runExecutionScenario(scenario, baseConfig) {
    // Merge configs
    let effectiveConfig = mergeConfig(baseConfig, scenario.configOverrides || {});

    // Override mode based on scenario.mode
    if (scenario.mode === 'simulation') {
        effectiveConfig = {
            ...effectiveConfig,
            execution: {
                ...effectiveConfig.execution,
                mode: 'simulation'
            }
        };
    } else if (scenario.mode === 'paper') {
        effectiveConfig = {
            ...effectiveConfig,
            execution: {
                ...effectiveConfig.execution,
                mode: 'paper'
            }
        };
    } else if (scenario.mode === 'live_simulated') {
        effectiveConfig = {
            ...effectiveConfig,
            execution: {
                ...effectiveConfig.execution,
                mode: 'live'
            }
        };
    }

    const arbResults = [];

    // Process each arb
    for (const arbDef of scenario.arbs || []) {
        // Build arb plan
        const arbPlan = {
            id: arbDef.arbId,
            legs: arbDef.legs.map(leg => ({
                legId: leg.legId,
                book: leg.book,
                eventId: leg.eventId,
                marketType: leg.marketType,
                side: leg.side,
                price: leg.price,
                stake: leg.stake
            }))
        };

        // Create simulator for this arb's legs
        const simulator = createCombinedSimulator(arbDef.legs);

        // Build execution context
        const executeSingleLegFn = async (leg) => {
            // Create a synthetic order
            const order = {
                orderId: leg.legId,
                legId: leg.legId,
                book: leg.book,
                eventId: leg.eventId,
                marketType: leg.marketType,
                side: leg.side,
                price: leg.price,
                stake: leg.stake
            };

            // Simulate execution
            const result = simulator({ plannedOrder: order }, {});

            // Return normalized format
            return {
                requestedStake: leg.stake,
                filledStake: result.filled || 0,
                remainingStake: result.remaining || 0,
                status: result.status || 'filled',
                errorCode: result.error || null,
                errorMessage: result.message || null
            };
        };

        const engineContext = {
            config: effectiveConfig,
            recentExecutions: [],
            executeSingleLegFn
        };

        // Execute arb through orchestrator
        const executionResult = orchestrateArbExecution(arbPlan, engineContext);

        arbResults.push({
            arbId: arbDef.arbId,
            executionResult,
            scenarioId: scenario.id,
            mode: scenario.mode
        });
    }

    return {
        scenarioId: scenario.id,
        mode: scenario.mode,
        arbs: arbResults,
        configSnapshot: effectiveConfig
    };
}

module.exports = {
    runExecutionScenario,
    mergeConfig,
    createLegSimulator,
    createCombinedSimulator
};
