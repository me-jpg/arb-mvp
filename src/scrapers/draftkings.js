// src/scrapers/draftkings.js
// NBA scraper for DraftKings Sportsbook

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('../../config');
const Helpers = require('../utils/helpers');

puppeteer.use(StealthPlugin());

class DraftKingsScraper {
  constructor(browser = null) {
    this.browser = browser;
    this.ownsBrowser = false;
  }

  async scrape() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: config.headless !== false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage'
        ]
      });
      this.ownsBrowser = true;
    }

    let results = [];

    try {
      const page = await this.browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto('https://sportsbook.draftkings.com/leagues/basketball/nba', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      await Helpers.delay(15000, 18000);

      results = await page.evaluate(() => {
        const games = [];
        const pageText = document.body.innerText;
        const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === 'AT') {
            let awayTeam = lines[i - 1];
            let homeTeam = lines[i + 1];

            // Check if previous line is a score (pure integer, no decimals or +/-)
            if (/^\d+$/.test(awayTeam)) {
              awayTeam = lines[i - 2];
            }

            // Check if next line is a score
            if (/^\d+$/.test(homeTeam)) {
              homeTeam = lines[i + 2];
            }

            if (!awayTeam || !homeTeam || awayTeam.length < 3 || homeTeam.length < 3) {
              continue;
            }

            // Find odds start - skip score if present
            let oddsStart = i + 2;
            if (/^\d+$/.test(lines[i + 2])) {
              oddsStart = i + 3;
            }

            const isOdds = (str) => /^[+\-−]\d{3,4}$/.test(str);
            const isNumber = (str) => /^[+\-]?\d+\.?\d*$/.test(str);

            const values = [];
            for (let j = oddsStart; j < oddsStart + 30 && values.length < 10; j++) {
              const line = lines[j];
              if (line === 'O' || line === 'U') continue;
              if (line === 'More' || line === 'Bets') break;
              if (line === 'AT') break;

              if (isOdds(line)) {
                values.push(parseInt(line.replace('−', '-')));
              } else if (isNumber(line)) {
                values.push(parseFloat(line));
              }
            }

            // Expected: awaySpread, awaySpreadOdds, total, overOdds, awayML, homeSpread, homeSpreadOdds, total, underOdds, homeML
            if (values.length >= 10) {
              games.push({
                awayTeam,
                homeTeam,
                gameTime: new Date().toISOString(),
                markets: {
                  moneyline: {
                    awayOdds: values[4],
                    homeOdds: values[9]
                  },
                  spread: {
                    awayLine: values[0],
                    awayOdds: values[1],
                    homeLine: values[5],
                    homeOdds: values[6]
                  },
                  total: {
                    line: values[2],
                    overOdds: values[3],
                    underOdds: values[8]
                  }
                }
              });
            }
          }
        }

        return games;
      });

      await page.close();

    } catch (error) {
      console.error('DraftKings scraper error:', error.message);
      Helpers.logError(error, 'DraftKingsScraper');
      throw error;
    } finally {
      if (this.ownsBrowser && this.browser) {
        await this.browser.close();
      }
    }

    const timestamp = Date.now();
    return results.map(game => ({
      book: 'draftkings',
      ...game,
      scrapedAt: new Date().toISOString(),
      url: 'https://sportsbook.draftkings.com/leagues/basketball/nba',
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