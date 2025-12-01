// tests/test-dk-all-odds.js
// Show ALL odds for the first game to understand the pattern

const puppeteer = require('puppeteer');

async function test() {
  console.log('🔍 DRAFTKINGS ODDS PATTERN DIAGNOSTIC\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Keep visible
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('Loading DraftKings NFL page...');
    await page.goto('https://sportsbook.draftkings.com/leagues/football/nfl', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 6000));

    const analysis = await page.evaluate(() => {
      const sections = document.querySelectorAll('.cms-market-selector-section-wrapper');
      const firstSection = sections[0];
      
      if (!firstSection) return { error: 'No sections found' };
      
      // Get teams
      const teamLabels = firstSection.querySelectorAll('.cb-market__label-inner');
      const teams = Array.from(teamLabels).map(el => el.textContent.trim());
      
      // Get ALL odds
      const oddsElements = firstSection.querySelectorAll('.cb-market__button-odds');
      const allOdds = Array.from(oddsElements).map((el, idx) => ({
        index: idx,
        value: el.textContent.trim()
      }));
      
      // Get market labels (spread, moneyline, total, etc.)
      const marketLabels = firstSection.querySelectorAll('.cb-market__label');
      const labels = Array.from(marketLabels).map(el => el.textContent.trim());
      
      return {
        teams: teams.slice(0, 4), // First 2 games (4 teams)
        allOdds: allOdds.slice(0, 12), // First 12 odds
        labels: labels.slice(0, 10)
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
    
    console.log('\n=== MARKET LABELS ===');
    analysis.labels.forEach((label, i) => {
      console.log(`  [${i}] ${label}`);
    });
    
    console.log('\n\n🎯 INSTRUCTIONS:');
    console.log('1. Look at the odds above');
    console.log('2. Identify which indices are the MONEYLINE odds');
    console.log('3. The pattern should be consistent across games');
    console.log('4. Share this output so we can fix the scraper!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

test();