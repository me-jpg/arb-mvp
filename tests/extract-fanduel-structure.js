// tests/extract-fanduel-structure.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('🔍 Extracting FanDuel structure with stealth...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📍 Navigating...');
    await page.goto('https://sportsbook.fanduel.com/navigation/nfl', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await sleep(5000);

    console.log('🔎 Analyzing page structure...\n');

    // Find elements containing team names
    const structure = await page.evaluate(() => {
      const results = {
        teamNameElements: [],
        oddsButtonElements: [],
        gameContainers: []
      };

      // Find elements with Cowboys or Dolphins
      const allElements = Array.from(document.querySelectorAll('*'));
      
      allElements.forEach(el => {
        const text = el.textContent || '';
        
        // Look for team names
        if ((text.includes('Cowboys') || text.includes('Dolphins')) && 
            text.length < 100 && el.children.length < 3) {
          results.teamNameElements.push({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            textSample: text.substring(0, 50)
          });
        }
        
        // Look for odds (numbers like -110, +150, etc)
        if (/[+-]\d{3}/.test(text) && text.length < 50 && el.children.length === 0) {
          results.oddsButtonElements.push({
            tag: el.tagName,
            className: el.className,
            ariaLabel: el.getAttribute('aria-label'),
            textSample: text.substring(0, 30)
          });
        }
      });

      // Find likely game containers (parent elements)
      const cowboys = document.body.innerText.indexOf('Cowboys');
      if (cowboys > -1) {
        // Try common container patterns
        const containers = [
          ...document.querySelectorAll('[class*="event"]'),
          ...document.querySelectorAll('[class*="game"]'),
          ...document.querySelectorAll('[class*="match"]'),
          ...document.querySelectorAll('[class*="card"]')
        ];

        containers.slice(0, 10).forEach(el => {
          if (el.textContent.includes('Cowboys') || el.textContent.includes('Dolphins')) {
            results.gameContainers.push({
              tag: el.tagName,
              className: el.className,
              childCount: el.children.length,
              textLength: el.textContent.length
            });
          }
        });
      }

      return results;
    });

    console.log('📊 STRUCTURE ANALYSIS:\n');
    console.log('Team Name Elements:', JSON.stringify(structure.teamNameElements.slice(0, 5), null, 2));
    console.log('\nOdds Button Elements:', JSON.stringify(structure.oddsButtonElements.slice(0, 5), null, 2));
    console.log('\nGame Container Elements:', JSON.stringify(structure.gameContainers.slice(0, 3), null, 2));

    // Save full HTML for manual inspection
    const html = await page.content();
    fs.writeFileSync('fanduel-stealth.html', html);
    console.log('\n✅ Full HTML saved to: fanduel-stealth.html');

    console.log('\n🔍 Browser still open - inspect the elements manually!');
    await sleep(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();