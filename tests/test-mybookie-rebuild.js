// tests/test-mybookie-rebuild.js
const puppeteer = require('puppeteer');

async function inspect() {
  console.log('🔍 MyBookie Pattern Inspector\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.mybookie.ag/sportsbook/nfl/', {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });

  console.log('⏳ Waiting 12 seconds...\n');
  await new Promise(r => setTimeout(r, 12000));

  const analysis = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Find Steelers/Ravens
    let ravensIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Ravens')) {
        ravensIdx = i;
        break;
      }
    }
    
    const context = ravensIdx >= 0 
      ? lines.slice(Math.max(0, ravensIdx - 5), ravensIdx + 25)
      : ['Ravens not found'];
    
    // Get all odds
    const oddsPattern = /[+\-]\d{3,4}/g;
    const allOdds = [...text.matchAll(oddsPattern)].map(m => m[0]);
    
    return {
      ravensContext: context,
      allOddsCount: allOdds.length,
      allOdds: allOdds  // Return ALL odds
    };
  });

  console.log('='.repeat(60));
  console.log('LINES AROUND RAVENS/STEELERS GAME');
  console.log('='.repeat(60));
  analysis.ravensContext.forEach((line, i) => {
    console.log(`[${i}] ${line}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('ALL ODDS ON PAGE');
  console.log('='.repeat(60));
  console.log(`Total odds found: ${analysis.allOddsCount}\n`);
  
  // Find +204 and -285
  const idx204 = analysis.allOdds.indexOf('+204');
  const idx285 = analysis.allOdds.indexOf('-285');
  
  console.log(`Position of +204: ${idx204 >= 0 ? idx204 : 'NOT FOUND'}`);
  console.log(`Position of -285: ${idx285 >= 0 ? idx285 : 'NOT FOUND'}`);
  
  if (idx204 >= 0) {
    console.log(`\nContext around +204 (index ${idx204}):`);
    for (let i = Math.max(0, idx204 - 10); i < Math.min(analysis.allOdds.length, idx204 + 10); i++) {
      const marker = i === idx204 ? ' ← +204 HERE' : '';
      console.log(`  [${i}] ${analysis.allOdds[i]}${marker}`);
    }
  }
  
  if (idx285 >= 0) {
    console.log(`\nContext around -285 (index ${idx285}):`);
    for (let i = Math.max(0, idx285 - 10); i < Math.min(analysis.allOdds.length, idx285 + 10); i++) {
      const marker = i === idx285 ? ' ← -285 HERE' : '';
      console.log(`  [${i}] ${analysis.allOdds[i]}${marker}`);
    }
  }
  
  console.log('\n🔍 If +204 is at index X and -285 is at index Y,');
  console.log('   we can figure out the pattern!');
  console.log('🌐 Browser staying open for 2 minutes...\n');
  
  await new Promise(r => setTimeout(r, 120000));
  await browser.close();
}

inspect();