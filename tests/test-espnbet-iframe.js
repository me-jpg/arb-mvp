// tests/test-espnbet-iframe.js
const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeESPNBet() {
  console.log('============================================================');
  console.log('🧪 TESTING: ESPN Bet (Iframe Detection)');
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
    
    console.log('✅ Page loaded, waiting for iframes...');
    await new Promise(r => setTimeout(r, 15000)); // Wait longer for iframes
    
    console.log('⏳ Analyzing page structure...');
    
    // Check all frames
    const frames = page.frames();
    console.log(`📦 Total frames found: ${frames.length}`);
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const url = frame.url();
      console.log(`\n📄 Frame ${i}: ${url.substring(0, 100)}...`);
      
      try {
        const analysis = await frame.evaluate(() => {
          const results = {
            url: window.location.href,
            totalElements: document.querySelectorAll('*').length,
            hasGames: false,
            selectors: []
          };
          
          // Look for potential game containers
          const patterns = [
            'event', 'game', 'match', 'fixture', 'card', 'row',
            'competitor', 'team', 'odds', 'market', 'bet'
          ];
          
          const classes = new Set();
          document.querySelectorAll('*').forEach(el => {
            if (el.className && typeof el.className === 'string') {
              el.className.split(' ').forEach(cls => {
                patterns.forEach(pattern => {
                  if (cls.toLowerCase().includes(pattern)) {
                    classes.add(cls);
                  }
                });
              });
            }
          });
          
          results.selectors = Array.from(classes).slice(0, 30);
          results.hasGames = classes.size > 0;
          
          return results;
        });
        
        console.log(`   Elements: ${analysis.totalElements}`);
        console.log(`   Potential game selectors: ${analysis.selectors.length}`);
        
        if (analysis.selectors.length > 0) {
          console.log(`   📋 Top selectors:`);
          analysis.selectors.slice(0, 10).forEach(sel => {
            console.log(`      - ${sel}`);
          });
        }
        
        // If this frame looks promising, save its HTML
        if (analysis.hasGames && analysis.totalElements > 100) {
          console.log(`   ✨ This frame looks promising! Saving HTML...`);
          const html = await frame.content();
          fs.writeFileSync(`/mnt/user-data/outputs/tests/espnbet-frame-${i}.html`, html);
          console.log(`   💾 Saved to tests/espnbet-frame-${i}.html`);
        }
        
      } catch (e) {
        console.log(`   ⚠️  Could not analyze: ${e.message}`);
      }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Analysis completed in ${elapsed}s`);
    
    console.log('\n💡 Next steps:');
    console.log('   1. Check the saved HTML files in tests/ folder');
    console.log('   2. Find the frame with actual game data');
    console.log('   3. Identify the correct selectors');
    
    console.log('\n⏸  Browser left open. Press Ctrl+C when done.');
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
  }
}

scrapeESPNBet();