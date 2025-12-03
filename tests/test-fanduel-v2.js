// tests/test-fanduel-v2.js
const FanDuelV2 = require('../src/scrapers/fanduel-v2');

(async () => {
  console.log('🧪 Testing FanDuel V2 scraper with detailed logging...\n');
  
  const scraper = new FanDuelV2();
  
  try {
    // Add detailed logging to the scrape method
    await scraper.initBrowser();
    const page = await scraper.browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(scraper.url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Debug extraction
    const debug = await page.evaluate(() => {
      const nflTeams = ['Cowboys', 'Lions', 'Dolphins', 'Jets'];
      
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const oddsButtons = buttons.filter(btn => {
        const text = btn.textContent.trim();
        return /^[+-]\d{3,4}$/.test(text);
      });
      
      console.log(`Found ${oddsButtons.length} odds buttons`);
      
      const containerInfo = [];
      
      oddsButtons.slice(0, 5).forEach((btn, idx) => {
        let container = btn;
        const ariaLabel = btn.getAttribute('aria-label') || 'no label';
        const price = btn.textContent.trim();
        
        // Go up to find teams
        for (let i = 0; i < 15; i++) {
          if (!container.parentElement) break;
          container = container.parentElement;
          
          const text = container.textContent;
          const foundTeams = nflTeams.filter(team => text.includes(team));
          
          if (foundTeams.length > 0) {
            containerInfo.push({
              buttonIdx: idx,
              price: price,
              ariaLabel: ariaLabel.substring(0, 100),
              levelsUp: i,
              teamsFound: foundTeams,
              containerTextSample: text.substring(0, 200)
            });
            break;
          }
        }
      });
      
      return containerInfo;
    });
    
    console.log('🔍 Button → Container mapping:\n');
    debug.forEach(info => {
      console.log(`Button: ${info.price}`);
      console.log(`  Label: ${info.ariaLabel}`);
      console.log(`  Levels up: ${info.levelsUp}`);
      console.log(`  Teams found: ${info.teamsFound.join(', ')}`);
      console.log(`  Container text: ${info.containerTextSample}`);
      console.log('');
    });
    
    await page.close();
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await scraper.close();
  }
})();