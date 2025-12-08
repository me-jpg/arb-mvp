/**
 * src/execution/executionRetryPolicy.js
 * 
 * Execution retry policy with exponential backoff.
 * Pure functions, deterministic, no side effects.
 */

/**
 * Build retry policy from configuration.
 * 
 * @param {Object} config - Retry configuration
 * @returns {Object} Retry policy with defaults applied
 */
function buildRetryPolicy(config = {}) {
    return {
        maxAttempts: config.maxAttempts !== undefined ? config.maxAttempts : 1,
        baseDelayMs: config.baseDelayMs !== undefined ? config.baseDelayMs : 100,
        maxDelayMs: config.maxDelayMs !== undefined ? config.maxDelayMs : 2000,
        backoffFactor: config.backoffFactor !== undefined ? config.backoffFactor : 2,
        retryableErrorCodes: config.retryableErrorCodes || ['NETWORK_ERROR', 'TIMEOUT'],
        retryableFailureReasons: config.retryableFailureReasons || ['transient', 'unknown']
    };
}

/**
 * Determine if execution should be retried.
 * 
 * @param {Object} attemptContext - Attempt context
 * @param {number} attemptContext.attemptNumber - Current attempt number (1-based)
 * @param {string} [attemptContext.errorCode] - Error code from failure
 * @param {string} [attemptContext.failureReason] - Failure reason
 * @param {Object} attemptContext.policy - Retry policy
 * @returns {boolean} True if should retry
 */
function shouldRetryExecution(attemptContext) {
    const { attemptNumber, errorCode, failureReason, policy } = attemptContext;

    // Exceeded max attempts
    if (attemptNumber >= policy.maxAttempts) {
        return false;
    }

    // Check for retryable error code
    if (errorCode && policy.retryableErrorCodes.includes(errorCode)) {
        return true;
    }

    // Check for retryable failure reason
    if (failureReason && policy.retryableFailureReasons.includes(failureReason)) {
        return true;
    }

    return false;
}

/**
 * Compute next backoff delay in milliseconds.
 * 
 * @param {Object} attemptContext - Attempt context
 * @param {number} attemptContext.attemptNumber - Next attempt number (1-based)
 * @param {Object} attemptContext.policy - Retry policy
 * @returns {number} Delay in milliseconds
 */
function computeNextBackoffMs(attemptContext) {
    const { attemptNumber, policy } = attemptContext;

    // No delay for first attempt
    if (attemptNumber <= 1) {
        return 0;
    }

    // Exponential backoff: baseDelay * factor^(attempt - 2)
    // attempt 2: baseDelay * factor^0 = baseDelay
    // attempt 3: baseDelay * factor^1 = baseDelay * factor
    // attempt 4: baseDelay * factor^2 = baseDelay * factor^2
    const delay = policy.baseDelayMs * Math.pow(policy.backoffFactor, attemptNumber - 2);

    // Clamp to max delay
    return Math.min(delay, policy.maxDelayMs);
}

module.exports = {
    buildRetryPolicy,
    shouldRetryExecution,
    computeNextBackoffMs
};
