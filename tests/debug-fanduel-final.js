// tests/debug-fanduel-final.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('🐛 Final FanDuel Debug...\n');
  
  const browser = await puppeteer.launch({
    headless: true, // VISIBLE
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
    console.log('✅ Page loaded\n');

    // COMPREHENSIVE element search
    const debug = await page.evaluate(() => {
      const result = {
        tbodyCount: 0,
        tableCount: 0,
        trCount: 0,
        buttonCount: 0,
        oddsButtonCount: 0,
        teamTextFound: false,
        sampleHTML: ''
      };

      // Count elements
      result.tbodyCount = document.querySelectorAll('tbody').length;
      result.tableCount = document.querySelectorAll('table').length;
      result.trCount = document.querySelectorAll('tr').length;
      result.buttonCount = document.querySelectorAll('button, div[role="button"]').length;

      // Count odds buttons
      const buttons = document.querySelectorAll('button, div[role="button"]');
      buttons.forEach(btn => {
        const text = btn.textContent.trim();
        if (/^[+-]\d{3,4}$/.test(text)) {
          result.oddsButtonCount++;
        }
      });

      // Check for team names
      const bodyText = document.body.innerText;
      result.teamTextFound = bodyText.includes('Cowboys') || bodyText.includes('Dolphins');

      // Get first tbody HTML
      const firstTbody = document.querySelector('tbody');
      if (firstTbody) {
        result.sampleHTML = firstTbody.outerHTML.substring(0, 2000);
      }

      // Try to find game containers manually
      const allDivs = Array.from(document.querySelectorAll('div'));
      const gameDiv = allDivs.find(div => {
        const text = div.textContent;
        return text.includes('Cowboys') && 
               text.includes('Lions') && 
               text.includes('SPREAD') &&
               div.children.length > 0 &&
               div.children.length < 30;
      });

      if (gameDiv) {
        result.gameDivHTML = gameDiv.outerHTML.substring(0, 3000);
        result.gameDivClass = gameDiv.className;
        result.gameDivTag = gameDiv.tagName;
      }

      return result;
    });

    console.log('🔍 DEBUG RESULTS:\n');
    console.log(`Tables: ${debug.tableCount}`);
    console.log(`Tbody: ${debug.tbodyCount}`);
    console.log(`TR rows: ${debug.trCount}`);
    console.log(`All buttons: ${debug.buttonCount}`);
    console.log(`Odds buttons (with prices): ${debug.oddsButtonCount}`);
    console.log(`Team text found: ${debug.teamTextFound}`);

    if (debug.gameDivClass) {
      console.log(`\n✅ Found game container:`);
      console.log(`   Tag: ${debug.gameDivTag}`);
      console.log(`   Class: ${debug.gameDivClass}`);
    }

    console.log(`\n📄 Sample HTML from first tbody:`);
    console.log(debug.sampleHTML.substring(0, 500));

    if (debug.gameDivHTML) {
      console.log(`\n📄 Game container HTML:`);
      console.log(debug.gameDivHTML.substring(0, 800));
      
      // Save to file
      fs.writeFileSync('fanduel-game-div.html', debug.gameDivHTML);
      console.log(`\n✅ Saved game div HTML to: fanduel-game-div.html`);
    }

    console.log('\n⏸️  Browser will stay open for 30 seconds...');
    console.log('   Right-click on Cowboys game and Inspect Element!');
    
    await sleep(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();