// src/highfreq/lightweightScraper.js
// FIXED: Proper eventId generation + line extraction + team name normalization

const config = require('../../config');
const { createEventId, parseGameTime, normalizeTeam } = require('../core/normalizer');

// Debug flag
const DEBUG = process.env.ARB_DEBUG === 'true' || process.env.ARB_DEBUG === '1';

/**
 * Lightweight scrape - only main markets from limited games
 */
async function lightweightScrape(scraper, bookName, maxGames = 8) {
  try {
    // Run full scrape (we'll filter after)
    const allResults = await scraper.scrape();
    
    if (allResults.length === 0) {
      console.log(`   ⚠️  ${bookName} returned 0 games`);
      return [];
    }
    
    // Take only first N games
    const limitedResults = allResults.slice(0, maxGames);
    
    // Extract odds records
    const oddsRecords = [];
    
    for (const game of limitedResults) {
      // ✅ FIXED: Parse gameTime to get just the date (prevents timestamp in eventId)
      const gameTimeData = parseGameTime(game.gameTime);
      const gameDate = gameTimeData.date; // Just YYYY-MM-DD, no timestamp
      
      // ✅ CRITICAL FIX: Normalize team names BEFORE creating eventId
      // This ensures "LA Rams" (DK) and "Los Angeles Rams" (BetMGM) get the same eventId
      const normalizedAway = normalizeTeam(game.awayTeam);
      const normalizedHome = normalizeTeam(game.homeTeam);
      
      if (DEBUG) {
        console.log(`[DEBUG] ${bookName}: "${game.awayTeam}" → "${normalizedAway}" | "${game.homeTeam}" → "${normalizedHome}"`);
      }
      
      // Generate stable eventId (same game = same ID across cycles AND across books)
      const eventId = createEventId(normalizedAway, normalizedHome, gameDate);
      
      if (!eventId) {
        console.warn(`   ⚠️  Failed to generate eventId for ${game.awayTeam} @ ${game.homeTeam}`);
        continue;
      }
      
      const markets = game.markets || {};
      
      // Process each market
      Object.entries(markets).forEach(([marketKey, marketData]) => {
        const marketType = marketKey;
        
        // Only track configured markets
        if (!config.highFrequency.markets.includes(marketType)) {
          return;
        }
        
        // MONEYLINE - no line value
        if (marketType === 'moneyline') {
          if (marketData.awayOdds) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'moneyline',
              side: 'away',
              line: null,
              price: marketData.awayOdds,
              timestamp: game.timestamp || Date.now()
            });
          }
          if (marketData.homeOdds) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'moneyline',
              side: 'home',
              line: null,
              price: marketData.homeOdds,
              timestamp: game.timestamp || Date.now()
            });
          }
        }
        
        // SPREAD - line is in awayLine/homeLine
        else if (marketType === 'spread') {
          if (marketData.awayOdds && marketData.awayLine !== undefined) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'spread',
              side: 'away',
              line: marketData.awayLine,  // ✅ FIXED: Use awayLine
              price: marketData.awayOdds,
              timestamp: game.timestamp || Date.now()
            });
          }
          if (marketData.homeOdds && marketData.homeLine !== undefined) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'spread',
              side: 'home',
              line: marketData.homeLine,  // ✅ FIXED: Use homeLine
              price: marketData.homeOdds,
              timestamp: game.timestamp || Date.now()
            });
          }
        }
        
        // TOTAL - line is in line property
        else if (marketType === 'total') {
          const totalLine = marketData.line;
          if (totalLine !== undefined) {
            if (marketData.overOdds) {
              oddsRecords.push({
                eventId,
                book: bookName,
                marketType: 'total',
                side: 'over',
                line: totalLine,
                price: marketData.overOdds,
                timestamp: game.timestamp || Date.now()
              });
            }
            if (marketData.underOdds) {
              oddsRecords.push({
                eventId,
                book: bookName,
                marketType: 'total',
                side: 'under',
                line: totalLine,
                price: marketData.underOdds,
                timestamp: game.timestamp || Date.now()
              });
            }
          }
        }
      });
    }
    
    return oddsRecords;
  } catch (error) {
    console.error(`❌ HF scrape error (${bookName}):`, error.message);
    return [];
  }
}

module.exports = {
  lightweightScrape
};