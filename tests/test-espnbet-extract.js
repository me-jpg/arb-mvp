// tests/test-espnbet-extract.js
const puppeteer = require('puppeteer');

async function scrapeESPNBet() {
  console.log('============================================================');
  console.log('🧪 TESTING: ESPN Bet (Data Extraction)');
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
    await new Promise(r => setTimeout(r, 15000));
    
    console.log('⏳ Extracting games...');
    
    const games = await page.evaluate(() => {
      const results = [];
      
      // Try different selectors for game containers
      const selectors = [
        '[data-testid*="event"]',
        '[data-testid*="game"]',
        '[data-testid*="match"]',
        '[class*="event"]',
        '[class*="game"]',
        '[class*="EventCard"]',
        '[class*="Match"]',
        '[class*="Fixture"]',
        'article',
        '[role="article"]'
      ];
      
      let gameElements = [];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          // Check if these look like game containers (have team names, odds, etc)
          let validCount = 0;
          elements.forEach(el => {
            const text = el.textContent || '';
            // Look for patterns that indicate this is a game
            const hasOdds = /[+-]\d{3,}/.test(text); // American odds like +150, -110
            const hasTeam = text.length > 10 && text.length < 500;
            if (hasOdds && hasTeam) validCount++;
          });
          
          if (validCount > 0) {
            console.log(`  → ${validCount} appear to be valid game containers`);
            gameElements = Array.from(elements);
            break;
          }
        }
      }
      
      console.log(`Processing ${gameElements.length} potential games...`);
      
      gameElements.forEach((gameEl, idx) => {
        try {
          const text = gameEl.textContent || '';
          
          // Look for team names (usually in specific elements)
          const teamSelectors = [
            '[data-testid*="team"]',
            '[data-testid*="competitor"]',
            '[class*="team"]',
            '[class*="Team"]',
            '[class*="competitor"]',
            '[class*="Competitor"]',
            'h3', 'h4', 'h5'
          ];
          
          let teams = [];
          for (const sel of teamSelectors) {
            const teamEls = gameEl.querySelectorAll(sel);
            if (teamEls.length >= 2) {
              teams = Array.from(teamEls).slice(0, 2).map(el => el.textContent.trim());
              if (teams[0] && teams[1]) break;
            }
          }
          
          // Look for odds buttons
          const oddsSelectors = [
            'button',
            '[role="button"]',
            '[data-testid*="odd"]',
            '[class*="odd"]',
            '[class*="Odd"]',
            '[class*="bet"]',
            '[class*="Bet"]'
          ];
          
          let oddsButtons = [];
          for (const sel of oddsSelectors) {
            const buttons = gameEl.querySelectorAll(sel);
            if (buttons.length >= 2) {
              oddsButtons = Array.from(buttons).map(btn => {
                const text = btn.textContent.trim();
                const oddsMatch = text.match(/([+-]\d{3,})/);
                return oddsMatch ? oddsMatch[1] : null;
              }).filter(o => o);
              
              if (oddsButtons.length >= 2) break;
            }
          }
          
          if (teams.length >= 2 || oddsButtons.length >= 2) {
            results.push({
              index: idx,
              teams: teams.length >= 2 ? teams : ['Team extraction failed', 'Team extraction failed'],
              odds: oddsButtons.slice(0, 6),
              textSample: text.substring(0, 200)
            });
          }
          
        } catch (e) {
          console.error(`Error parsing game ${idx}:`, e);
        }
      });
      
      return results;
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Extraction completed in ${elapsed}s`);
    
    console.log(`\n📊 Found ${games.length} games\n`);
    
    games.slice(0, 5).forEach((game, i) => {
      console.log(`Game ${i + 1}:`);
      console.log(`  Teams: ${game.teams[0]} @ ${game.teams[1]}`);
      console.log(`  Odds found: ${game.odds.length} - [${game.odds.join(', ')}]`);
      console.log(`  Sample text: ${game.textSample.substring(0, 100)}...`);
      console.log();
    });
    
    console.log('\n⏸  Browser left open for inspection. Press Ctrl+C when done.');
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
  }
}

scrapeESPNBet();