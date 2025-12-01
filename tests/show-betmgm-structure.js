// tests/show-betmgm-structure.js
const puppeteer = require('puppeteer');

async function show() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  
  await new Promise(r => setTimeout(r, 10000));
  
  const frames = page.frames();
  let contentFrame = frames.find(f => f.url().includes('il.betmgm.com')) || page.mainFrame();
  
  const structure = await contentFrame.evaluate(() => {
    const firstGame = document.querySelector('.grid-event');
    if (!firstGame) return { error: 'No game found' };
    
    const teams = Array.from(firstGame.querySelectorAll('.participant')).map(p => p.textContent.trim());
    
    const groups = Array.from(firstGame.querySelectorAll('.grid-option-group')).map((group, idx) => {
      const options = Array.from(group.querySelectorAll('.grid-option')).map(opt => ({
        name: opt.querySelector('.option-name')?.textContent?.trim() || 'N/A',
        indicator: opt.querySelector('.option-indicator')?.textContent?.trim() || 'N/A',
        value: opt.querySelector('.option-value')?.textContent?.trim() || 'N/A',
        attribute: opt.querySelector('.option-attribute')?.textContent?.trim() || 'N/A',
        fullText: opt.textContent.trim().substring(0, 50)
      }));
      
      return {
        groupIndex: idx,
        optionCount: options.length,
        options: options
      };
    });
    
    return { teams, groups };
  });
  
  console.log('\n📊 First Game Structure:\n');
  console.log('Teams:', structure.teams);
  console.log('\nOption Groups:\n');
  structure.groups.forEach(group => {
    console.log(`\nGroup ${group.groupIndex} (${group.optionCount} options):`);
    group.options.forEach((opt, idx) => {
      console.log(`  Option ${idx}:`);
      console.log(`    name: "${opt.name}"`);
      console.log(`    indicator: "${opt.indicator}"`);
      console.log(`    value: "${opt.value}"`);
      console.log(`    attribute: "${opt.attribute}"`);
    });
  });
  
  await browser.close();
}

show();