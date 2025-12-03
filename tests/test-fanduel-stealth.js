// tests/test-fanduel-stealth.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('🕵️  Testing FanDuel with STEALTH mode...\n');
  
  const browser = await puppeteer.launch({
    headless: false,  // Visible so you can see if captcha appears
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📍 Navigating to FanDuel NFL page...');
    await page.goto('https://sportsbook.fanduel.com/navigation/nfl', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('✅ Page loaded! Waiting...');
    await sleep(5000);

    // Check for captcha
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasCaptcha = pageText.includes('press and hold') || 
                       pageText.includes('prove you') ||
                       pageText.includes('not a bot');

    if (hasCaptcha) {
      console.log('❌ Captcha still detected with stealth mode');
    } else {
      console.log('✅ No captcha detected!');
      console.log('\n📄 Page preview:');
      console.log(pageText.substring(0, 500));
    }

    console.log('\n🔍 Check the browser - do you see games or captcha?');
    console.log('   Press Ctrl+C when done...');
    
    await sleep(60000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();