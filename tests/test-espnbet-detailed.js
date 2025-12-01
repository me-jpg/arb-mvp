// tests/test-espnbet-detailed.js
// See exact text structure from ESPN Bet

require('dotenv').config();
const puppeteer = require('puppeteer');

async function debug() {
  console.log('🔍 ESPN BET DETAILED DEBUG\n');
  
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

    console.log('Waiting...\n');
    await new Promise(resolve => setTimeout(resolve, 18000));

    const analysis = await page.evaluate(() => {
      const pageText = document.body.innerText;
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Find Saints/Dolphins, Rams/Panthers, Texans/Colts sections
      const gamesOfInterest = ['Saints', 'Dolphins', 'Rams', 'Panthers', 'Texans', 'Colts'];
      const relevantLines = [];
      
      lines.forEach((line, idx) => {
        if (gamesOfInterest.some(team => line.includes(team))) {
          // Get this line and the next 5 lines
          for (let i = 0; i < 6; i++) {
            if (lines[idx + i]) {
              relevantLines.push(`[${idx + i}] ${lines[idx + i]}`);
            }
          }
        }
      });
      
      return {
        relevantLines: relevantLines.slice(0, 50)
      };
    });

    console.log('=== LINES AROUND GAMES OF INTEREST ===\n');
    analysis.relevantLines.forEach(line => console.log(line));
    
    console.log('\n\nLook at the browser and the console output.');
    console.log('Find where the MONEYLINE odds appear relative to team names.');
    console.log('\nPress Ctrl+C when done.\n');
    
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debug();