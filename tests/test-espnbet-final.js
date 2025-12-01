// tests/test-espnbet-final.js
const puppeteer = require('puppeteer');

async function scrapeESPNBet() {
  console.log('============================================================');
  console.log('🧪 TESTING: ESPN Bet (Final)');
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
    
    console.log('✅ Page loaded, waiting for games...');
    await new Promise(r => setTimeout(r, 15000));
    
    console.log('⏳ Extracting...');
    
    const games = await page.evaluate(() => {
      const results = [];
      const gameArticles = document.querySelectorAll('article');
      
      gameArticles.forEach(article => {
        try {
          // Get team names
          const teamButtons = article.querySelectorAll('[data-testid="team-name"]');
          if (teamButtons.length < 2) return;
          
          // Extract clean team names (first div with text-primary class)
          const team1El = teamButtons[0].querySelector('.text-primary');
          const team2El = teamButtons[1].querySelector('.text-primary');
          
          if (!team1El || !team2El) return;
          
          const team1 = team1El.textContent.trim();
          const team2 = team2El.textContent.trim();
          
          // Get all market selection buttons
          const oddsButtons = article.querySelectorAll('[data-testid^="MarketSelection"]');
          
          const game = {
            team1,
            team2,
            moneyline: null,
            spread: null,
            total: null
          };
          
          // Process each odds button
          oddsButtons.forEach(button => {
            const dataType = button.getAttribute('data-type');
            const oddsSpan = button.querySelector('.text-style-xs-bold');
            if (!oddsSpan) return;
            
            const odds = oddsSpan.textContent.trim();
            
            // MONEYLINE
            if (dataType === 'AWAY_MONEYLINE') {
              if (!game.moneyline) game.moneyline = {};
              game.moneyline.team1 = odds;
            } else if (dataType === 'HOME_MONEYLINE') {
              if (!game.moneyline) game.moneyline = {};
              game.moneyline.team2 = odds;
            }
            
            // SPREAD
            else if (dataType === 'AWAY_SPREAD') {
              const labelSpan = button.querySelector('.text-selector-label-deselected, .text-selector-label-selected');
              const label = labelSpan ? labelSpan.textContent.trim() : '';
              const lineMatch = label.match(/([+-]?\d+\.?\d*)/);
              
              if (lineMatch) {
                if (!game.spread) game.spread = {};
                game.spread.team1 = {
                  line: parseFloat(lineMatch[1]),
                  odds: odds
                };
              }
            } else if (dataType === 'HOME_SPREAD') {
              const labelSpan = button.querySelector('.text-selector-label-deselected, .text-selector-label-selected');
              const label = labelSpan ? labelSpan.textContent.trim() : '';
              const lineMatch = label.match(/([+-]?\d+\.?\d*)/);
              
              if (lineMatch) {
                if (!game.spread) game.spread = {};
                game.spread.team2 = {
                  line: parseFloat(lineMatch[1]),
                  odds: odds
                };
              }
            }
            
            // TOTAL
            else if (dataType === 'OVER') {
              const labelSpan = button.querySelector('.text-selector-label-deselected, .text-selector-label-selected');
              const label = labelSpan ? labelSpan.textContent.trim() : '';
              const lineMatch = label.match(/(\d+\.?\d*)/);
              
              if (lineMatch) {
                if (!game.total) game.total = {};
                game.total.line = parseFloat(lineMatch[1]);
                game.total.over = odds;
              }
            } else if (dataType === 'UNDER') {
              if (game.total) {
                game.total.under = odds;
              }
            }
          });
          
          results.push(game);
        } catch (e) {
          console.error('Error parsing game:', e);
        }
      });
      
      return results;
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Scrape completed in ${elapsed}s`);
    
    // Validate results
    const gamesFound = games.length;
    const hasMoneylines = games.filter(g => g.moneyline).length;
    const hasSpreads = games.filter(g => g.spread).length;
    const hasTotals = games.filter(g => g.total).length;
    
    console.log(`📊 Total games: ${gamesFound}`);
    console.log(`📊 Total markets: ${hasMoneylines + hasSpreads + hasTotals}`);
    console.log(`   - Moneyline: ${hasMoneylines}`);
    console.log(`   - Spread: ${hasSpreads}`);
    console.log(`   - Total: ${hasTotals}`);
    
    console.log('\n📋 First 3 games:');
    games.slice(0, 3).forEach((game, i) => {
      console.log(`${i + 1}. ${game.team1} @ ${game.team2}`);
      
      if (game.moneyline) {
        console.log(`   ✅ ML: ${game.moneyline.team1} / ${game.moneyline.team2}`);
      } else {
        console.log(`   ❌ ML: missing`);
      }
      
      if (game.spread) {
        console.log(`   ✅ Spread: ${game.spread.team1?.line} (${game.spread.team1?.odds}) / ${game.spread.team2?.line} (${game.spread.team2?.odds})`);
      } else {
        console.log(`   ❌ Spread: missing`);
      }
      
      if (game.total) {
        console.log(`   ✅ Total: ${game.total.line} (o:${game.total.over}, u:${game.total.under})`);
      } else {
        console.log(`   ❌ Total: missing`);
      }
    });
    
    // Validation
    console.log('\n🔍 Validation:');
    const checks = {
      gamesFound: gamesFound > 0,
      hasMoneylines: hasMoneylines > 0,
      hasSpreads: hasSpreads > 0,
      hasTotals: hasTotals > 0
    };
    
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });
    
    const allPassed = Object.values(checks).every(v => v);
    
    if (allPassed) {
      console.log('\n✅ ALL TESTS PASSED');
    } else {
      console.log('\n❌ SOME TESTS FAILED');
    }
    
    console.log('============================================================');
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
  }
}

scrapeESPNBet();