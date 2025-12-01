// tests/test-betmgm-final.js
const puppeteer = require('puppeteer');

async function scrapeBetMGM() {
  console.log('============================================================');
  console.log('🧪 TESTING: BetMGM (Final Fix)');
  console.log('============================================================');

  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
  
  const startTime = Date.now();
  
  try {
    console.log('⏳ Loading BetMGM...');
    await page.goto('https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log('✅ Page loaded, waiting for iframe...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Find iframe
    const frames = page.frames();
    const contentFrame = frames.find(f => f.url().includes('il.betmgm.com')) || page.mainFrame();
    
    console.log('⏳ Waiting for games...');
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('⏳ Extracting...');
    
    const games = await contentFrame.evaluate(() => {
      const results = [];
      const gameElements = document.querySelectorAll('.grid-event');
      
      gameElements.forEach(gameEl => {
        try {
          // Get team names
          const participants = gameEl.querySelectorAll('.participant');
          if (participants.length < 2) return;
          
          const team1 = participants[0].textContent.trim();
          const team2 = participants[1].textContent.trim();
          
          // Get all option groups (should be 3: spread, total, moneyline)
          const optionGroups = gameEl.querySelectorAll('.grid-option-group');
          if (optionGroups.length < 3) return;
          
          const game = {
            team1,
            team2,
            moneyline: null,
            spread: null,
            total: null
          };
          
          // GROUP 0 = SPREAD (two-column with option-attribute for lines)
          const spreadGroup = optionGroups[0];
          const spreadOptions = spreadGroup.querySelectorAll('.grid-option');
          if (spreadOptions.length === 2) {
            const spread1Line = spreadOptions[0].querySelector('.option-attribute')?.textContent.trim();
            const spread1Odds = spreadOptions[0].querySelector('.custom-odds-value-style')?.textContent.trim();
            const spread2Line = spreadOptions[1].querySelector('.option-attribute')?.textContent.trim();
            const spread2Odds = spreadOptions[1].querySelector('.custom-odds-value-style')?.textContent.trim();
            
            if (spread1Line && spread1Odds && spread2Line && spread2Odds) {
              game.spread = {
                team1: { line: parseFloat(spread1Line), odds: spread1Odds },
                team2: { line: parseFloat(spread2Line), odds: spread2Odds }
              };
            }
          }
          
          // GROUP 1 = TOTAL (has option-group-attribute at top level)
          const totalGroup = optionGroups[1];
          // Find the div with class 'grid-option option-group-attribute' that contains the total line
          const totalLineDiv = totalGroup.querySelector('.grid-option.option-group-attribute');
          const totalLine = totalLineDiv?.querySelector('.custom-odds-value-style')?.textContent.trim();
          const totalOptions = totalGroup.querySelectorAll('ms-option.grid-option');
          if (totalOptions.length === 2 && totalLine) {
            const overOdds = totalOptions[0].querySelector('.custom-odds-value-style')?.textContent.trim();
            const underOdds = totalOptions[1].querySelector('.custom-odds-value-style')?.textContent.trim();
            
            if (overOdds && underOdds) {
              game.total = {
                line: parseFloat(totalLine),
                over: overOdds,
                under: underOdds
              };
            }
          }
          
          // GROUP 2 = MONEYLINE (two-column, no option-name, just odds)
          const mlGroup = optionGroups[2];
          const mlOptions = mlGroup.querySelectorAll('.grid-option');
          if (mlOptions.length === 2) {
            const ml1Odds = mlOptions[0].querySelector('.custom-odds-value-style')?.textContent.trim();
            const ml2Odds = mlOptions[1].querySelector('.custom-odds-value-style')?.textContent.trim();
            
            if (ml1Odds && ml2Odds) {
              game.moneyline = {
                team1: ml1Odds,
                team2: ml2Odds
              };
            }
          }
          
          results.push(game);
        } catch (e) {
          console.error('Error parsing game:', e);
        }
      });
      
      return results;
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Scrape completed in ${elapsed}s`);
    
    // Count markets
    let mlCount = 0, spreadCount = 0, totalCount = 0;
    games.forEach(g => {
      if (g.moneyline) mlCount++;
      if (g.spread) spreadCount++;
      if (g.total) totalCount++;
    });
    
    console.log(`📊 Total games: ${games.length}`);
    console.log(`📊 Total markets: ${mlCount + spreadCount + totalCount}`);
    console.log(`   - Moneyline: ${mlCount}`);
    console.log(`   - Spread: ${spreadCount}`);
    console.log(`   - Total: ${totalCount}`);
    
    // Show first 3 games
    console.log(`📋 First 3 games:`);
    games.slice(0, 3).forEach((g, i) => {
      console.log(`${i + 1}. ${g.team1} @ ${g.team2}`);
      if (g.moneyline) {
        console.log(`   ✅ ML: ${g.moneyline.team1} / ${g.moneyline.team2}`);
      } else {
        console.log(`   ❌ ML: missing`);
      }
      if (g.spread) {
        console.log(`   ✅ Spread: ${g.spread.team1.line} (${g.spread.team1.odds}) / ${g.spread.team2.line} (${g.spread.team2.odds})`);
      } else {
        console.log(`   ❌ Spread: missing`);
      }
      if (g.total) {
        console.log(`   ✅ Total: ${g.total.line} (o:${g.total.over}, u:${g.total.under})`);
      } else {
        console.log(`   ❌ Total: missing`);
      }
    });
    
    // Validation
    console.log(`🔍 Validation:`);
    const checks = {
      gamesFound: games.length >= 8,
      hasMoneylines: mlCount >= 8,
      hasSpreads: spreadCount >= 8,
      hasTotals: totalCount >= 8
    };
    
    Object.entries(checks).forEach(([key, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${key}`);
    });
    
    const allPassed = Object.values(checks).every(v => v);
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED');
    } else {
      console.log('⚠️  SOME TESTS FAILED');
    }
    
    console.log('============================================================');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

scrapeBetMGM();