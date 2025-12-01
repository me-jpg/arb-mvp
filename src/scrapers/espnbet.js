// src/scrapers/espnbet.js
// ENHANCED: Multi-market support (ML + Spread + Total)

const puppeteer = require('puppeteer');
const path = require('path');
const config = require(path.join(process.cwd(), 'config'));
const Helpers = require('../utils/helpers');

class ESPNBetScraper {
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

      await page.goto('https://espnbet.com/sport/football/organization/united-states/competition/nfl#lines', {
        waitUntil: 'domcontentloaded',
        timeout: 20000  // 20 second timeout
      });

      await Helpers.delay(15000, 17000);

      results = await page.evaluate(() => {
        const games = [];
        const gameArticles = document.querySelectorAll('article');
        
        gameArticles.forEach(article => {
          try {
            // Get team names
            const teamButtons = article.querySelectorAll('[data-testid="team-name"]');
            if (teamButtons.length < 2) return;
            
            // Extract clean team names
            const team1El = teamButtons[0].querySelector('.text-primary');
            const team2El = teamButtons[1].querySelector('.text-primary');
            
            if (!team1El || !team2El) return;
            
            const awayTeam = team1El.textContent.trim();
            const homeTeam = team2El.textContent.trim();
            
            // Get all market selection buttons
            const oddsButtons = article.querySelectorAll('[data-testid^="MarketSelection"]');
            
            const markets = {};
            
            // Process each odds button
            oddsButtons.forEach(button => {
              const dataType = button.getAttribute('data-type');
              const oddsSpan = button.querySelector('.text-style-xs-bold');
              if (!oddsSpan) return;
              
              const odds = oddsSpan.textContent.trim();
              
              // MONEYLINE
              if (dataType === 'AWAY_MONEYLINE') {
                if (!markets.moneyline) markets.moneyline = {};
                markets.moneyline.awayOdds = parseInt(odds);
              } else if (dataType === 'HOME_MONEYLINE') {
                if (!markets.moneyline) markets.moneyline = {};
                markets.moneyline.homeOdds = parseInt(odds);
              }
              
              // SPREAD
              else if (dataType === 'AWAY_SPREAD') {
                const labelSpan = button.querySelector('.text-selector-label-deselected, .text-selector-label-selected');
                const label = labelSpan ? labelSpan.textContent.trim() : '';
                const lineMatch = label.match(/([+-]?\d+\.?\d*)/);
                
                if (lineMatch) {
                  if (!markets.spread) markets.spread = {};
                  markets.spread.awayLine = parseFloat(lineMatch[1]);
                  markets.spread.awayOdds = parseInt(odds);
                }
              } else if (dataType === 'HOME_SPREAD') {
                const labelSpan = button.querySelector('.text-selector-label-deselected, .text-selector-label-selected');
                const label = labelSpan ? labelSpan.textContent.trim() : '';
                const lineMatch = label.match(/([+-]?\d+\.?\d*)/);
                
                if (lineMatch) {
                  if (!markets.spread) markets.spread = {};
                  markets.spread.homeLine = parseFloat(lineMatch[1]);
                  markets.spread.homeOdds = parseInt(odds);
                }
              }
              
              // TOTAL
              else if (dataType === 'OVER') {
                const labelSpan = button.querySelector('.text-selector-label-deselected, .text-selector-label-selected');
                const label = labelSpan ? labelSpan.textContent.trim() : '';
                const lineMatch = label.match(/(\d+\.?\d*)/);
                
                if (lineMatch) {
                  if (!markets.total) markets.total = {};
                  markets.total.line = parseFloat(lineMatch[1]);
                  markets.total.overOdds = parseInt(odds);
                }
              } else if (dataType === 'UNDER') {
                if (markets.total) {
                  markets.total.underOdds = parseInt(odds);
                }
              }
            });
            
            if (Object.keys(markets).length > 0) {
              // Try to extract game time from article element
              let gameTime = null;
              try {
                // ESPN Bet may have time info in the article or nearby elements
                const timeEl = article.querySelector('[class*="time"], [class*="date"], time');
                if (timeEl) {
                  const timeText = timeEl.textContent.trim();
                  // Try common patterns
                  const timePattern = /(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i;
                  const match = timeText.match(timePattern);
                  
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
            // Skip this game
          }
        });
        
        return games;
      });

    } catch (error) {
      Helpers.logError(error, 'ESPNBetScraper');
      throw error;
    } finally {
      if (this.ownsBrowser && this.browser) {
        await this.browser.close();
      }
    }

    const timestamp = Date.now();
    return results.map(game => ({
      book: 'espnbet',
      ...game,
      scrapedAt: new Date().toISOString(),
      url: 'https://espnbet.com/sport/football/organization/united-states/competition/nfl#lines',
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

module.exports = ESPNBetScraper;