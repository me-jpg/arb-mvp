// src/scrapers/betmgm.js
// ENHANCED: Multi-market support (ML + Spread + Total)

const puppeteer = require('puppeteer');
const path = require('path');
const config = require(path.join(process.cwd(), 'config'));
const Helpers = require('../utils/helpers');

class BetMGMScraper {
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

      // FIXED URL - properly escaped
      const url = 'https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35';
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000  // 20 second timeout
      });

      await Helpers.delay(8000, 10000);

      results = await page.evaluate(() => {
        const games = [];
        const gameElements = document.querySelectorAll('.grid-event');
        
        gameElements.forEach(gameEl => {
          try {
            // Get team names
            const participants = gameEl.querySelectorAll('.participant');
            if (participants.length < 2) return;
            
            const awayTeam = participants[0].textContent.trim();
            const homeTeam = participants[1].textContent.trim();
            
            // Get all option groups (should be 3: spread, total, moneyline)
            const optionGroups = gameEl.querySelectorAll('.grid-option-group');
            if (optionGroups.length < 3) return;
            
            const markets = {};
            
            // GROUP 0 = SPREAD
            const spreadGroup = optionGroups[0];
            const spreadOptions = spreadGroup.querySelectorAll('.grid-option');
            if (spreadOptions.length === 2) {
              const spread1Line = spreadOptions[0].querySelector('.option-attribute')?.textContent.trim();
              const spread1Odds = spreadOptions[0].querySelector('.custom-odds-value-style')?.textContent.trim();
              const spread2Line = spreadOptions[1].querySelector('.option-attribute')?.textContent.trim();
              const spread2Odds = spreadOptions[1].querySelector('.custom-odds-value-style')?.textContent.trim();
              
              if (spread1Line && spread1Odds && spread2Line && spread2Odds) {
                markets.spread = {
                  awayLine: parseFloat(spread1Line),
                  awayOdds: parseInt(spread1Odds),
                  homeLine: parseFloat(spread2Line),
                  homeOdds: parseInt(spread2Odds)
                };
              }
            }
            
            // GROUP 1 = TOTAL
            const totalGroup = optionGroups[1];
            const totalLineDiv = totalGroup.querySelector('.grid-option.option-group-attribute');
            const totalLine = totalLineDiv?.querySelector('.custom-odds-value-style')?.textContent.trim();
            const totalOptions = totalGroup.querySelectorAll('ms-option.grid-option');
            if (totalOptions.length === 2 && totalLine) {
              const overOdds = totalOptions[0].querySelector('.custom-odds-value-style')?.textContent.trim();
              const underOdds = totalOptions[1].querySelector('.custom-odds-value-style')?.textContent.trim();
              
              if (overOdds && underOdds) {
                markets.total = {
                  line: parseFloat(totalLine),
                  overOdds: parseInt(overOdds),
                  underOdds: parseInt(underOdds)
                };
              }
            }
            
            // GROUP 2 = MONEYLINE
            const mlGroup = optionGroups[2];
            const mlOptions = mlGroup.querySelectorAll('.grid-option');
            if (mlOptions.length === 2) {
              const ml1Odds = mlOptions[0].querySelector('.custom-odds-value-style')?.textContent.trim();
              const ml2Odds = mlOptions[1].querySelector('.custom-odds-value-style')?.textContent.trim();
              
              if (ml1Odds && ml2Odds) {
                markets.moneyline = {
                  awayOdds: parseInt(ml1Odds),
                  homeOdds: parseInt(ml2Odds)
                };
              }
            }
            
            if (Object.keys(markets).length > 0) {
              // Try to extract game time from DOM
              let gameTime = null;
              try {
                // BetMGM shows game times - look for time elements
                const timeEl = gameEl.querySelector('.starting-time, .event-time, [class*="time"]');
                if (timeEl) {
                  const timeText = timeEl.textContent.trim();
                  // Parse common formats like "SAT 1:00 PM" or "12/01 1:00 PM"
                  const timePattern = /(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i;
                  const datePattern = /(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i;
                  
                  let match = timeText.match(timePattern);
                  if (match) {
                    const dayMap = {'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6};
                    const targetDay = dayMap[match[1].toUpperCase()];
                    const now = new Date();
                    let daysAhead = targetDay - now.getDay();
                    if (daysAhead < 0) daysAhead += 7;
                    
                    const timeParts = match[2].match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                    if (timeParts) {
                      let hours = parseInt(timeParts[1]);
                      const minutes = parseInt(timeParts[2]);
                      const isPM = timeParts[3].toUpperCase() === 'PM';
                      
                      if (isPM && hours !== 12) hours += 12;
                      if (!isPM && hours === 12) hours = 0;
                      
                      const gameDate = new Date(now);
                      gameDate.setDate(gameDate.getDate() + daysAhead);
                      gameDate.setHours(hours, minutes, 0, 0);
                      gameTime = gameDate.toISOString();
                    }
                  } else {
                    match = timeText.match(datePattern);
                    if (match) {
                      const month = parseInt(match[1]) - 1;
                      const day = parseInt(match[2]);
                      const timeParts = match[3].match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                      
                      if (timeParts) {
                        let hours = parseInt(timeParts[1]);
                        const minutes = parseInt(timeParts[2]);
                        const isPM = timeParts[3].toUpperCase() === 'PM';
                        
                        if (isPM && hours !== 12) hours += 12;
                        if (!isPM && hours === 12) hours = 0;
                        
                        const now = new Date();
                        const gameDate = new Date(now.getFullYear(), month, day, hours, minutes, 0, 0);
                        gameTime = gameDate.toISOString();
                      }
                    }
                  }
                }
              } catch (error) {
                // Fallback
              }
              
              games.push({
                awayTeam,
                homeTeam,
                gameTime: gameTime || new Date().toISOString(),
                markets
              });
            }
          } catch (e) {
            // Skip this game if parsing fails
            console.error('Error parsing game:', e.message);
          }
        });
        
        return games;
      });

    } catch (error) {
      Helpers.logError(error, 'BetMGMScraper');
      throw error;
    } finally {
      if (this.ownsBrowser && this.browser) {
        await this.browser.close();
      }
    }

    const timestamp = Date.now();
    return results.map(game => ({
      book: 'betmgm',
      ...game,
      scrapedAt: new Date().toISOString(),
      url: 'https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35',
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

module.exports = BetMGMScraper;