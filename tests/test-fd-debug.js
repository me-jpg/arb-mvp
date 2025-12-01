const puppeteer = require('puppeteer');
const config = require('../config');

async function test() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  await page.goto(config.books.fanduel.url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 8000));

  await page.evaluate(() => {
    // Find team names
    const teamSpans = document.querySelectorAll('span[aria-label]');
    const teams = [];
    
    teamSpans.forEach(span => {
      const label = span.getAttribute('aria-label');
      if (label && 
          !label.includes('Navigate') && 
          !label.includes('wagers') &&
          !label.includes('event page') &&
          label.length > 3) {
        teams.push(label);
      }
    });
    
    console.log('Teams found:', teams.length);
    console.log('First 10 teams:', teams.slice(0, 10));
    
    // Find odds
    const pageText = document.body.innerText;
    const oddsPattern = /[+\-−]\d{3}/g;
    const oddsMatches = [...pageText.matchAll(oddsPattern)];
    const odds = oddsMatches.map(m => m[0]);
    
    console.log('Odds found:', odds.length);
    console.log('First 20 odds:', odds.slice(0, 20));
  });

  console.log('\n⚠️  Check browser console (F12) for output');
  console.log('Press Ctrl+C to close\n');
  
  await new Promise(() => {});
}

test();