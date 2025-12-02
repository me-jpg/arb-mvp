// src/scrapers/fanduel.js
// CORRECTED: Actual FanDuel scraper (previous file had DraftKings code)

const puppeteer = require('puppeteer');
const config = require('../../config');
const Helpers = require('../utils/helpers');

class FanDuelScraper {
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

      await page.goto('https://sportsbook.fanduel.com/football/nfl', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      await Helpers.delay(15000, 18000);

      results = await page.evaluate(() => {
        const games = [];
        
        // FanDuel uses a table structure with rows for each game
        const gameRows = document.querySelectorAll('[role="row"]');
        
        gameRows.forEach(row => {
          try {
            // Get team names from aria-labels or text content
            const teamLinks = row.querySelectorAll('a[aria-label*="@"]');
            if (teamLinks.length === 0) return;
            
            // Extract teams from aria-label like "Buffalo Bills @ Los Angeles Rams"
            const matchupText = teamLinks[0].getAttribute('aria-label');
            if (!matchupText || !matchupText.includes('@')) return;
            
            const teams = matchupText.split('@').map(t => t.trim());
            if (teams.length !== 2) return;
            
            const awayTeam = teams[0];
            const homeTeam = teams[1];
            
            // Get all odds buttons in this row
            const oddsButtons = row.querySelectorAll('[role="button"]');
            if (oddsButtons.length < 6) return; // Need at least 6 for full markets
            
            const markets = {};
            
            // FanDuel structure: [spread_away, spread_home, total_over, total_under, ml_away, ml_home]
            // or sometimes: [ml_away, ml_home, spread_away, spread_home, total_over, total_under]
            
            // Parse odds from buttons
            const oddsData = [];
            oddsButtons.forEach(button => {
              const ariaLabel = button.getAttribute('aria-label') || '';
              const textContent = button.textContent.trim();
              
              // Extract odds (look for +/- numbers)
              const oddsMatch = textContent.match(/[+\-]\d{3,4}/);
              if (!oddsMatch) return;
              
              const odds = parseInt(oddsMatch[0]);
              
              // Extract line value if present
              const lineMatch = textContent.match(/([+\-]?\d+\.?\d*)/);
              const line = lineMatch ? parseFloat(lineMatch[1]) : null;
              
              oddsData.push({
                ariaLabel,
                textContent,
                odds,
                line
              });
            });
            
            // Now map to markets based on patterns
            // This is heuristic - FanDuel's structure can vary
            
            if (oddsData.length >= 6) {
              // Common pattern: spread, total, moneyline (6 odds total)
              
              // MONEYLINE - usually last 2 or first 2
              // Check for no line values as indicator
              const mlCandidates = oddsData.filter(d => d.line === null || Math.abs(d.line) > 30);
              
              if (mlCandidates.length >= 2) {
                markets.moneyline = {
                  awayOdds: mlCandidates[0].odds,
                  homeOdds: mlCandidates[1].odds
                };
              }
              
              // SPREAD - look for small line values (-14 to +14 typically)
              const spreadCandidates = oddsData.filter(d => 
                d.line !== null && Math.abs(d.line) <= 20
              );
              
              if (spreadCandidates.length >= 2) {
                markets.spread = {
                  awayLine: spreadCandidates[0].line,
                  awayOdds: spreadCandidates[0].odds,
                  homeLine: spreadCandidates[1].line,
                  homeOdds: spreadCandidates[1].odds
                };
              }
              
              // TOTAL - look for larger line values (typically 35-60 for NFL)
              const totalCandidates = oddsData.filter(d => 
                d.line !== null && d.line >= 30 && d.line <= 70
              );
              
              if (totalCandidates.length >= 2) {
                // Both over and under should have same line
                const totalLine = totalCandidates[0].line;
                markets.total = {
                  line: totalLine,
                  overOdds: totalCandidates[0].odds,
                  underOdds: totalCandidates[1].odds
                };
              }
            }
            
            // Try to extract game time
            let gameTime = null;
            try {
              const timeEl = row.querySelector('[class*="time"], [class*="date"], time');
              if (timeEl) {
                const timeText = timeEl.textContent.trim();
                // FanDuel shows times like "SAT 1:00 PM"
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
              // Fallback to now
            }
            
            if (Object.keys(markets).length > 0) {
              games.push({
                awayTeam,
                homeTeam,
                gameTime: gameTime || new Date().toISOString(),
                markets
              });
            }
          } catch (e) {
            // Skip this game if parsing fails
            console.error('Error parsing FanDuel game:', e.message);
          }
        });
        
        return games;
      });

    } catch (error) {
      Helpers.logError(error, 'FanDuelScraper');
      throw error;
    } finally {
      if (this.ownsBrowser && this.browser) {
        await this.browser.close();
      }
    }

    const timestamp = Date.now();
    return results.map(game => ({
      book: 'fanduel',
      ...game,
      scrapedAt: new Date().toISOString(),
      url: 'https://sportsbook.fanduel.com/football/nfl',
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

module.exports = FanDuelScraper;