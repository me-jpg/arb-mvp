/**
 * src/ml/trainTestSplitter.js
 * 
 * Deterministic train/test split with seeded shuffle.
 */

/**
 * Simple seeded PRNG (Linear Congruential Generator)
 */
function seededRandom(seed) {
    let state = seed;
    return function () {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };
}

/**
 * Shuffle array deterministically with seed.
 */
function shuffleWithSeed(array, seed) {
    const shuffled = [...array];
    const random = seededRandom(seed);

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

/**
 * Split examples into train and test sets.
 * @param {Array<Object>} examples - Labeled examples
 * @param {Object} options
 * @param {number} options.testRatio - Fraction for test set (default 0.2)
 * @param {number} options.shuffleSeed - Seed for deterministic shuffle (default 42)
 * @returns {Object} { train, test }
 */
function trainTestSplit(examples, { testRatio = 0.2, shuffleSeed = 42 } = {}) {
    if (!Array.isArray(examples) || examples.length === 0) {
        return { train: [], test: [] };
    }

    // Shuffle deterministically
    const shuffled = shuffleWithSeed(examples, shuffleSeed);

    // Calculate split point
    const testSize = Math.floor(shuffled.length * testRatio);
    const trainSize = shuffled.length - testSize;

    return {
        train: shuffled.slice(0, trainSize),
        test: shuffled.slice(trainSize)
    };
}

module.exports = {
    trainTestSplit,
    shuffleWithSeed
};
