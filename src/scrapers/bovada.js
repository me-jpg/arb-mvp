// src/scrapers/bovada.js
// Scrapes NFL moneyline odds from Bovada (offshore)

const puppeteer = require('puppeteer');
const config = require('../../config');
const Helpers = require('../utils/helpers');

class BovadaScraper {
  async scrape() {
    const browser = await puppeteer.launch({
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    let results = [];

    try {
      const page = await browser.newPage();
      
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      );

      await page.goto('https://www.bovada.lv/sports/football/nfl', {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });

      await Helpers.delay(10000, 12000);

      results = await page.evaluate(() => {
        const games = [];
        
        // Try to find game containers with structured data
        const gameElements = document.querySelectorAll('.coupon-content');
        
        if (gameElements.length > 0) {
          // Use DOM structure
          gameElements.forEach(gameEl => {
            try {
              const teams = gameEl.querySelectorAll('.name');
              if (teams.length !== 2) return;
              
              const awayTeam = teams[0].textContent.trim().split(' ').pop();
              const homeTeam = teams[1].textContent.trim().split(' ').pop();
              
              // Look for moneyline odds in each team's row
              const rows = gameEl.querySelectorAll('.game-line');
              if (rows.length < 2) return;
              
              // Parse odds from text
              const parseOdds = (text) => {
                const match = text.match(/[+\-]\d{3,4}/);
                return match ? parseInt(match[0].replace('−', '-')) : null;
              };
              
              // Get all odds from away team row
              const awayText = rows[0].textContent;
              const awayOddsMatches = [...awayText.matchAll(/[+\-]\d{3,4}/g)];
              
              // Get all odds from home team row  
              const homeText = rows[1].textContent;
              const homeOddsMatches = [...homeText.matchAll(/[+\-]\d{3,4}/g)];
              
              // Moneyline is typically the middle odd (index 1 out of 0,1,2)
              const awayOdds = awayOddsMatches[1] ? parseInt(awayOddsMatches[1][0].replace('−', '-')) : null;
              const homeOdds = homeOddsMatches[1] ? parseInt(homeOddsMatches[1][0].replace('−', '-')) : null;
              
              if (awayTeam && homeTeam && awayOdds !== null && homeOdds !== null) {
                games.push({
                  awayTeam,
                  homeTeam,
                  awayOdds,
                  homeOdds,
                  gameTime: ''
                });
              }
            } catch (e) {
              // Skip this game if parsing fails
            }
          });
        }
        
        // Fallback to text parsing if DOM parsing fails
        if (games.length === 0) {
          const pageText = document.body.innerText;
          const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          const nflTeamPatterns = [
            'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
            'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
            'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
            'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
            'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
            'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
            'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
            'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
          ];
          
          const teamPositions = [];
          lines.forEach((line, idx) => {
            for (const teamName of nflTeamPatterns) {
              if (line === teamName) {
                teamPositions.push({ 
                  team: teamName.split(' ').pop(),
                  lineIndex: idx 
                });
                break;
              }
            }
          });
          
          const parseOdds = (text) => {
            if (!text) return null;
            const cleaned = text.replace('−', '-').replace(/[()]/g, '');
            const match = cleaned.match(/[+\-]\d{3,4}/);
            return match ? parseInt(match[0]) : null;
          };
          
          for (let i = 0; i < teamPositions.length - 1; i += 2) {
            const awayPos = teamPositions[i];
            const homePos = teamPositions[i + 1];
            
            // Find odds in the lines near each team
            // Team1 line, odds line, Team2 line, odds line pattern
            let awayOdds = null;
            let homeOdds = null;
            
            // Check 5 lines after away team for its odds
            for (let j = awayPos.lineIndex + 1; j < awayPos.lineIndex + 6; j++) {
              const odds = parseOdds(lines[j]);
              if (odds && Math.abs(odds) > 120) {
                awayOdds = odds;
                break;
              }
            }
            
            // Check 5 lines after home team for its odds
            for (let j = homePos.lineIndex + 1; j < homePos.lineIndex + 6; j++) {
              const odds = parseOdds(lines[j]);
              if (odds && Math.abs(odds) > 120) {
                homeOdds = odds;
                break;
              }
            }
            
            if (awayOdds && homeOdds) {
              games.push({
                awayTeam: awayPos.team,
                homeTeam: homePos.team,
                awayOdds,
                homeOdds,
                gameTime: ''
              });
            }
          }
        }
        
        return games;
      });

    } catch (error) {
      Helpers.logError(error, 'BovadaScraper');
      throw error;
    } finally {
      await browser.close();
    }

    return results.map(game => ({
      book: 'bovada',
      ...game,
      scrapedAt: new Date().toISOString(),
      url: 'https://www.bovada.lv/sports/football/nfl',
      timestamp: Date.now()
    }));
  }
}

module.exports = BovadaScraper;