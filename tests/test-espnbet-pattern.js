// tests/test-espnbet-pattern.js
// Debug ESPN Bet odds pattern

require('dotenv').config();
const puppeteer = require('puppeteer');

async function debug() {
  console.log('🔍 ESPN BET ODDS PATTERN DEBUG\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('Loading ESPN Bet...');
    await page.goto('https://espnbet.com/sport/football/organization/united-states/competition/nfl', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });

    console.log('Waiting for content...\n');
    await new Promise(resolve => setTimeout(resolve, 18000));

    const analysis = await page.evaluate(() => {
      const pageText = document.body.innerText;
      
      // Get teams
      const nflTeams = [
        '49ers', 'Bears', 'Bengals', 'Bills', 'Broncos', 'Browns', 'Buccaneers',
        'Cardinals', 'Chargers', 'Chiefs', 'Colts', 'Commanders', 'Cowboys',
        'Dolphins', 'Eagles', 'Falcons', 'Giants', 'Jaguars', 'Jets', 'Lions',
        'Packers', 'Panthers', 'Patriots', 'Raiders', 'Rams', 'Ravens', 'Saints',
        'Seahawks', 'Steelers', 'Texans', 'Titans', 'Vikings',
        'San Francisco', 'Los Angeles', 'New Orleans', 'Tampa Bay', 'New England',
        'Kansas City', 'Las Vegas', 'Green Bay'
      ];
      
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const teamLines = [];
      
      lines.forEach(line => {
        for (const team of nflTeams) {
          if (line.includes(team)) {
            teamLines.push(team);
            break;
          }
        }
      });
      
      // Get ALL odds
      const oddsPattern = /[+\-−]\d{3,4}(?!\d)/g;
      const allOdds = [...pageText.matchAll(oddsPattern)].map(m => m[0]);
      
      return {
        teams: teamLines.slice(0, 6), // First 3 games (6 teams)
        allOdds: allOdds.slice(0, 30) // First 30 odds
      };
    });

    console.log('=== FIRST 3 GAMES ===\n');
    
    for (let i = 0; i < 3; i++) {
      const awayTeam = analysis.teams[i * 2];
      const homeTeam = analysis.teams[i * 2 + 1];
      
      console.log(`Game ${i + 1}: ${awayTeam} @ ${homeTeam}`);
      console.log(`Odds around this game (indices ${i * 6} to ${i * 6 + 11}):`);
      
      for (let j = 0; j < 12; j++) {
        const idx = (i * 6) + j;
        if (analysis.allOdds[idx]) {
          console.log(`  [${idx}] ${analysis.allOdds[idx]}`);
        }
      }
      console.log();
    }
    
    console.log('\nBrowser will stay open. Look at the page and compare:');
    console.log('- Which odds are the MONEYLINE for each game?');
    console.log('- What are their indices?');
    console.log('\nPress Ctrl+C when done.\n');
    
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debug();