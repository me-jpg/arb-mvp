// src/scrapers/draftkings.js
// Enhanced scraper: NFL Moneyline + Spread + Total

const puppeteer = require('puppeteer');
const config = require('../../config');
const Helpers = require('../utils/helpers');

class DraftKingsScraper {
  constructor(browser = null) {
    this.browser = browser;
    this.ownsBrowser = false;
  }

  async scrape() {
    // Create browser if not provided
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      this.ownsBrowser = true;
    }

    let results = [];

    try {
      const page = await this.browser.newPage();
      
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      );

      await page.goto('https://sportsbook.draftkings.com/leagues/football/nfl', {
        waitUntil: 'domcontentloaded',
        timeout: 20000  // 20 second timeout
      });

      await Helpers.delay(15000, 18000);

      results = await page.evaluate(() => {
        const games = [];
        const pageText = document.body.innerText;
        const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Find all "AT" markers (one per game)
        const atIndices = [];
        lines.forEach((line, idx) => {
          if (line === 'AT') {
            atIndices.push(idx);
          }
        });
        
        // Extract ALL odds from page
        const oddsPattern = /[+\-−]\d{3,4}/g;
        const allOddsMatches = [...pageText.matchAll(oddsPattern)];
        const allOdds = allOddsMatches.map(m => {
          const cleaned = m[0].replace('−', '-');
          return parseInt(cleaned);
        });
        
        // Extract spread values (look for numbers like "-3.5", "PK", "+7.5")
        const spreadPattern = /([+\-−]?\d+\.?\d*)\s*(?=\s*[+\-−]\d{3})/g;
        const spreadMatches = [...pageText.matchAll(spreadPattern)];
        
        // Try to extract game times from DOM elements
        // DraftKings shows times like "SAT 1:00 PM" or "SUN 4:25 PM"
        const timePattern = /(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/gi;
        const timeMatches = [...pageText.matchAll(timePattern)];
        
        // Helper to convert DK time format to ISO
        function parseGameTime(dayStr, timeStr) {
          try {
            const now = new Date();
            const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
            
            const dayMap = {
              'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3,
              'THU': 4, 'FRI': 5, 'SAT': 6
            };
            
            const targetDay = dayMap[dayStr.toUpperCase()];
            if (targetDay === undefined) return null;
            
            // Calculate days until target day
            let daysAhead = targetDay - currentDay;
            if (daysAhead < 0) daysAhead += 7; // Next week
            if (daysAhead === 0 && now.getHours() > 12) daysAhead = 7; // Past today, assume next week
            
            // Parse time (e.g., "1:00 PM")
            const timeParts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (!timeParts) return null;
            
            let hours = parseInt(timeParts[1]);
            const minutes = parseInt(timeParts[2]);
            const isPM = timeParts[3].toUpperCase() === 'PM';
            
            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;
            
            // Create date
            const gameDate = new Date(now);
            gameDate.setDate(gameDate.getDate() + daysAhead);
            gameDate.setHours(hours, minutes, 0, 0);
            
            return gameDate.toISOString();
          } catch (error) {
            return null;
          }
        }
        
        // DraftKings pattern per game:
        // Index 0: away spread odds
        // Index 1: home spread odds  
        // Index 2: away moneyline odds
        // Index 3: over odds
        // Index 4: under odds
        // Index 5: home moneyline odds
        
        atIndices.forEach((atIdx, gameIndex) => {
          const awayTeam = lines[atIdx - 1];
          const homeTeam = lines[atIdx + 1];
          
          // Try to find game time for this game
          let gameTime = null;
          if (timeMatches[gameIndex]) {
            gameTime = parseGameTime(timeMatches[gameIndex][1], timeMatches[gameIndex][2]);
          }
          
          // Base index for this game's odds (6 odds per game)
          const baseIdx = gameIndex * 6;
          
          // Extract all market data
          const awaySpreadOdds = allOdds[baseIdx + 0];
          const homeSpreadOdds = allOdds[baseIdx + 1];
          const awayMLOdds = allOdds[baseIdx + 2];
          const overOdds = allOdds[baseIdx + 3];
          const underOdds = allOdds[baseIdx + 4];
          const homeMLOdds = allOdds[baseIdx + 5];
          
          // Try to extract spread values
          // DK shows spread like: "LAR -3.5 -110" and "CAR +3.5 -110"
          // We need to parse these from the text
          let awaySpread = null;
          let homeSpread = null;
          let totalLine = null;
          
          // Look for spread numbers near the team names
          // This is a simplified extraction - may need refinement
          const gameSection = lines.slice(atIdx - 5, atIdx + 10).join(' ');
          const spreadNums = gameSection.match(/[+\-−]?\d+\.5/g);
          
          if (spreadNums && spreadNums.length >= 2) {
            awaySpread = parseFloat(spreadNums[0].replace('−', '-'));
            homeSpread = parseFloat(spreadNums[1].replace('−', '-'));
          }
          
          // Total line extraction
          // Look for "O 46.5" or "U 46.5" pattern
          const totalMatch = gameSection.match(/[OU]\s+(\d+\.5)/);
          if (totalMatch) {
            totalLine = parseFloat(totalMatch[1]);
          }
          
          // Build market object
          const markets = {};
          
          // Moneyline
          if (awayMLOdds !== undefined && homeMLOdds !== undefined) {
            markets.moneyline = {
              awayOdds: awayMLOdds,
              homeOdds: homeMLOdds
            };
          }
          
          // Spread
          if (awaySpread !== null && homeSpread !== null && 
              awaySpreadOdds !== undefined && homeSpreadOdds !== undefined) {
            markets.spread = {
              awayLine: awaySpread,
              awayOdds: awaySpreadOdds,
              homeLine: homeSpread,
              homeOdds: homeSpreadOdds
            };
          }
          
          // Total
          if (totalLine !== null && overOdds !== undefined && underOdds !== undefined) {
            markets.total = {
              line: totalLine,
              overOdds: overOdds,
              underOdds: underOdds
            };
          }
          
          if (awayTeam && homeTeam && Object.keys(markets).length > 0) {
            games.push({
              awayTeam,
              homeTeam,
              gameTime: gameTime || new Date().toISOString(), // Fallback to now if not found
              markets
            });
          }
        });
        
        return games;
      });

    } catch (error) {
      Helpers.logError(error, 'DraftKingsScraper');
      throw error;
    } finally {
      // Only close browser if we created it
      if (this.ownsBrowser && this.browser) {
        await this.browser.close();
      }
    }

    const timestamp = Date.now();
    return results.map(game => ({
      book: 'draftkings',
      ...game,
      scrapedAt: new Date().toISOString(),
      url: 'https://sportsbook.draftkings.com/leagues/football/nfl',
      timestamp
    }));
  }

  async close() {
    if (this.browser && this.ownsBrowser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = DraftKingsScraper;