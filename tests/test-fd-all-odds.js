// tests/test-fd-all-odds.js
// Show ALL odds for the first game to understand FanDuel's pattern

const puppeteer = require('puppeteer');

async function test() {
  console.log('🔍 FANDUEL ODDS PATTERN DIAGNOSTIC\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('Loading FanDuel NFL page...');
    await page.goto('https://sportsbook.fanduel.com/navigation/nfl', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 6000));

    const analysis = await page.evaluate(() => {
      // Get teams
      const allSpans = document.querySelectorAll('span[aria-label]');
      const teams = [];
      
      allSpans.forEach(span => {
        const label = span.getAttribute('aria-label');
        if (label && 
            !label.includes('Navigate') && 
            !label.includes('wagers') &&
            !label.includes('event page') &&
            label.length > 3) {
          teams.push(label);
        }
      });
      
      // Get ALL odds from page text
      const pageText = document.body.innerText;
      const oddsPattern = /[+\-−]\d{3}/g;
      const oddsMatches = [...pageText.matchAll(oddsPattern)];
      const allOdds = oddsMatches.map((match, idx) => ({
        index: idx,
        value: match[0]
      }));
      
      return {
        teams: teams.slice(0, 4), // First 2 games
        allOdds: allOdds.slice(0, 12) // First 12 odds
      };
    });

    console.log('=== FIRST GAME ===');
    console.log(`Away: ${analysis.teams[0]}`);
    console.log(`Home: ${analysis.teams[1]}`);
    console.log('\nALL ODDS (first 6 odds):');
    analysis.allOdds.slice(0, 6).forEach(odd => {
      console.log(`  [${odd.index}] ${odd.value}`);
    });
    
    console.log('\n=== SECOND GAME ===');
    console.log(`Away: ${analysis.teams[2]}`);
    console.log(`Home: ${analysis.teams[3]}`);
    console.log('\nALL ODDS (next 6 odds):');
    analysis.allOdds.slice(6, 12).forEach(odd => {
      console.log(`  [${odd.index}] ${odd.value}`);
    });
    
    console.log('\n\n🎯 INSTRUCTIONS:');
    console.log('Look at the browser window - which indices are MONEYLINE?');
    console.log('Compare the odds shown visually to the indices above.');
    console.log('\nLikely pattern for 6 odds per game:');
    console.log('  [0] Spread away');
    console.log('  [1] Moneyline away ← CHECK THIS');
    console.log('  [2] Total over');
    console.log('  [3] Spread home');
    console.log('  [4] Moneyline home ← CHECK THIS');
    console.log('  [5] Total under');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

test();