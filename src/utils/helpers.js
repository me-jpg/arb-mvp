// src/utils/helpers.js
// Utility functions for scraping and error handling

/**
 * Random delay between min and max milliseconds
 */
function delay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delayMs - Initial delay between retries (doubles each time)
 * @param {string} context - Context for logging (e.g., book name)
 * @returns {Promise<{result: any, retryCount: number}>} - Result and retry count
 */
async function runWithRetries(fn, maxRetries = 3, delayMs = 2000, context = 'operation') {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        console.log(`✅ ${context} succeeded on attempt ${attempt}`);
      }
      return { result, retryCount: attempt - 1 };
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;
      
      if (isLastAttempt) {
        console.error(`❌ ${context} failed after ${maxRetries} attempts:`, error.message);
        throw error;
      }
      
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.warn(`⚠️  ${context} failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
      console.warn(`   Retrying in ${waitTime}ms...`);
      
      await delay(waitTime, waitTime);
    }
  }
  
  throw lastError;
}

/**
 * Log error with structured data
 */
function logError(error, context = 'Unknown') {
  const errorData = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message,
    stack: error.stack,
    type: error.name
  };
  
  console.error(`\n❌ ERROR [${context}]:`, JSON.stringify(errorData, null, 2));
  return errorData;
}

/**
 * Convert American odds to decimal
 */
function americanToDecimal(american) {
  const n = Number(american);
  if (Number.isNaN(n)) return null;

  if (n > 0) {
    return 1 + (n / 100);
  } else if (n < 0) {
    return 1 + (100 / Math.abs(n));
  } else {
    return null;
  }
}

module.exports = {
  delay,
  runWithRetries,
  logError,
  americanToDecimal
};