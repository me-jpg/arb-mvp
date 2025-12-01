// tests/test-dk-inspect.js
// Inspect DraftKings page to find game structure

const puppeteer = require('puppeteer');

async function inspect() {
  console.log('🔍 Inspecting DraftKings page structure\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://sportsbook.draftkings.com/leagues/football/nfl', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('Waiting for page to load...\n');
    await new Promise(resolve => setTimeout(resolve, 8000));

    const analysis = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      
      // Look for lines with "@" (game matchups)
      const gameLines = lines.filter(line => line.includes('@')).slice(0, 20);
      
      // Get first 100 lines to see structure
      const first100 = lines.slice(0, 100);
      
      return {
        gameLines,
        first100
      };
    });

    console.log('=== LINES WITH @ (Game Matchups) ===');
    analysis.gameLines.forEach((line, i) => {
      console.log(`${i+1}. ${line}`);
    });
    
    console.log('\n=== FIRST 100 LINES OF PAGE ===');
    analysis.first100.forEach((line, i) => {
      console.log(`[${i}] ${line}`);
    });
    
    console.log('\n\nBrowser will stay open. Check the page manually.');
    console.log('Look for the actual game listings and their HTML structure.');
    console.log('Press Ctrl+C when done.\n');
    
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspect();