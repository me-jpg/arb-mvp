// tests/test-fanduel-html.js
const puppeteer = require('puppeteer');
const fs = require('fs');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('🔍 Extracting FanDuel HTML structure...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📍 Navigating to FanDuel NFL page...');
    await page.goto('https://sportsbook.fanduel.com/navigation/nfl', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('✅ Page loaded! Waiting for content...');
    await sleep(5000);

    // Get the HTML
    const html = await page.content();
    
    // Save to file
    fs.writeFileSync('fanduel-page.html', html);
    console.log('✅ Saved HTML to: fanduel-page.html');
    
    // Extract just the main content area
    const mainContent = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return main.innerHTML;
    });
    
    fs.writeFileSync('fanduel-main.html', mainContent);
    console.log('✅ Saved main content to: fanduel-main.html');
    
    // Try to find ANY game-related elements
    console.log('\n🔎 Searching for game-related elements...\n');
    
    const gameInfo = await page.evaluate(() => {
      // Look for team names
      const teamElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return (text.includes('Cowboys') || text.includes('Dolphins')) && el.children.length < 5;
      });
      
      return teamElements.slice(0, 5).map(el => ({
        tag: el.tagName,
        className: el.className,
        id: el.id,
        text: el.textContent.substring(0, 50)
      }));
    });
    
    console.log('Team name elements found:');
    console.log(JSON.stringify(gameInfo, null, 2));
    
    console.log('\n📖 Open fanduel-page.html in your browser to inspect the structure');
    console.log('🔍 Look for the game containers and tell me the class names!');
    
    await sleep(10000);
    await browser.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
  }
})();