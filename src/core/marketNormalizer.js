// src/core/marketNormalizer.js
// Normalizes market types, spread values, and total values across different sportsbooks

const MARKET_TYPE_MAPPINGS = {
  // Moneyline variations
  'moneyline': 'moneyline',
  'ml': 'moneyline',
  'money line': 'moneyline',
  'winner': 'moneyline',
  '2-way': 'moneyline',
  '2way': 'moneyline',
  
  // Spread variations
  'spread': 'spread',
  'point spread': 'spread',
  'pointspread': 'spread',
  'handicap': 'spread',
  'line': 'spread',
  'points': 'spread',
  
  // Total variations
  'total': 'total',
  'over/under': 'total',
  'o/u': 'total',
  'ou': 'total',
  'total points': 'total',
  'totalpoints': 'total',
  'game total': 'total'
};

/**
 * Normalize market type string
 * @param {string} rawMarket - Raw market type from scraper
 * @returns {string} - Normalized market type ('moneyline', 'spread', or 'total')
 */
function normalizeMarketType(rawMarket) {
  if (!rawMarket) return null;
  
  const cleaned = rawMarket
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9/\s]/g, '');
  
  const normalized = MARKET_TYPE_MAPPINGS[cleaned];
  
  if (!normalized) {
    console.warn(`⚠️  Unknown market type: "${rawMarket}" -> "${cleaned}"`);
    return rawMarket.trim();
  }
  
  return normalized;
}

/**
 * Normalize spread value
 * @param {string|number} rawSpread - Raw spread value (e.g., "-3.5", "PK", "+7")
 * @returns {number|null} - Normalized spread as number, or null if invalid
 */
function normalizeSpreadValue(rawSpread) {
  if (rawSpread === null || rawSpread === undefined) return null;
  
  // Convert to string for processing
  const str = String(rawSpread).trim();
  
  // Handle special cases
  const cleaned = str
    .toLowerCase()
    .replace('−', '-')  // unicode minus to regular minus
    .replace(/\s+/g, '');
  
  // Pick'em (no spread)
  if (cleaned === 'pk' || cleaned === 'pick' || cleaned === 'even') {
    return 0;
  }
  
  // Parse numeric value
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) {
    console.warn(`⚠️  Invalid spread value: "${rawSpread}"`);
    return null;
  }
  
  // Round to nearest 0.5 (standard NFL spreads)
  return Math.round(num * 2) / 2;
}

/**
 * Normalize total value
 * @param {string|number} rawTotal - Raw total value (e.g., "46.5", "o 47", "Under 45.5")
 * @returns {number|null} - Normalized total as number, or null if invalid
 */
function normalizeTotalValue(rawTotal) {
  if (rawTotal === null || rawTotal === undefined) return null;
  
  // Convert to string and clean
  const cleaned = String(rawTotal)
    .toLowerCase()
    .replace(/over|under|o|u/gi, '')
    .replace(/\s+/g, '')
    .replace('−', '-')
    .trim();
  
  // Parse numeric value
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) {
    console.warn(`⚠️  Invalid total value: "${rawTotal}"`);
    return null;
  }
  
  // NFL totals are typically 0.5 increments
  return Math.round(num * 2) / 2;
}

/**
 * Create unique market key for matching across books
 * @param {string} marketType - Market type ('moneyline', 'spread', 'total')
 * @param {number|null} lineValue - Spread or total value (null for moneyline)
 * @returns {string} - Market key (e.g., "moneyline", "spread_-3.5", "total_46.5")
 */
function createMarketKey(marketType, lineValue = null) {
  const normalized = normalizeMarketType(marketType);
  
  if (normalized === 'moneyline') {
    return 'moneyline';
  }
  
  if (normalized === 'spread' && lineValue !== null) {
    const normalizedValue = normalizeSpreadValue(lineValue);
    if (normalizedValue === null) return null;
    return `spread_${normalizedValue}`;
  }
  
  if (normalized === 'total' && lineValue !== null) {
    const normalizedValue = normalizeTotalValue(lineValue);
    if (normalizedValue === null) return null;
    return `total_${normalizedValue}`;
  }
  
  console.warn(`⚠️  Could not create market key: type=${marketType}, line=${lineValue}`);
  return null;
}

/**
 * Validate market data structure
 * @param {object} market - Market object from scraper
 * @param {string} marketType - Expected market type
 * @returns {boolean} - True if valid
 */
function validateMarketData(market, marketType) {
  if (!market || typeof market !== 'object') {
    return false;
  }
  
  switch (marketType) {
    case 'moneyline':
      return typeof market.awayOdds === 'number' && 
             typeof market.homeOdds === 'number';
    
    case 'spread':
      return typeof market.awayLine === 'number' &&
             typeof market.homeLine === 'number' &&
             typeof market.awayOdds === 'number' &&
             typeof market.homeOdds === 'number';
    
    case 'total':
      return typeof market.line === 'number' &&
             typeof market.overOdds === 'number' &&
             typeof market.underOdds === 'number';
    
    default:
      return false;
  }
}

/**
 * Check if two spread/total values are equivalent (within tolerance)
 * @param {number} value1 - First value
 * @param {number} value2 - Second value
 * @param {number} tolerance - Allowable difference (default 0.5)
 * @returns {boolean} - True if values match within tolerance
 */
function linesMatch(value1, value2, tolerance = 0.5) {
  if (value1 === null || value2 === null) return false;
  return Math.abs(value1 - value2) <= tolerance;
}

/**
 * Extract all valid markets from scraped game data
 * @param {object} gameData - Scraped game with markets object
 * @returns {array} - Array of {marketKey, marketType, marketData} objects
 */
function extractMarkets(gameData) {
  const markets = [];
  
  if (!gameData.markets || typeof gameData.markets !== 'object') {
    return markets;
  }
  
  // Extract moneyline
  if (gameData.markets.moneyline && validateMarketData(gameData.markets.moneyline, 'moneyline')) {
    markets.push({
      marketKey: 'moneyline',
      marketType: 'moneyline',
      marketData: gameData.markets.moneyline
    });
  }
  
  // Extract spread
  if (gameData.markets.spread && validateMarketData(gameData.markets.spread, 'spread')) {
    const spreadKey = createMarketKey('spread', gameData.markets.spread.awayLine);
    if (spreadKey) {
      markets.push({
        marketKey: spreadKey,
        marketType: 'spread',
        marketData: gameData.markets.spread
      });
    }
  }
  
  // Extract total
  if (gameData.markets.total && validateMarketData(gameData.markets.total, 'total')) {
    const totalKey = createMarketKey('total', gameData.markets.total.line);
    if (totalKey) {
      markets.push({
        marketKey: totalKey,
        marketType: 'total',
        marketData: gameData.markets.total
      });
    }
  }
  
  return markets;
}

module.exports = {
  normalizeMarketType,
  normalizeSpreadValue,
  normalizeTotalValue,
  createMarketKey,
  validateMarketData,
  linesMatch,
  extractMarkets
};