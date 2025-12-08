/**
 * src/ml/baselineEvaluator.js
 * 
 * Simple baseline evaluator without ML libraries.
 * Computes basic metrics for edge-based predictions.
 */

/**
 * Evaluate baseline metrics on labeled examples.
 * @param {Array<Object>} examples - Labeled examples with features and label
 * @param {Object} options
 * @returns {Object} Evaluation metrics
 */
function evaluateBaseline(examples, options = {}) {
    if (!Array.isArray(examples) || examples.length === 0) {
        return {
            count: 0,
            avgEdge: null,
            positiveRate: null,
            edgeDirectionAccuracy: null,
            buckets: []
        };
    }

    const count = examples.length;
    let sumEdge = 0;
    let edgeCount = 0;
    let positiveCount = 0;

    // For edge direction accuracy
    let correctDirectionCount = 0;
    let edgeDirectionTotal = 0;

    for (const ex of examples) {
        const edge = ex.features?.edgeEstimate;
        const label = ex.label;

        // Count positives (label == 1)
        if (label === 1) {
            positiveCount++;
        }

        // Sum edges
        if (edge !== null && edge !== undefined && !isNaN(edge)) {
            sumEdge += edge;
            edgeCount++;
        }

        // Edge direction accuracy
        if (edge !== null && edge !== undefined && !isNaN(edge) &&
            label !== null && label !== undefined) {
            edgeDirectionTotal++;

            if (edge > 0 && label === 1) {
                // Positive edge, positive outcome
                correctDirectionCount++;
            } else if (edge < 0 && (label === 0 || label === -1)) {
                // Negative edge, negative outcome
                correctDirectionCount++;
            } else if (edge === 0) {
                // Skip neutral edges for accuracy
                edgeDirectionTotal--;
            }
        }
    }

    const avgEdge = edgeCount > 0 ? sumEdge / edgeCount : null;
    const positiveRate = count > 0 ? positiveCount / count : null;
    const edgeDirectionAccuracy = edgeDirectionTotal > 0 ? correctDirectionCount / edgeDirectionTotal : null;

    return {
        count,
        avgEdge: avgEdge !== null ? parseFloat(avgEdge.toFixed(4)) : null,
        positiveRate: positiveRate !== null ? parseFloat(positiveRate.toFixed(4)) : null,
        edgeDirectionAccuracy: edgeDirectionAccuracy !== null ? parseFloat(edgeDirectionAccuracy.toFixed(4)) : null,
        buckets: [] // Optional, not implemented in baseline
    };
}

module.exports = {
    evaluateBaseline
};
