// src/utils/arbitrageMatcher.js
// Real-time arbitrage detection for HF tracker

const config = require('../../config');

/**
 * Convert American odds to decimal
 */
function americanToDecimal(american) {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Calculate optimal stake allocation
 */
function calculateStakes(decimalA, decimalB, totalStake) {
  const stakeA = totalStake / (1 + (decimalA / decimalB));
  const stakeB = totalStake - stakeA;
  return { stakeA, stakeB };
}

/**
 * Check if two odds records can create an arbitrage
 */
function checkArbitrage(oddA, oddB, totalStake = 1000) {
  // Must be opposite sides of same market
  if (oddA.marketType !== oddB.marketType) return null;
  if (oddA.eventId !== oddB.eventId) return null;
  if (oddA.book === oddB.book) return null;

  let isOpposite = false;
  
  if (oddA.marketType === 'moneyline') {
    isOpposite = oddA.side !== oddB.side;
  } else if (oddA.marketType === 'spread') {
    // Spreads must be opposite (away vs home) and lines must match/be close
    isOpposite = oddA.side !== oddB.side && 
                 Math.abs(Math.abs(oddA.line) - Math.abs(oddB.line)) < 0.5;
  } else if (oddA.marketType === 'total') {
    // Totals must be opposite (over vs under) and lines must match
    isOpposite = oddA.side !== oddB.side && 
                 Math.abs(oddA.line - oddB.line) < 0.5;
  }

  if (!isOpposite) return null;

  // Convert to decimal odds
  const decimalA = americanToDecimal(oddA.price);
  const decimalB = americanToDecimal(oddB.price);

  // Calculate arbitrage percentage
  const arbPercentage = (1 / decimalA + 1 / decimalB) * 100;
  const profitMargin = 100 - arbPercentage;

  // Check if profitable (considering vig/fees)
  if (profitMargin < config.minProfitMargin) {
    return null;
  }

  // Calculate stakes
  const { stakeA, stakeB } = calculateStakes(decimalA, decimalB, totalStake);
  const expectedProfit = totalStake * (profitMargin / 100);

  return {
    eventId: oddA.eventId,
    marketType: oddA.marketType,
    profitMargin: parseFloat(profitMargin.toFixed(2)),
    totalStake,
    expectedProfit: parseFloat(expectedProfit.toFixed(2)),
    bookA: oddA.book,
    bookB: oddB.book,
    sideA: oddA.side,
    sideB: oddB.side,
    priceA: oddA.price,
    priceB: oddB.price,
    lineA: oddA.line,
    lineB: oddB.line,
    stakeA: parseFloat(stakeA.toFixed(2)),
    stakeB: parseFloat(stakeB.toFixed(2)),
    decimalA: parseFloat(decimalA.toFixed(3)),
    decimalB: parseFloat(decimalB.toFixed(3))
  };
}

/**
 * Find all arbitrage opportunities in current odds
 */
function findArbitrageOpportunities(oddsRecords, totalStake = 1000) {
  const opportunities = [];
  
  // Group odds by event and market
  const groupedOdds = {};
  
  oddsRecords.forEach(odd => {
    const key = `${odd.eventId}|${odd.marketType}`;
    if (!groupedOdds[key]) {
      groupedOdds[key] = [];
    }
    groupedOdds[key].push(odd);
  });

  // Check each group for arbitrage
  Object.values(groupedOdds).forEach(group => {
    // Compare each pair of odds in the group
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const arb = checkArbitrage(group[i], group[j], totalStake);
        if (arb) {
          opportunities.push(arb);
        }
      }
    }
  });

  // Sort by profit margin (highest first)
  return opportunities.sort((a, b) => b.profitMargin - a.profitMargin);
}

module.exports = {
  findArbitrageOpportunities,
  americanToDecimal,
  checkArbitrage
};