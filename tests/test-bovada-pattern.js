// tests/test-bovada-pattern.js
const puppeteer = require('puppeteer');

async function test() {
  console.log('🔍 Inspecting Bovada Pattern\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.bovada.lv/sports/football/nfl', {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });

  await new Promise(r => setTimeout(r, 12000));

  const analysis = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    
    // Find Raiders game
    const raidersIdx = lines.findIndex(l => l.includes('Raiders'));
    
    // Get 20 lines around Raiders
    const context = lines.slice(Math.max(0, raidersIdx - 5), raidersIdx + 20);
    
    // Get all odds
    const oddsPattern = /[+\-]\d{3,4}/g;
    const allOdds = [...text.matchAll(oddsPattern)].map(m => m[0]);
    
    return {
      raidersContext: context,
      first30Odds: allOdds.slice(0, 30)
    };
  });

  console.log('Lines around Raiders game:');
  analysis.raidersContext.forEach((line, i) => {
    console.log(`[${i}] ${line}`);
  });
  
  console.log('\n\nFirst 30 odds on page:');
  analysis.first30Odds.forEach((odd, i) => {
    console.log(`[${i}] ${odd}`);
  });

  console.log('\n\nBrowser staying open for inspection...');
  await new Promise(r => setTimeout(r, 60000));
  
  await browser.close();
}

test();