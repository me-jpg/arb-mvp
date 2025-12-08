/**
 * src/ml/modelAdapter.js
 * 
 * Lightweight model adapter for ML scoring.
 * Deterministic formulas, no external ML libraries.
 * Clean integration point for future real models.
 */

const fs = require('fs');
const path = require('path');

// Model cache for linear models
let modelCache = {};

/**
 * Load a linear model from JSON file (with caching).
 * @param {string} modelPath - Path to model JSON file
 * @returns {Object} Model object
 */
function loadLinearModelSync(modelPath) {
    if (modelCache[modelPath]) {
        return modelCache[modelPath];
    }

    try {
        const fullPath = path.isAbsolute(modelPath)
            ? modelPath
            : path.join(process.cwd(), modelPath);

        const modelJson = fs.readFileSync(fullPath, 'utf8');
        const model = JSON.parse(modelJson);

        // Validate model structure
        if (!model.features || typeof model.features !== 'object') {
            throw new Error('Model must have a features object');
        }

        modelCache[modelPath] = model;
        return model;
    } catch (err) {
        console.warn(`[modelAdapter] Failed to load model from ${modelPath}: ${err.message}`);
        return null;
    }
}

/**
 * Score an example using a linear model.
 * @param {Object} example - Example with features
 * @param {Object} model - Linear model with weights and bias
 * @returns {Object} Scoring result
 */
function scoreLinearModel(example, model) {
    const features = example.features || {};
    let rawScore = model.bias || 0;

    // Sum weighted features
    for (const [featureName, weight] of Object.entries(model.features || {})) {
        const featureValue = features[featureName] ?? 0;

        // Handle NaN/Infinity
        if (!Number.isFinite(featureValue)) {
            continue;
        }

        rawScore += weight * featureValue;
    }

    // Apply sigmoid to get pseudo-probability
    const prob = 1 / (1 + Math.exp(-rawScore));

    return {
        id: example.id,
        score: prob,
        rawScore,
        rawFeatures: features
    };
}

/**
 * Score a single example.
 * @param {Object} example - ML example with features
 * @param {Object} options - Scoring options
 * @param {string} options.mode - "baseline" | "edge_plus_latency" | "experimental" | "linear_model"
 * @param {Object} options.weights - Optional feature weights
 * @param {string} options.modelPath - Path to linear model file (for linear_model mode)
 * @returns {Object} Scored result
 */
function scoreExample(example, options = {}) {
    const { mode = 'baseline', weights = {}, modelPath = null } = options;

    // Linear model mode
    if (mode === 'linear_model') {
        try {
            const config = require('../../config');
            const model = loadLinearModelSync(modelPath || config.mlModel?.modelPath || 'models/linear-model.json');
            if (model) {
                return scoreLinearModel(example, model);
            }
        } catch (err) {
            console.warn('[modelAdapter] Linear model failed, falling back to baseline:', err.message);
        }
    }

    const features = example.features || {};

    const edge = features.edgeEstimate ?? 0;
    const lagMs = features.bookAvgLagMs ?? 0;
    const volatility = features.marketVolatilityScore ?? 0;

    let score = 0;

    switch (mode) {
        case 'baseline':
            // Simple: score = edge
            score = edge;
            break;

        case 'edge_plus_latency':
            // Penalize high latency
            const latencyCoef = weights.latencyCoef ?? 0.001; // default: -0.001 per ms
            score = edge - (latencyCoef * lagMs);
            break;

        case 'experimental':
            // Boost by volatility
            const volatilityBoost = weights.volatilityBoost ?? 0.02; // default: 2% per unit
            const normalizedVolatility = Math.min(volatility / 100, 1.0); // cap at 1.0
            score = edge * (1 + volatilityBoost * normalizedVolatility);
            break;

        default:
            score = edge;
    }

    return {
        id: example.id,
        score,
        rawFeatures: features
    };
}

/**
 * Score a batch of examples.
 * @param {Array<Object>} examples - Array of ML examples
 * @param {Object} options - Scoring options
 * @returns {Array<Object>} Array of scored results
 */
function scoreBatch(examples, options = {}) {
    return examples.map(ex => scoreExample(ex, options));
}

module.exports = {
    scoreExample,
    scoreBatch,
    loadLinearModelSync,
    scoreLinearModel
};
