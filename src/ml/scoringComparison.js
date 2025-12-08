/**
 * src/ml/scoringComparison.js
 * 
 * Compare multiple ML scoring modes on the same dataset.
 */

const { buildLabelsFromRows } = require('./labelBuilder');
const { trainTestSplit } = require('./trainTestSplitter');
const { scoreBatch } = require('./modelAdapter');

/**
 * Calculate correlation between two arrays.
 */
function correlation(arr1, arr2) {
    if (arr1.length !== arr2.length || arr1.length === 0) return 0;

    const mean1 = arr1.reduce((sum, v) => sum + v, 0) / arr1.length;
    const mean2 = arr2.reduce((sum, v) => sum + v, 0) / arr2.length;

    let num = 0, den1 = 0, den2 = 0;
    for (let i = 0; i < arr1.length; i++) {
        const diff1 = arr1[i] - mean1;
        const diff2 = arr2[i] - mean2;
        num += diff1 * diff2;
        den1 += diff1 * diff1;
        den2 += diff2 * diff2;
    }

    if (den1 === 0 || den2 === 0) return 0;
    return num / Math.sqrt(den1 * den2);
}

/**
 * Compare multiple scoring modes on the same dataset.
 * @param {Array} rows - Research dataset rows
 * @param {Object} options - Comparison options
 * @param {string} options.labelType - Label type (binary_win, edge_sign)
 * @param {number} options.minStake - Minimum stake filter
 * @param {number} options.testRatio - Test set ratio
 * @param {Array} options.modes - Scoring mode descriptors
 * @returns {Object} Comparison results
 */
async function compareScoringModes(rows, options = {}) {
    const {
        labelType = 'binary_win',
        minStake = 0,
        testRatio = 0.2,
        modes = []
    } = options;

    // Build labeled examples
    const examples = buildLabelsFromRows(rows, { labelType, minStake });

    if (examples.length === 0) {
        return {
            dataset: {
                rows: rows.length,
                labeled: 0,
                trainCount: 0,
                testCount: 0
            },
            modes: []
        };
    }

    // Split train/test
    const { train, test } = trainTestSplit(examples, { testRatio, seed: 42 });

    // Evaluate each mode
    const modeResults = [];

    for (const modeDesc of modes) {
        const { id, mode, modelPath } = modeDesc;

        try {
            // Score test set
            const scored = scoreBatch(test, { mode, modelPath });

            // Extract scores and labels
            const scores = scored.map(s => s.score);
            const labels = test.map(ex => ex.label);

            // Calculate metrics
            const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            const avgLabel = labels.reduce((sum, l) => sum + l, 0) / labels.length;
            const corr = correlation(scores, labels);

            // Compute score buckets
            const buckets = [
                { from: 0.0, to: 0.2, count: 0, labelSum: 0 },
                { from: 0.2, to: 0.4, count: 0, labelSum: 0 },
                { from: 0.4, to: 0.6, count: 0, labelSum: 0 },
                { from: 0.6, to: 0.8, count: 0, labelSum: 0 },
                { from: 0.8, to: 1.0, count: 0, labelSum: 0 }
            ];

            for (let i = 0; i < scored.length; i++) {
                const score = scored[i].score;
                const label = test[i].label;

                for (const bucket of buckets) {
                    if (score >= bucket.from && (score < bucket.to || (score === 1.0 && bucket.to === 1.0))) {
                        bucket.count++;
                        bucket.labelSum += label;
                        break;
                    }
                }
            }

            // Calculate avgLabel per bucket
            const bucketsWithAvg = buckets.map(b => ({
                from: b.from,
                to: b.to,
                count: b.count,
                avgLabel: b.count > 0 ? b.labelSum / b.count : 0
            }));

            modeResults.push({
                id,
                mode,
                avgScore,
                avgLabel,
                correlation: corr,
                buckets: bucketsWithAvg
            });
        } catch (err) {
            console.warn(`[scoringComparison] Failed to evaluate mode ${id}:`, err.message);
            modeResults.push({
                id,
                mode,
                error: err.message
            });
        }
    }

    return {
        dataset: {
            rows: rows.length,
            labeled: examples.length,
            trainCount: train.length,
            testCount: test.length
        },
        modes: modeResults
    };
}

module.exports = {
    compareScoringModes
};
