// tests/test-bovada-rebuild.js
// Rebuild Bovada scraper from scratch

const puppeteer = require('puppeteer');

async function inspect() {
  console.log('🔍 BOVADA COMPLETE REBUILD - INSPECTOR\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('📡 Loading Bovada NFL page...\n');
    await page.goto('https://www.bovada.lv/sports/football/nfl', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    console.log('⏳ Waiting 12 seconds for content...\n');
    await new Promise(r => setTimeout(r, 12000));

    const analysis = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Find Cardinals game
      let cardsIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Arizona Cardinals')) {
          cardsIdx = i;
          break;
        }
      }
      
      // Get 30 lines around Cardinals
      const cardContext = cardsIdx >= 0 
        ? lines.slice(Math.max(0, cardsIdx - 3), cardsIdx + 30)
        : ['Cardinals not found'];
      
      // Get ALL selectors that might contain games
      const selectors = {
        coupons: document.querySelectorAll('.coupon-content').length,
        gameLines: document.querySelectorAll('.game-line').length,
        names: document.querySelectorAll('.name').length,
        markets: document.querySelectorAll('.markets-container').length,
        spreads: document.querySelectorAll('[class*="spread"]').length,
        moneylines: document.querySelectorAll('[class*="moneyline"]').length,
      };
      
      // Try to extract Cardinals game via DOM
      let cardsGameDOM = null;
      const allText = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent.includes('Arizona Cardinals'))
        .map(el => ({
          tag: el.tagName,
          class: el.className,
          text: el.textContent.substring(0, 200)
        }));
      
      return {
        cardContext,
        selectors,
        cardsElements: allText.slice(0, 5)
      };
    });

    console.log('='.repeat(60));
    console.log('LINES AROUND CARDINALS GAME');
    console.log('='.repeat(60));
    analysis.cardContext.forEach((line, i) => {
      console.log(`[${i}] ${line}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('DOM SELECTORS COUNT');
    console.log('='.repeat(60));
    Object.entries(analysis.selectors).forEach(([key, count]) => {
      console.log(`${key}: ${count}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('ELEMENTS CONTAINING "ARIZONA CARDINALS"');
    console.log('='.repeat(60));
    analysis.cardsElements.forEach((el, i) => {
      console.log(`\nElement ${i+1}:`);
      console.log(`  Tag: ${el.tag}`);
      console.log(`  Class: ${el.class}`);
      console.log(`  Text: ${el.text}...`);
    });
    
    console.log('\n\n🌐 Browser will stay open for 2 minutes.');
    console.log('👀 Manually inspect the Cardinals game and note:');
    console.log('   1. Which row has Cardinals');
    console.log('   2. Where are the +170 odds?');
    console.log('   3. Which row has Buccaneers'); 
    console.log('   4. Where are the -200 odds?');
    console.log('⏹️  Press Ctrl+C when done.\n');
    
    await new Promise(r => setTimeout(r, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspect();