// tests/test-espnbet-inspect.js
// Inspect ESPN Bet page structure

const puppeteer = require('puppeteer');

async function inspect() {
  console.log('🔍 ESPN BET PAGE INSPECTOR\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('Loading ESPN Bet NFL page...');
    await page.goto('https://espnbet.com/sport/football/organization/united-states/competition/nfl', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    console.log('Waiting for content to load...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const analysis = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      
      // Find lines with team names
      const nflTeams = [
        '49ers', 'Bears', 'Bengals', 'Bills', 'Broncos', 'Browns', 'Buccaneers',
        'Cardinals', 'Chargers', 'Chiefs', 'Colts', 'Commanders', 'Cowboys',
        'Dolphins', 'Eagles', 'Falcons', 'Giants', 'Jaguars', 'Jets', 'Lions',
        'Packers', 'Panthers', 'Patriots', 'Raiders', 'Rams', 'Ravens', 'Saints',
        'Seahawks', 'Steelers', 'Texans', 'Titans', 'Vikings'
      ];
      
      const teamLines = lines.filter(line => {
        const trimmed = line.trim();
        return nflTeams.includes(trimmed) || 
               nflTeams.some(team => trimmed.includes(team));
      }).slice(0, 30);
      
      // Get all odds
      const oddsPattern = /[+\-−]\d{3,4}(?!\d)/g;
      const oddsMatches = [...text.matchAll(oddsPattern)];
      const allOdds = oddsMatches.map(m => m[0]).slice(0, 30);
      
      // Get short lines (potential team names)
      const shortLines = lines.filter(line => 
        line.length > 2 && 
        line.length < 25 &&
        !line.includes('ESPN BET') &&
        !line.includes('Sign In')
      ).slice(0, 50);
      
      return {
        teamLines,
        oddsCount: allOdds.length,
        firstOdds: allOdds,
        shortLines,
        textSample: text.substring(0, 1500)
      };
    });

    console.log('=== ANALYSIS ===');
    console.log(`\nFound ${analysis.teamLines.length} lines with team names:`);
    analysis.teamLines.forEach((line, i) => {
      console.log(`  [${i}] ${line}`);
    });
    
    console.log(`\n\nFound ${analysis.oddsCount} odds on page`);
    if (analysis.firstOdds.length > 0) {
      console.log('First 30 odds:');
      analysis.firstOdds.forEach((odd, i) => {
        console.log(`  [${i}] ${odd}`);
      });
    } else {
      console.log('⚠️  NO ODDS FOUND!');
    }
    
    console.log('\n\n=== SHORT LINES (potential team names) ===');
    analysis.shortLines.slice(0, 30).forEach((line, i) => {
      console.log(`  [${i}] ${line}`);
    });
    
    console.log('\n\n=== TEXT SAMPLE ===');
    console.log(analysis.textSample);
    
    console.log('\n\nBrowser will stay open for 2 minutes.');
    console.log('Look at the page and check:');
    console.log('1. Are NFL games visible?');
    console.log('2. Do you need to click/scroll to see odds?');
    console.log('3. Is there a login/location gate?');
    console.log('\nPress Ctrl+C when done.\n');
    
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspect();