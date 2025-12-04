// src/highfreq/arbitrageEngine.js
// Robust arbitrage detection engine for HF tracker
// Rewritten with proper grouping, multi-book detection, and instrumentation

const config = require('../../config');

// Debug flag - enable with ARB_DEBUG=true in .env
const ARB_DEBUG =
  process.env.ARB_DEBUG === 'true' ||
  process.env.ARB_DEBUG === '1' ||
  process.env.ARB_DEBUG === 'yes';

function debugLog(...args) {
  if (ARB_DEBUG) {
    console.log('[ARB_DEBUG]', ...args);
  }
}

/**
 * Convert American odds to implied probability
 * @param {number} odds - American odds (e.g., -110, +120)
 * @returns {number|null} - Implied probability (0-1) or null if invalid
 */
function americanToImpliedProb(odds) {
  if (odds == null || isNaN(odds)) return null;
  if (odds > 0) return 100 / (odds + 100);
  const abs = Math.abs(odds);
  return abs / (abs + 100);
}

/**
 * Convert American odds to decimal odds
 * @param {number} odds - American odds
 * @returns {number} - Decimal odds
 */
function americanToDecimal(odds) {
  if (odds > 0) {
    return (odds / 100) + 1;
  } else {
    return (100 / Math.abs(odds)) + 1;
  }
}

/**
 * Build a game key for grouping records by event
 * @param {object} record - Odds record
 * @returns {string} - Game key
 */
function buildGameKey(record) {
  const sport = (record.sport || '').toLowerCase();
  const league = (record.league || '').toLowerCase();
  const eventId = String(record.eventId || '');
  return `${sport}::${league}::${eventId}`;
}

/**
 * Build a market key for grouping within a game
 * @param {object} record - Odds record
 * @returns {string} - Market key
 */
function buildMarketKey(record) {
  const type = (record.marketType || '').toLowerCase();
  const line = record.line;
  
  if (type === 'spread' && line != null) {
    return `spread::${line}`;
  }
  if (type === 'total' || type === 'totals' || type === 'over_under') {
    if (line != null) {
      return `total::${line}`;
    }
    return 'total';
  }
  return 'moneyline';
}

/**
 * Get the outcome key (normalized side/outcome)
 * @param {object} record - Odds record
 * @returns {string} - Outcome key
 */
function getOutcomeKey(record) {
  const side = (record.side || record.outcome || '').toLowerCase();
  // Normalize various representations
  if (side === 'away' || side === 'away_team') return 'away';
  if (side === 'home' || side === 'home_team') return 'home';
  if (side === 'over') return 'over';
  if (side === 'under') return 'under';
  if (side === 'draw') return 'draw';
  return side;
}

/**
 * Compare two prices to find the best one for the bettor
 * Higher is better for positive odds, less negative is better for negative odds
 * @returns {number} - The better price
 */
function getBetterPrice(priceA, priceB) {
  if (priceA == null) return priceB;
  if (priceB == null) return priceA;
  
  // If one is positive and one is negative, positive is always better
  if (priceA > 0 && priceB < 0) return priceA;
  if (priceB > 0 && priceA < 0) return priceB;
  
  // Both positive: higher is better
  if (priceA > 0 && priceB > 0) return Math.max(priceA, priceB);
  
  // Both negative: closer to zero (less negative) is better
  return Math.max(priceA, priceB);
}

/**
 * Main arbitrage detection function
 * @param {Array} oddsRecords - Array of odds records from HF tracker
 * @param {Object} options - Options (cycleId, cycleStartedAt, minEdge)
 * @returns {Array} - Array of arbitrage opportunities
 */
function runArbitrageEngine(oddsRecords, options = {}) {
  const { cycleId = null, cycleStartedAt = null, minEdge = 0.0 } = options;
  const startTime = Date.now();

  if (!oddsRecords || oddsRecords.length === 0) {
    debugLog(`runArbitrageEngine: received 0 odds records cycle=${cycleId}`);
    return [];
  }

  const uniqueRawEventIds = new Set(oddsRecords.map(r => r.eventId));
  debugLog(`runArbitrageEngine: received ${oddsRecords.length} odds records across ${uniqueRawEventIds.size} unique raw eventIds cycle=${cycleId}`);

  // Step 1: Group records by gameKey -> marketKey -> outcome -> book
  const gameMap = new Map(); // gameKey -> { meta, markets: Map }

  for (const record of oddsRecords) {
    if (record.price == null || isNaN(record.price)) continue;

    const gameKey = buildGameKey(record);
    const marketKey = buildMarketKey(record);
    const outcomeKey = getOutcomeKey(record);
    const book = (record.book || '').toLowerCase();

    if (!book || !outcomeKey) continue;

    // Initialize game bucket
    if (!gameMap.has(gameKey)) {
      gameMap.set(gameKey, {
        meta: {
          eventId: record.eventId,
          sport: record.sport || 'nfl',
          league: record.league || '',
          eventTime: record.eventTime || null,
          homeTeam: record.homeTeam || null,
          awayTeam: record.awayTeam || null
        },
        markets: new Map()
      });
    }

    const gameBucket = gameMap.get(gameKey);

    // Initialize market bucket
    if (!gameBucket.markets.has(marketKey)) {
      gameBucket.markets.set(marketKey, {
        marketType: record.marketType,
        line: record.line,
        outcomes: new Map() // outcomeKey -> Map<book, record>
      });
    }

    const marketBucket = gameBucket.markets.get(marketKey);

    // Initialize outcome bucket
    if (!marketBucket.outcomes.has(outcomeKey)) {
      marketBucket.outcomes.set(outcomeKey, new Map());
    }

    const outcomeBucket = marketBucket.outcomes.get(outcomeKey);

    // Keep only the latest/best record per book for this outcome
    // (In case of duplicates, we take the one with better price)
    const existing = outcomeBucket.get(book);
    if (!existing || getBetterPrice(record.price, existing.price) === record.price) {
      outcomeBucket.set(book, record);
    }
  }

  // Step 2: Count multi-book markets for diagnostics
  const multiBookCounts = { moneyline: 0, spread: 0, total: 0 };
  let totalMultiBookMarkets = 0;

  for (const [gameKey, gameBucket] of gameMap) {
    for (const [marketKey, marketBucket] of gameBucket.markets) {
      // Collect all unique books across all outcomes in this market
      const booksInMarket = new Set();
      for (const [outcomeKey, outcomeBucket] of marketBucket.outcomes) {
        for (const book of outcomeBucket.keys()) {
          booksInMarket.add(book);
        }
      }

      if (booksInMarket.size >= 2) {
        totalMultiBookMarkets++;
        const mType = (marketBucket.marketType || 'moneyline').toLowerCase();
        if (mType === 'moneyline') multiBookCounts.moneyline++;
        else if (mType === 'spread') multiBookCounts.spread++;
        else if (mType === 'total' || mType === 'totals') multiBookCounts.total++;
      }
    }
  }

  debugLog(`Multi-book markets this cycle: ${JSON.stringify({
    ...multiBookCounts,
    totalMultiBookMarkets
  })}`);

  if (totalMultiBookMarkets === 0) {
    debugLog(`NO multi-book markets found this cycle. events=${gameMap.size} sampleGameKey=${gameMap.keys().next().value || 'none'} cycle=${cycleId}`);
    
    // Extra diagnostic: show sample records per game (SNAPSHOT format per spec)
    if (ARB_DEBUG && oddsRecords.length > 0) {
      debugLog('CYCLE MARKET SNAPSHOT:');
      let shown = 0;
      for (const record of oddsRecords) {
        if (shown++ >= 10) break;
        debugLog(`SNAPSHOT eventId=${record.eventId} book=${record.book} sport=${record.sport || ''} league=${record.league || ''} marketType=${record.marketType} line=${record.line} outcome=${record.side}`);
      }
    }
  }

  // Step 3: Find arbitrage opportunities
  const allArbs = [];

  for (const [gameKey, gameBucket] of gameMap) {
    for (const [marketKey, marketBucket] of gameBucket.markets) {
      // Check if this market has 2+ books
      const booksInMarket = new Set();
      for (const [outcomeKey, outcomeBucket] of marketBucket.outcomes) {
        for (const book of outcomeBucket.keys()) {
          booksInMarket.add(book);
        }
      }

      if (booksInMarket.size < 2) continue;

      // For two-way markets (moneyline home/away, spread, total over/under)
      // we need exactly 2 complementary outcomes
      const outcomes = Array.from(marketBucket.outcomes.keys());
      
      // Determine if this is a valid two-way market
      let isValidTwoWay = false;
      let outcomeA = null;
      let outcomeB = null;

      if (marketKey === 'moneyline' || marketKey.startsWith('moneyline')) {
        if (outcomes.includes('home') && outcomes.includes('away')) {
          isValidTwoWay = true;
          outcomeA = 'home';
          outcomeB = 'away';
        }
      } else if (marketKey.startsWith('spread')) {
        if (outcomes.includes('home') && outcomes.includes('away')) {
          isValidTwoWay = true;
          outcomeA = 'home';
          outcomeB = 'away';
        }
      } else if (marketKey.startsWith('total')) {
        if (outcomes.includes('over') && outcomes.includes('under')) {
          isValidTwoWay = true;
          outcomeA = 'over';
          outcomeB = 'under';
        }
      }

      if (!isValidTwoWay) continue;

      const outcomeBucketA = marketBucket.outcomes.get(outcomeA);
      const outcomeBucketB = marketBucket.outcomes.get(outcomeB);

      if (!outcomeBucketA || !outcomeBucketB) continue;

      // Find best price for each outcome
      let bestPriceA = null;
      let bestBookA = null;
      for (const [book, record] of outcomeBucketA) {
        if (bestPriceA == null || getBetterPrice(record.price, bestPriceA) === record.price) {
          bestPriceA = record.price;
          bestBookA = book;
        }
      }

      let bestPriceB = null;
      let bestBookB = null;
      for (const [book, record] of outcomeBucketB) {
        if (bestPriceB == null || getBetterPrice(record.price, bestPriceB) === record.price) {
          bestPriceB = record.price;
          bestBookB = book;
        }
      }

      if (bestPriceA == null || bestPriceB == null) continue;

      // Calculate implied probabilities
      const impliedA = americanToImpliedProb(bestPriceA);
      const impliedB = americanToImpliedProb(bestPriceB);

      if (impliedA == null || impliedB == null) continue;

      const totalImplied = impliedA + impliedB;

      // Arbitrage exists if sum of implied probabilities < 1
      if (totalImplied < 1) {
        const edge = 1 - totalImplied;

        if (edge >= minEdge) {
          // Calculate stakes for guaranteed profit (assuming $1000 total stake)
          const totalStake = config.totalStake || 1000;
          const decimalA = americanToDecimal(bestPriceA);
          const decimalB = americanToDecimal(bestPriceB);
          
          const stakeA = totalStake * (1 / decimalA) / totalImplied;
          const stakeB = totalStake * (1 / decimalB) / totalImplied;
          const guaranteedReturn = stakeA * decimalA;
          const profitAmount = guaranteedReturn - totalStake;

          allArbs.push({
            type: 'arb',
            edge,
            edgePercent: edge * 100,
            totalImplied,
            gameKey,
            marketKey,
            eventId: gameBucket.meta.eventId,
            sport: gameBucket.meta.sport,
            league: gameBucket.meta.league,
            eventTime: gameBucket.meta.eventTime,
            homeTeam: gameBucket.meta.homeTeam,
            awayTeam: gameBucket.meta.awayTeam,
            marketType: marketBucket.marketType,
            line: marketBucket.line,
            totalStake,
            profitAmount,
            guaranteedReturn,
            selections: [
              {
                outcome: outcomeA,
                book: bestBookA,
                price: bestPriceA,
                impliedProbability: impliedA,
                stake: stakeA
              },
              {
                outcome: outcomeB,
                book: bestBookB,
                price: bestPriceB,
                impliedProbability: impliedB,
                stake: stakeB
              }
            ],
            timestamp: new Date().toISOString(),
            cycleId
          });
        }
      }
    }
  }

  // Sort by edge descending
  allArbs.sort((a, b) => b.edge - a.edge);

  // Debug log results
  if (allArbs.length === 0) {
    debugLog(`Detector found 0 arbitrage opportunities this cycle. cycle=${cycleId}`);
  } else {
    debugLog(`Detector found ${allArbs.length} arbitrage opportunities this cycle. cycle=${cycleId}`);
    // Log top 3
    const top3 = allArbs.slice(0, 3);
    top3.forEach((arb, i) => {
      debugLog(`  ${i + 1}. edge=${(arb.edge * 100).toFixed(3)}% gameKey=${arb.gameKey} marketKey=${arb.marketKey} eventId=${arb.eventId}`);
      debugLog(`     selections: ${JSON.stringify(arb.selections.map(s => ({ outcome: s.outcome, book: s.book, price: s.price })))}`);
    });
  }

  const processingMs = Date.now() - startTime;
  debugLog(`Arbitrage engine completed in ${processingMs}ms`);

  return allArbs;
}

/**
 * Legacy wrapper for backward compatibility
 * Maps to the old findArbitrageOpportunities API
 */
function findArbitrageOpportunities(oddsRecords, options = {}) {
  const cycleId = options.cycleId || `${Date.now()}`;
  const opportunities = runArbitrageEngine(oddsRecords, { ...options, cycleId });

  // Transform to legacy format expected by hfTracker
  const legacyOpportunities = opportunities.map(arb => ({
    eventId: arb.eventId,
    event: arb.awayTeam && arb.homeTeam ? `${arb.awayTeam} @ ${arb.homeTeam}` : arb.eventId,
    marketType: arb.marketType,
    line: arb.line,
    bookA: arb.selections[0]?.book,
    priceA: arb.selections[0]?.price,
    sideA: arb.selections[0]?.outcome,
    stakeA: arb.selections[0]?.stake,
    bookB: arb.selections[1]?.book,
    priceB: arb.selections[1]?.price,
    sideB: arb.selections[1]?.outcome,
    stakeB: arb.selections[1]?.stake,
    edgePercent: arb.edgePercent,
    profitAmount: arb.profitAmount,
    totalStake: arb.totalStake,
    guaranteedReturn: arb.guaranteedReturn,
    timestamp: arb.timestamp,
    isArbitrage: true,
    // Include raw arb for JSONL logging
    _raw: arb
  }));

  return {
    opportunities: legacyOpportunities,
    stats: {
      eventsInspected: new Set(oddsRecords.map(r => r.eventId)).size,
      marketsInspected: oddsRecords.length,
      opportunitiesFound: opportunities.length,
      processingMs: 0 // Already logged in runArbitrageEngine
    }
  };
}

/**
 * Format opportunities for database insertion
 * Maps to edges table schema
 */
function formatForDatabase(opportunities) {
  return opportunities.map(opp => ({
    eventId: opp.eventId,
    marketType: opp.marketType,
    line: opp.line,
    bookA: opp.bookA,
    bookB: opp.bookB,
    edgePercent: opp.edgePercent,
    isArbitrage: true
  }));
}

/**
 * Format opportunity for WebSocket broadcast
 */
function formatForBroadcast(opportunity) {
  return {
    type: 'arbitrage',
    timestamp: opportunity.timestamp || new Date().toISOString(),
    eventId: opportunity.eventId,
    event: opportunity.event,
    marketType: opportunity.marketType,
    line: opportunity.line,
    opportunity: {
      bookA: opportunity.bookA,
      priceA: opportunity.priceA,
      sideA: opportunity.sideA,
      stakeA: parseFloat(opportunity.stakeA?.toFixed(2)) || 0,
      bookB: opportunity.bookB,
      priceB: opportunity.priceB,
      sideB: opportunity.sideB,
      stakeB: parseFloat(opportunity.stakeB?.toFixed(2)) || 0,
      edgePercent: parseFloat(opportunity.edgePercent?.toFixed(3)) || 0,
      profitAmount: parseFloat(opportunity.profitAmount?.toFixed(2)) || 0,
      totalStake: opportunity.totalStake
    }
  };
}

/**
 * Format all opportunities for batch WebSocket broadcast
 */
function formatBatchForBroadcast(opportunities) {
  if (opportunities.length === 0) return null;
  
  return {
    type: 'arbitrage_batch',
    timestamp: new Date().toISOString(),
    count: opportunities.length,
    bestEdge: Math.max(...opportunities.map(o => o.edgePercent || 0)),
    opportunities: opportunities.map(formatForBroadcast)
  };
}

/**
 * Log arbitrage summary to console
 */
function logArbitrageSummary(opportunities, stats) {
  if (opportunities.length === 0) {
    console.log(`🔍 Arb scan: ${stats.eventsInspected} events, ${stats.marketsInspected} markets — no opportunities`);
    return;
  }

  const bestEdge = Math.max(...opportunities.map(o => o.edgePercent));
  console.log(`\n💰 ARBITRAGE DETECTED: ${opportunities.length} opportunities (best: ${bestEdge.toFixed(2)}%)`);
  
  opportunities.slice(0, 5).forEach((opp, i) => {
    console.log(`   ${i + 1}. ${opp.marketType?.toUpperCase() || 'UNKNOWN'} | ${opp.bookA} vs ${opp.bookB} | ${opp.edgePercent?.toFixed(2)}% edge`);
    console.log(`      ${opp.sideA} @ ${opp.priceA} (${opp.bookA}) vs ${opp.sideB} @ ${opp.priceB} (${opp.bookB})`);
    console.log(`      Stakes: $${opp.stakeA?.toFixed(2)} / $${opp.stakeB?.toFixed(2)} → Profit: $${opp.profitAmount?.toFixed(2)}`);
  });
}

module.exports = {
  runArbitrageEngine,
  findArbitrageOpportunities,
  formatForDatabase,
  formatForBroadcast,
  formatBatchForBroadcast,
  logArbitrageSummary,
  americanToImpliedProb,
  americanToDecimal
};
