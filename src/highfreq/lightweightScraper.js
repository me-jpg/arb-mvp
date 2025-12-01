// src/highfreq/lightweightScraper.js
// Lightweight scraper for high-frequency tracking
// Reuses browser instances, minimal markets

const config = require('../../config');
const { createEventId } = require('../core/normalizer');

/**
 * Lightweight scrape - only main markets from limited games
 */
async function lightweightScrape(scraper, bookName, maxGames = 8) {
  try {
    console.log(`   DEBUG: Starting scrape for ${bookName}...`);
    
    // Run full scrape (we'll filter after)
    const allResults = await scraper.scrape();
    
    console.log(`   DEBUG: ${bookName} returned ${allResults.length} games`);
    
    if (allResults.length > 0) {
      console.log(`   DEBUG: First game sample:`, JSON.stringify(allResults[0], null, 2).substring(0, 500));
    }
    
    // Take only first N games
    const limitedResults = allResults.slice(0, maxGames);
    
    console.log(`   DEBUG: Processing ${limitedResults.length} games...`);
    
    // Extract odds records (similar to odds_snapshots format)
    const oddsRecords = [];
    
    for (const game of limitedResults) {
      // Generate eventId using normalizer function
      const eventId = game.eventId || createEventId(game.awayTeam, game.homeTeam, game.gameTime);
      
      if (!eventId) {
        console.log(`   DEBUG: Failed to generate eventId for game:`, game);
        continue;
      }
      
      const markets = game.markets || {};
      
      console.log(`   DEBUG: Game ${eventId} has ${Object.keys(markets).length} markets`);
      
      // Process each market
      Object.entries(markets).forEach(([marketKey, marketData]) => {
        // Market type is the key itself (moneyline, spread, total)
        const marketType = marketKey;
        
        // Only track configured markets
        if (!config.highFrequency.markets.includes(marketType)) {
          return;
        }
        
        // Extract line value if present in marketData
        let line = marketData.line || null;
        
        // Moneyline
        if (marketType === 'moneyline') {
          if (marketData.awayOdds) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'moneyline',
              side: 'away',
              line: null,
              price: marketData.awayOdds
            });
          }
          if (marketData.homeOdds) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'moneyline',
              side: 'home',
              line: null,
              price: marketData.homeOdds
            });
          }
        }
        
        // Spread
        if (marketType === 'spread') {
          if (marketData.awayOdds) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'spread',
              side: 'away',
              line,
              price: marketData.awayOdds
            });
          }
          if (marketData.homeOdds) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'spread',
              side: 'home',
              line,
              price: marketData.homeOdds
            });
          }
        }
        
        // Total
        if (marketType === 'total') {
          if (marketData.overOdds) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'total',
              side: 'over',
              line,
              price: marketData.overOdds
            });
          }
          if (marketData.underOdds) {
            oddsRecords.push({
              eventId,
              book: bookName,
              marketType: 'total',
              side: 'under',
              line,
              price: marketData.underOdds
            });
          }
        }
      });
    }
    
    console.log(`   DEBUG: ${bookName} extracted ${oddsRecords.length} odds records from ${limitedResults.length} games`);
    
    if (oddsRecords.length > 0) {
      console.log(`   DEBUG: Sample odds record:`, oddsRecords[0]);
    }
    
    return oddsRecords;
  } catch (error) {
    console.error(`HF scrape error (${bookName}):`, error.message);
    console.error(`   Stack: ${error.stack}`);
    return [];
  }
}

module.exports = {
  lightweightScrape
};