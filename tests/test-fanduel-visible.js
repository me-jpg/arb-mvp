// tests/test-fanduel-visible.js
const puppeteer = require('puppeteer');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('🔍 Testing FanDuel scraper (VISIBLE mode)...\n');
  
  const browser = await puppeteer.launch({
    headless: false,  // ← VISIBLE BROWSER
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  const page = await browser.newPage();
  
  try {
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    console.log('📍 Navigating to FanDuel NFL page...');
    await page.goto('https://sportsbook.fanduel.com/navigation/nfl', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('✅ Page loaded!');
    console.log('⏳ Waiting 5 seconds for you to inspect...\n');
    
    await sleep(5000);

    // Try to find game elements
    console.log('🔎 Looking for game elements...\n');
    
    const selectors = [
      '[data-test-id="EventCardWrapper"]',
      '[class*="EventCard"]',
      '[class*="event-card"]',
      'div[class*="GameCard"]',
      'div[class*="game"]',
      'a[href*="/american-football/nfl"]'
    ];

    for (const selector of selectors) {
      const count = await page.$$eval(selector, els => els.length).catch(() => 0);
      console.log(`   ${selector}: ${count} elements`);
    }

    // Get page HTML snippet
    console.log('\n📄 Page content preview:');
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log(bodyText);

    console.log('\n🔍 Check the browser window - do you see NFL games?');
    console.log('   Press Ctrl+C when done inspecting...');
    
    // Keep browser open for manual inspection
    await sleep(60000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();