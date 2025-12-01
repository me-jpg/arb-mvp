// tests/debug-espnbet.js
// Debug script to inspect ESPN Bet page structure

const puppeteer = require('puppeteer');

async function debugESPN() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 DEBUGGING: ESPN Bet Page Structure');
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

    console.log('\n⏳ Loading ESPN Bet NFL page...');
    await page.goto('https://espnbet.com/sport/football/organization/united-states/competition/nfl#lines', {
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
          '[class*="EventCard"]': document.querySelectorAll('[class*="EventCard"]').length,
          '[class*="event"]': document.querySelectorAll('[class*="event"]').length,
          '[class*="Event"]': document.querySelectorAll('[class*="Event"]').length,
          '[class*="game"]': document.querySelectorAll('[class*="game"]').length,
          '[class*="Game"]': document.querySelectorAll('[class*="Game"]').length,
          '[class*="match"]': document.querySelectorAll('[class*="match"]').length,
          '[class*="Match"]': document.querySelectorAll('[class*="Match"]').length,
          '[class*="Card"]': document.querySelectorAll('[class*="Card"]').length,
          '[class*="competitor"]': document.querySelectorAll('[class*="competitor"]').length,
          '[class*="Competitor"]': document.querySelectorAll('[class*="Competitor"]').length,
        },
        
        // Get all unique class names
        allClasses: Array.from(new Set(
          Array.from(document.querySelectorAll('*'))
            .flatMap(el => Array.from(el.classList))
            .filter(c => 
              c.toLowerCase().includes('event') || 
              c.toLowerCase().includes('game') || 
              c.toLowerCase().includes('match') ||
              c.toLowerCase().includes('card') ||
              c.toLowerCase().includes('competitor')
            )
        )).slice(0, 40),
        
        // Try to find game containers
        gameContainers: Array.from(document.querySelectorAll('[class*="event"], [class*="Event"], [class*="game"], [class*="Game"], [class*="Card"]'))
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
    console.log('   Look for team names and odds in the page');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n' + '='.repeat(60));
}

debugESPN().then(() => {
  console.log('✅ Debug completed\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});