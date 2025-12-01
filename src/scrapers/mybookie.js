// src/scrapers/mybookie.js
// Scrapes NFL moneyline odds from MyBookie (offshore)

const puppeteer = require('puppeteer');
const config = require('../../config');
const Helpers = require('../utils/helpers');

class MyBookieScraper {
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

      await page.goto('https://www.mybookie.ag/sportsbook/nfl/', {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });

      await Helpers.delay(10000, 12000);

      results = await page.evaluate(() => {
        const games = [];
        const pageText = document.body.innerText;
        const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const nflTeams = [
          '49ers', 'Bears', 'Bengals', 'Bills', 'Broncos', 'Browns', 'Buccaneers',
          'Cardinals', 'Chargers', 'Chiefs', 'Colts', 'Commanders', 'Cowboys',
          'Dolphins', 'Eagles', 'Falcons', 'Giants', 'Jaguars', 'Jets', 'Lions',
          'Packers', 'Panthers', 'Patriots', 'Raiders', 'Rams', 'Ravens', 'Saints',
          'Seahawks', 'Steelers', 'Texans', 'Titans', 'Vikings'
        ];
        
        const teamLines = lines.filter(line => nflTeams.includes(line));
        const oddsPattern = /[+\-−]\d{3,4}(?!\d)/g;
        const allOddsMatches = [...pageText.matchAll(oddsPattern)];
        const allOdds = allOddsMatches.map(m => parseInt(m[0].replace('−', '-')));
        
        for (let i = 0; i < teamLines.length - 1; i += 2) {
          const gameIndex = i / 2;
          // MyBookie lists teams in NORMAL order: away first, home second
          const awayTeam = teamLines[i];
          const homeTeam = teamLines[i + 1];
          
          // But moneyline odds are at unusual positions!
          // Pattern from analysis: away at +1, home at +4 in 6-odds blocks
          const awayOddsIndex = (gameIndex * 6) + 1;
          const homeOddsIndex = (gameIndex * 6) + 4;
          
          const awayOdds = allOdds[awayOddsIndex];
          const homeOdds = allOdds[homeOddsIndex];
          
          if (awayOdds !== undefined && homeOdds !== undefined) {
            games.push({ awayTeam, homeTeam, awayOdds, homeOdds, gameTime: '' });
          }
        }
        
        return games;
      });

    } catch (error) {
      Helpers.logError(error, 'MyBookieScraper');
      throw error;
    } finally {
      await browser.close();
    }

    return results.map(game => ({
      book: 'mybookie',
      ...game,
      scrapedAt: new Date().toISOString(),
      url: 'https://www.mybookie.ag/sportsbook/nfl/',
      timestamp: Date.now()
    }));
  }
}

module.exports = MyBookieScraper;