// tests/test-bovada-inspect.js
// Inspect Bovada page structure

const puppeteer = require('puppeteer');

async function inspect() {
  console.log('🔍 BOVADA PAGE INSPECTOR\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('Loading Bovada NFL page...');
    await page.goto('https://www.bovada.lv/sports/football/nfl', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    console.log('Waiting for content to load...\n');
    await new Promise(resolve => setTimeout(resolve, 12000));

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
        line.length < 30
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
    
    console.log('\n\n=== SHORT LINES (first 50) ===');
    analysis.shortLines.forEach((line, i) => {
      console.log(`  [${i}] ${line}`);
    });
    
    console.log('\n\n=== TEXT SAMPLE ===');
    console.log(analysis.textSample);
    
    console.log('\n\nBrowser will stay open for 2 minutes.');
    console.log('Look at the page:');
    console.log('1. Are NFL games visible?');
    console.log('2. Is there a firewall/block page?');
    console.log('3. What do team names look like?');
    console.log('\nPress Ctrl+C when done.\n');
    
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspect();