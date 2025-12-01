// tests/test-betmgm-inspect.js
// Diagnostic tool to inspect BetMGM's page structure and find correct selectors

const puppeteer = require('puppeteer');

async function inspectBetMGM() {
  console.log('🔍 BETMGM PAGE STRUCTURE INSPECTOR\n');
  console.log('This will open BetMGM and help you find the correct selectors...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Keep visible so you can see the page
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('Loading BetMGM NFL page...');
    await page.goto('https://sports.il.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('Waiting for page to load...\n');
    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('='.repeat(80));
    console.log('INSTRUCTIONS:');
    console.log('='.repeat(80));
    console.log('1. Look at the BetMGM page that opened');
    console.log('2. Right-click on a TEAM NAME → Inspect');
    console.log('3. Find the class name or selector for team names');
    console.log('4. Right-click on a MONEYLINE ODD (the number like -150) → Inspect');
    console.log('5. Find the class name or selector for odds');
    console.log('6. Share those selectors with me!\n');
    
    console.log('Browser will stay open for 2 minutes so you can inspect...');
    console.log('Press Ctrl+C when done.\n');
    
    // Keep browser open for 2 minutes
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectBetMGM();