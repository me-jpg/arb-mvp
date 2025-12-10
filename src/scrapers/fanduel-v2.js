// src/scrapers/fanduel-v2.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class FanDuelV2Scraper {
  constructor() {
    this.name = 'fanduel';
    this.url = 'https://sportsbook.fanduel.com/navigation/nba';
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });
    }
  }

  async scrape() {
    await this.initBrowser();
    const page = await this.browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(this.url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for content
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Extract games using button-based approach
      const games = await page.evaluate(() => {
        const results = [];

        // Find all odds buttons
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const oddsButtons = buttons.filter(btn => {
          const text = btn.textContent.trim();
          return /^[+-]\d{3,4}$/.test(text);
        });

        if (oddsButtons.length === 0) return [];

        // Find NFL team names in the page
        const nflTeams = ['Cowboys', 'Lions', 'Dolphins', 'Jets', 'Chiefs', 'Bills',
          'Eagles', 'Ravens', 'Patriots', 'Steelers', '49ers', 'Packers',
          'Rams', 'Saints', 'Buccaneers', 'Seahawks', 'Cardinals', 'Falcons',
          'Panthers', 'Bears', 'Vikings', 'Titans', 'Colts', 'Texans',
          'Jaguars', 'Browns', 'Bengals', 'Broncos', 'Raiders', 'Chargers',
          'Giants', 'Washington', 'Commanders'];

        // Group buttons by their common ancestor that contains team names
        const gameContainers = new Map();

        oddsButtons.forEach(btn => {
          let container = btn;
          let foundTeams = [];

          // Go up the DOM tree to find a container with team names
          for (let i = 0; i < 15; i++) {
            if (!container.parentElement) break;
            container = container.parentElement;

            const text = container.textContent;
            foundTeams = nflTeams.filter(team => text.includes(team));

            // Found a container with exactly 2 teams
            if (foundTeams.length === 2) {
              const key = foundTeams.sort().join('|');

              if (!gameContainers.has(key)) {
                gameContainers.set(key, {
                  container: container,
                  teams: foundTeams,
                  buttons: []
                });
              }

              // Store button info
              const ariaLabel = btn.getAttribute('aria-label') || '';
              const priceSpan = btn.querySelector('span');
              const price = priceSpan ? priceSpan.textContent.trim() : btn.textContent.trim();

              gameContainers.get(key).buttons.push({
                ariaLabel: ariaLabel,
                price: price
              });

              break;
            }
          }
        });

        // Convert to game objects
        gameContainers.forEach((data, key) => {
          try {
            const [awayTeam, homeTeam] = data.teams;
            const odds = [];

            data.buttons.forEach(btn => {
              const label = btn.ariaLabel.toLowerCase();
              const price = btn.price;

              if (!price || !/^[+-]\d{3,4}$/.test(price)) return;

              // Parse spread
              if (label.includes('spread')) {
                const lineMatch = label.match(/([+-]?\d+\.?\d*)\s+spread/);
                const side = label.includes(awayTeam.toLowerCase()) ? 'away' : 'home';

                if (lineMatch) {
                  odds.push({
                    marketType: 'spread',
                    side: side,
                    line: parseFloat(lineMatch[1]),
                    price: price
                  });
                }
              }
              // Parse moneyline
              else if (label.includes('moneyline')) {
                const side = label.includes(awayTeam.toLowerCase()) ? 'away' : 'home';
                odds.push({
                  marketType: 'moneyline',
                  side: side,
                  line: null,
                  price: price
                });
              }
              // Parse total
              else if (label.includes('total') || label.includes('over') || label.includes('under')) {
                const lineMatch = label.match(/(\d+\.?\d*)/);
                const side = label.includes('over') ? 'over' : 'under';

                if (lineMatch) {
                  odds.push({
                    marketType: 'total',
                    side: side,
                    line: parseFloat(lineMatch[1]),
                    price: price
                  });
                }
              }
            });

            if (odds.length >= 4) { // Need at least 4 odds to be valid
              results.push({
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                gameTime: 'Unknown',
                odds: odds
              });
            }
          } catch (err) {
            // Skip invalid games
          }
        });

        return results;
      });

      await page.close();
      return games;

    } catch (error) {
      await page.close().catch(() => { });
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = FanDuelV2Scraper;