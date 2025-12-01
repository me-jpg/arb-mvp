// tests/inspect-betmgm-iframe.js
const puppeteer = require('puppeteer');

async function inspect() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  
  console.log('Waiting 10 seconds...');
  await new Promise(r => setTimeout(r, 10000));
  
  const frames = page.frames();
  let contentFrame = frames.find(f => f.url().includes('il.betmgm.com'));
  
  if (!contentFrame) contentFrame = page.mainFrame();
  
  const html = await contentFrame.evaluate(() => document.body.innerHTML);
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('betmgm-iframe.html', html);
  console.log('✅ Saved iframe HTML to betmgm-iframe.html');
  
  // Also get all class names
  const classes = await contentFrame.evaluate(() => {
    const allClasses = new Set();
    document.querySelectorAll('*').forEach(el => {
      el.classList.forEach(c => {
        if (c.includes('option') || c.includes('market') || c.includes('event') || 
            c.includes('game') || c.includes('grid') || c.includes('participant')) {
          allClasses.add(c);
        }
      });
    });
    return Array.from(allClasses);
  });
  
  console.log('\nRelevant classes:', classes);
  
  console.log('\nKeeping browser open 30s for manual inspection...');
  await new Promise(r => setTimeout(r, 30000));
  
  await browser.close();
}

inspect();