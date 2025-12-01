// tests/test-espnbet.js
const puppeteer = require('puppeteer');

async function scrapeESPNBet() {
  console.log('============================================================');
  console.log('🧪 TESTING: ESPN Bet');
  console.log('============================================================');

  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
  
  const startTime = Date.now();
  
  try {
    console.log('⏳ Loading ESPN Bet...');
    await page.goto('https://espnbet.com/sport/football/organization/united-states/competition/nfl', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log('✅ Page loaded, waiting for content...');
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('⏳ Extracting...');
    
    const games = await page.evaluate(() => {
      const results = [];
      
      // Try multiple selectors
      console.log('Looking for game containers...');
      
      // Log what we find
      const allDivs = document.querySelectorAll('div');
      console.log(`Total divs on page: ${allDivs.length}`);
      
      // Look for class patterns
      const classPatterns = new Set();
      allDivs.forEach(div => {
        if (div.className && typeof div.className === 'string') {
          div.className.split(' ').forEach(cls => {
            if (cls.toLowerCase().includes('event') || 
                cls.toLowerCase().includes('game') ||
                cls.toLowerCase().includes('match') ||
                cls.toLowerCase().includes('fixture')) {
              classPatterns.add(cls);
            }
          });
        }
      });
      
      console.log('Potential event class patterns:', Array.from(classPatterns).slice(0, 20));
      
      return {
        totalDivs: allDivs.length,
        classPatterns: Array.from(classPatterns).slice(0, 20),
        games: results
      };
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Analysis completed in ${elapsed}s`);
    
    console.log('\n📊 Page Analysis:');
    console.log(`   Total divs: ${games.totalDivs}`);
    console.log(`   Potential event classes found: ${games.classPatterns.length}`);
    if (games.classPatterns.length > 0) {
      console.log('\n   Class patterns:');
      games.classPatterns.forEach(cls => console.log(`      - ${cls}`));
    }
    
    console.log('\n💡 Next steps:');
    console.log('   1. Inspect the page manually');
    console.log('   2. Find the correct selectors for game containers');
    console.log('   3. Update the scraper logic');
    
    console.log('\n⏸  Browser left open for inspection. Press Ctrl+C when done.');
    
    // Keep browser open for inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
  }
}

scrapeESPNBet();