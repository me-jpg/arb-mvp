// src/utils/shapeValidator.js
// Lightweight runtime shape validation for core data types
// Logs warnings on mismatch; does not throw

// Limit log spam
const MAX_WARNINGS_PER_CONTEXT = 3;
const warningCounts = new Map();

function shouldLog(context) {
  const count = warningCounts.get(context) || 0;
  if (count >= MAX_WARNINGS_PER_CONTEXT) return false;
  warningCounts.set(context, count + 1);
  return true;
}

/**
 * Validate an object against a simple schema
 * @param {Object} obj - Object to validate
 * @param {Object} schema - { fieldName: 'string'|'number'|'boolean'|'object'|'any', ... }
 * @param {string} context - Where validation is happening (for logs)
 * @returns {boolean} true if valid
 */
function validateShape(obj, schema, context) {
  if (!obj || typeof obj !== 'object') {
    if (shouldLog(context)) {
      console.warn(`[SHAPE_WARN] ${context}: Expected object, got ${typeof obj}`);
    }
    return false;
  }

  let valid = true;
  for (const [field, expectedType] of Object.entries(schema)) {
    const value = obj[field];
    
    // Check required field exists
    if (value === undefined || value === null) {
      if (shouldLog(context)) {
        console.warn(`[SHAPE_WARN] ${context}: Missing required field "${field}"`);
      }
      valid = false;
      continue;
    }
    
    // Check type
    if (expectedType === 'any') continue;
    
    const actualType = typeof value;
    if (expectedType === 'object' && actualType === 'object') continue;
    if (actualType !== expectedType) {
      if (shouldLog(context)) {
        console.warn(`[SHAPE_WARN] ${context}: Field "${field}" expected ${expectedType}, got ${actualType} (value: ${JSON.stringify(value).slice(0, 50)})`);
      }
      valid = false;
    }
  }
  
  return valid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Focused validators for core types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a LineChange object
 * Key fields: event_id, book, market_type, side, old_price, new_price, change_type, detected_at
 */
function validateLineChange(obj, context = 'lineChange') {
  const schema = {
    event_id: 'string',
    book: 'string',
    market_type: 'string',
    side: 'string',
    old_price: 'number',
    new_price: 'number',
    change_type: 'string'
    // detected_at checked separately - can be Date or string
  };
  
  let valid = validateShape(obj, schema, context);
  
  // Check detected_at exists (can be Date object or ISO string)
  if (obj && obj.detected_at === undefined && obj.created_at === undefined) {
    if (shouldLog(context)) {
      console.warn(`[SHAPE_WARN] ${context}: Missing timestamp field "detected_at" (found neither detected_at nor created_at)`);
    }
    valid = false;
  }
  
  // Warn if using wrong field name
  if (obj && obj.created_at !== undefined && obj.detected_at === undefined) {
    if (shouldLog(context)) {
      console.warn(`[SHAPE_WARN] ${context}: LineChange uses "created_at" but should use "detected_at"!`);
    }
    valid = false;
  }
  
  return valid;
}

/**
 * Validate a LatencyMetric object
 * Key fields: book, windowCount, fractionFirstToMove, fractionLastToMove, avgDelayMsVsFastest
 */
function validateLatencyMetric(obj, context = 'latencyMetric') {
  const schema = {
    book: 'string',
    windowCount: 'number',
    fractionFirstToMove: 'number',
    fractionLastToMove: 'number',
    avgDelayMsVsFastest: 'number'
  };
  
  return validateShape(obj, schema, context);
}

/**
 * Validate a StaleLineEvent object
 * Key fields: eventId, marketType, staleBook, referenceBook, staleDurationMs
 */
function validateStaleLineEvent(obj, context = 'staleLineEvent') {
  const schema = {
    eventId: 'string',
    marketType: 'string',
    staleBook: 'string',
    referenceBook: 'string',
    staleDurationMs: 'number'
  };
  
  return validateShape(obj, schema, context);
}

/**
 * Validate a Signal object
 * Key fields: id, createdAt, type, eventId, marketType, side, primaryBook, price, edgeEstimate
 */
function validateSignal(obj, context = 'signal') {
  const schema = {
    id: 'string',
    createdAt: 'string',
    type: 'string',
    eventId: 'string',
    marketType: 'string',
    side: 'string',
    primaryBook: 'string',
    price: 'number',
    edgeEstimate: 'number'
  };
  
  let valid = validateShape(obj, schema, context);
  
  // Validate type enum
  const validTypes = ['pure_arb', 'stale_vs_book', 'latency_edge'];
  if (obj && obj.type && !validTypes.includes(obj.type)) {
    if (shouldLog(context)) {
      console.warn(`[SHAPE_WARN] ${context}: Invalid signal type "${obj.type}", expected one of: ${validTypes.join(', ')}`);
    }
    valid = false;
  }
  
  return valid;
}

/**
 * Reset warning counts (useful for tests)
 */
function resetWarningCounts() {
  warningCounts.clear();
}

module.exports = {
  validateShape,
  validateLineChange,
  validateLatencyMetric,
  validateStaleLineEvent,
  validateSignal,
  resetWarningCounts
};

