// src/core/detector.js
// Pure arbitrage detector - exact stake distribution for guaranteed profit

const config = require('../../config');

/**
 * Check if a line is stale (too old)
 */
function isLineStale(bookData, maxAgeSeconds = config.staleThreshold || 120) {
  if (!bookData || !bookData.timestamp) {
    console.warn('⚠️  Book data missing timestamp, treating as stale');
    return true;
  }
  
  const age = (Date.now() - bookData.timestamp) / 1000;
  
  if (age > maxAgeSeconds) {
    console.log(`⏰ Stale line detected: ${age.toFixed(1)}s old (max ${maxAgeSeconds}s)`);
    return true;
  }
  
  return false;
}

/**
 * Filter out stale books from a market
 */
function filterStaleBooks(market) {
  const fresh = { ...market, books: {} };
  
  Object.entries(market.books).forEach(([bookName, bookData]) => {
    if (!isLineStale(bookData)) {
      fresh.books[bookName] = bookData;
    }
  });
  
  return fresh;
}

/**
 * Convert American odds to decimal
 */
function americanToDecimal(americanOdds) {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

/**
 * Calculate arbitrage for moneyline market
 * Pure arbitrage mathematics - stakes calculated to equalize payouts
 */
function detectMoneylineArbitrage(market, event) {
  const arbitrages = [];
  const books = Object.keys(market.books);
  
  for (let i = 0; i < books.length; i++) {
    for (let j = i + 1; j < books.length; j++) {
      const book1 = books[i];
      const book2 = books[j];
      
      const data1 = market.books[book1];
      const data2 = market.books[book2];
      
      // Try: away from book1, home from book2
      const awayDecimal1 = americanToDecimal(data1.awayOdds);
      const homeDecimal2 = americanToDecimal(data2.homeOdds);
      
      const impliedProb1 = 1 / awayDecimal1 + 1 / homeDecimal2;
      
      if (impliedProb1 < 1) {
        const profitMargin = (1 - impliedProb1) * 100;
        
        if (profitMargin >= config.minProfitMargin) {
          const stake1 = config.totalStake * (1 / awayDecimal1) / impliedProb1;
          const stake2 = config.totalStake * (1 / homeDecimal2) / impliedProb1;
          const guaranteedReturn = stake1 * awayDecimal1;
          const profit = guaranteedReturn - config.totalStake;
          
          arbitrages.push({
            detected: new Date().toISOString(),
            event: `${event.awayTeam} @ ${event.homeTeam}`,
            gameTime: event.gameTime,
            gameDate: event.gameDate,
            marketType: 'moneyline',
            profitMargin,
            profitAmount: profit,
            totalStake: config.totalStake,
            guaranteedReturn,
            book1,
            selection1: event.awayTeam,
            americanOdds1: data1.awayOdds,
            decimalOdds1: awayDecimal1,
            stake1,
            url1: data1.url,
            book2,
            selection2: event.homeTeam,
            americanOdds2: data2.homeOdds,
            decimalOdds2: homeDecimal2,
            stake2,
            url2: data2.url
          });
        }
      }
      
      // Try: home from book1, away from book2
      const homeDecimal1 = americanToDecimal(data1.homeOdds);
      const awayDecimal2 = americanToDecimal(data2.awayOdds);
      
      const impliedProb2 = 1 / homeDecimal1 + 1 / awayDecimal2;
      
      if (impliedProb2 < 1) {
        const profitMargin = (1 - impliedProb2) * 100;
        
        if (profitMargin >= config.minProfitMargin) {
          const stake1 = config.totalStake * (1 / homeDecimal1) / impliedProb2;
          const stake2 = config.totalStake * (1 / awayDecimal2) / impliedProb2;
          const guaranteedReturn = stake1 * homeDecimal1;
          const profit = guaranteedReturn - config.totalStake;
          
          arbitrages.push({
            detected: new Date().toISOString(),
            event: `${event.awayTeam} @ ${event.homeTeam}`,
            gameTime: event.gameTime,
            gameDate: event.gameDate,
            marketType: 'moneyline',
            profitMargin,
            profitAmount: profit,
            totalStake: config.totalStake,
            guaranteedReturn,
            book1,
            selection1: event.homeTeam,
            americanOdds1: data1.homeOdds,
            decimalOdds1: homeDecimal1,
            stake1,
            url1: data1.url,
            book2,
            selection2: event.awayTeam,
            americanOdds2: data2.awayOdds,
            decimalOdds2: awayDecimal2,
            stake2,
            url2: data2.url
          });
        }
      }
    }
  }
  
  return arbitrages;
}

/**
 * Calculate arbitrage for spread market
 */
function detectSpreadArbitrage(market, event, marketKey) {
  const arbitrages = [];
  const books = Object.keys(market.books);
  
  const spreadValue = parseFloat(marketKey.split('_')[1]);
  
  for (let i = 0; i < books.length; i++) {
    for (let j = i + 1; j < books.length; j++) {
      const book1 = books[i];
      const book2 = books[j];
      
      const data1 = market.books[book1];
      const data2 = market.books[book2];
      
      // Try: away from book1, home from book2
      const awayDecimal1 = americanToDecimal(data1.awayOdds);
      const homeDecimal2 = americanToDecimal(data2.homeOdds);
      
      const impliedProb1 = 1 / awayDecimal1 + 1 / homeDecimal2;
      
      if (impliedProb1 < 1) {
        const profitMargin = (1 - impliedProb1) * 100;
        
        if (profitMargin >= config.minProfitMargin) {
          const stake1 = config.totalStake * (1 / awayDecimal1) / impliedProb1;
          const stake2 = config.totalStake * (1 / homeDecimal2) / impliedProb1;
          const guaranteedReturn = stake1 * awayDecimal1;
          const profit = guaranteedReturn - config.totalStake;
          
          arbitrages.push({
            detected: new Date().toISOString(),
            event: `${event.awayTeam} @ ${event.homeTeam}`,
            gameTime: event.gameTime,
            gameDate: event.gameDate,
            marketType: 'spread',
            spreadValue,
            profitMargin,
            profitAmount: profit,
            totalStake: config.totalStake,
            guaranteedReturn,
            book1,
            selection1: `${event.awayTeam} ${data1.awayLine}`,
            americanOdds1: data1.awayOdds,
            decimalOdds1: awayDecimal1,
            stake1,
            url1: data1.url,
            book2,
            selection2: `${event.homeTeam} ${data2.homeLine}`,
            americanOdds2: data2.homeOdds,
            decimalOdds2: homeDecimal2,
            stake2,
            url2: data2.url
          });
        }
      }
      
      // Try: home from book1, away from book2
      const homeDecimal1 = americanToDecimal(data1.homeOdds);
      const awayDecimal2 = americanToDecimal(data2.awayOdds);
      
      const impliedProb2 = 1 / homeDecimal1 + 1 / awayDecimal2;
      
      if (impliedProb2 < 1) {
        const profitMargin = (1 - impliedProb2) * 100;
        
        if (profitMargin >= config.minProfitMargin) {
          const stake1 = config.totalStake * (1 / homeDecimal1) / impliedProb2;
          const stake2 = config.totalStake * (1 / awayDecimal2) / impliedProb2;
          const guaranteedReturn = stake1 * homeDecimal1;
          const profit = guaranteedReturn - config.totalStake;
          
          arbitrages.push({
            detected: new Date().toISOString(),
            event: `${event.awayTeam} @ ${event.homeTeam}`,
            gameTime: event.gameTime,
            gameDate: event.gameDate,
            marketType: 'spread',
            spreadValue,
            profitMargin,
            profitAmount: profit,
            totalStake: config.totalStake,
            guaranteedReturn,
            book1,
            selection1: `${event.homeTeam} ${data1.homeLine}`,
            americanOdds1: data1.homeOdds,
            decimalOdds1: homeDecimal1,
            stake1,
            url1: data1.url,
            book2,
            selection2: `${event.awayTeam} ${data2.awayLine}`,
            americanOdds2: data2.awayOdds,
            decimalOdds2: awayDecimal2,
            stake2,
            url2: data2.url
          });
        }
      }
    }
  }
  
  return arbitrages;
}

/**
 * Calculate arbitrage for total (over/under) market
 */
function detectTotalArbitrage(market, event, marketKey) {
  const arbitrages = [];
  const books = Object.keys(market.books);
  
  const totalValue = parseFloat(marketKey.split('_')[1]);
  
  for (let i = 0; i < books.length; i++) {
    for (let j = i + 1; j < books.length; j++) {
      const book1 = books[i];
      const book2 = books[j];
      
      const data1 = market.books[book1];
      const data2 = market.books[book2];
      
      // Try: over from book1, under from book2
      const overDecimal1 = americanToDecimal(data1.overOdds);
      const underDecimal2 = americanToDecimal(data2.underOdds);
      
      const impliedProb1 = 1 / overDecimal1 + 1 / underDecimal2;
      
      if (impliedProb1 < 1) {
        const profitMargin = (1 - impliedProb1) * 100;
        
        if (profitMargin >= config.minProfitMargin) {
          const stake1 = config.totalStake * (1 / overDecimal1) / impliedProb1;
          const stake2 = config.totalStake * (1 / underDecimal2) / impliedProb1;
          const guaranteedReturn = stake1 * overDecimal1;
          const profit = guaranteedReturn - config.totalStake;
          
          arbitrages.push({
            detected: new Date().toISOString(),
            event: `${event.awayTeam} @ ${event.homeTeam}`,
            gameTime: event.gameTime,
            gameDate: event.gameDate,
            marketType: 'total',
            totalValue,
            profitMargin,
            profitAmount: profit,
            totalStake: config.totalStake,
            guaranteedReturn,
            book1,
            selection1: `Over ${totalValue}`,
            americanOdds1: data1.overOdds,
            decimalOdds1: overDecimal1,
            stake1,
            url1: data1.url,
            book2,
            selection2: `Under ${totalValue}`,
            americanOdds2: data2.underOdds,
            decimalOdds2: underDecimal2,
            stake2,
            url2: data2.url
          });
        }
      }
      
      // Try: under from book1, over from book2
      const underDecimal1 = americanToDecimal(data1.underOdds);
      const overDecimal2 = americanToDecimal(data2.overOdds);
      
      const impliedProb2 = 1 / underDecimal1 + 1 / overDecimal2;
      
      if (impliedProb2 < 1) {
        const profitMargin = (1 - impliedProb2) * 100;
        
        if (profitMargin >= config.minProfitMargin) {
          const stake1 = config.totalStake * (1 / underDecimal1) / impliedProb2;
          const stake2 = config.totalStake * (1 / overDecimal2) / impliedProb2;
          const guaranteedReturn = stake1 * underDecimal1;
          const profit = guaranteedReturn - config.totalStake;
          
          arbitrages.push({
            detected: new Date().toISOString(),
            event: `${event.awayTeam} @ ${event.homeTeam}`,
            gameTime: event.gameTime,
            gameDate: event.gameDate,
            marketType: 'total',
            totalValue,
            profitMargin,
            profitAmount: profit,
            totalStake: config.totalStake,
            guaranteedReturn,
            book1,
            selection1: `Under ${totalValue}`,
            americanOdds1: data1.underOdds,
            decimalOdds1: underDecimal1,
            stake1,
            url1: data1.url,
            book2,
            selection2: `Over ${totalValue}`,
            americanOdds2: data2.overOdds,
            decimalOdds2: overDecimal2,
            stake2,
            url2: data2.url
          });
        }
      }
    }
  }
  
  return arbitrages;
}

/**
 * Detect all arbitrages from matched events
 */
function detectArbitrages(matchedEvents) {
  const allArbitrages = [];
  
  matchedEvents.forEach(event => {
    Object.entries(event.markets).forEach(([marketKey, market]) => {
      const freshMarket = filterStaleBooks(market);
      
      if (Object.keys(freshMarket.books).length < 2) {
        return;
      }
      
      let marketArbitrages = [];
      
      switch (market.marketType) {
        case 'moneyline':
          marketArbitrages = detectMoneylineArbitrage(freshMarket, event);
          break;
        case 'spread':
          marketArbitrages = detectSpreadArbitrage(freshMarket, event, marketKey);
          break;
        case 'total':
          marketArbitrages = detectTotalArbitrage(freshMarket, event, marketKey);
          break;
        default:
          console.warn(`⚠️  Unknown market type: ${market.marketType}`);
      }
      
      allArbitrages.push(...marketArbitrages);
    });
  });
  
  return allArbitrages;
}

module.exports = {
  detectArbitrages,
  isLineStale,
  americanToDecimal
};