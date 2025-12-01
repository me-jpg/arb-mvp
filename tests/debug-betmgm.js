// tests/debug-betmgm.js
// Debug script to inspect BetMGM page structure

const puppeteer = require('puppeteer');

async function debugBetMGM() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 DEBUGGING: BetMGM Page Structure');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    console.log('\n⏳ Loading BetMGM NFL page...');
    await page.goto('https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('✅ Page loaded, waiting 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n🔍 Inspecting page structure...\n');
    
    const debug = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 500),
        
        // Look for various potential selectors
        selectors: {
          '.grid-wrapper': document.querySelectorAll('.grid-wrapper').length,
          '.event-card': document.querySelectorAll('.event-card').length,
          '.game-card': document.querySelectorAll('.game-card').length,
          '.participant': document.querySelectorAll('.participant').length,
          '.option': document.querySelectorAll('.option').length,
          '.option-indicator': document.querySelectorAll('.option-indicator').length,
          '[class*="game"]': document.querySelectorAll('[class*="game"]').length,
          '[class*="event"]': document.querySelectorAll('[class*="event"]').length,
          '[class*="match"]': document.querySelectorAll('[class*="match"]').length,
        },
        
        // Get all unique class names
        allClasses: Array.from(new Set(
          Array.from(document.querySelectorAll('*'))
            .flatMap(el => Array.from(el.classList))
            .filter(c => c.includes('game') || c.includes('event') || c.includes('match') || c.includes('grid'))
        )).slice(0, 30),
        
        // Try to find game containers
        gameContainers: Array.from(document.querySelectorAll('[class*="game"], [class*="event"], [class*="match"]'))
          .slice(0, 5)
          .map(el => ({
            tagName: el.tagName,
            className: el.className,
            textPreview: el.innerText.substring(0, 100)
          }))
      };
      
      return info;
    });

    console.log('📄 Page Title:', debug.title);
    console.log('🔗 URL:', debug.url);
    console.log('\n📊 Selector Counts:');
    Object.entries(debug.selectors).forEach(([selector, count]) => {
      console.log(`   ${count > 0 ? '✅' : '❌'} ${selector}: ${count}`);
    });
    
    console.log('\n🏷️  Relevant Class Names Found:');
    debug.allClasses.forEach(cls => console.log(`   - ${cls}`));
    
    console.log('\n🎯 Sample Elements:');
    debug.gameContainers.forEach((el, idx) => {
      console.log(`\n${idx + 1}. <${el.tagName}> class="${el.className}"`);
      console.log(`   Text: "${el.textPreview}..."`);
    });
    
    console.log('\n💡 Keep browser open for 30 seconds so you can inspect manually...');
    console.log('   Right-click -> Inspect Element to see the actual structure');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n' + '='.repeat(60));
}

debugBetMGM().then(() => {
  console.log('✅ Debug completed\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});