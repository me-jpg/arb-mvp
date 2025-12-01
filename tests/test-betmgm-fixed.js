// tests/test-betmgm-fixed.js
const puppeteer = require('puppeteer');

async function delay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBetMGM() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING: BetMGM (Fixed Selectors)');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let results = [];

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('\n⏳ Loading BetMGM...');
    const startTime = Date.now();
    
    await page.goto('https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('✅ Page loaded, waiting for iframe...');
    await delay(5000, 6000);

    // Find iframe
    const frames = page.frames();
    let contentFrame = frames.find(f => f.url().includes('il.betmgm.com'));
    if (!contentFrame) contentFrame = page.mainFrame();

    console.log('⏳ Waiting for games...');
    await delay(8000, 10000);

    console.log('⏳ Extracting...');
    results = await contentFrame.evaluate(() => {
      const games = [];
      const gameElements = document.querySelectorAll('.grid-event');
      
      gameElements.forEach(gameEl => {
        try {
          // Team names
          const participants = gameEl.querySelectorAll('.participant');
          if (participants.length < 2) return;
          
          const awayTeam = participants[0].textContent.trim();
          const homeTeam = participants[1].textContent.trim();
          
          // Get all option groups (ML, Spread, Total are usually first 3)
          const optionGroups = gameEl.querySelectorAll('.grid-option-group');
          
          const markets = {};
          
          // Process each option group
          optionGroups.forEach((group, groupIdx) => {
            const options = group.querySelectorAll('.grid-option');
            
            if (options.length < 2) return;
            
            // Extract odds
            const odds = Array.from(options).map(opt => {
              const indicator = opt.querySelector('.option-indicator');
              if (!indicator) return 0;
              const text = indicator.textContent.trim();
              return parseInt(text) || 0;
            });
            
            // Extract line values
            const names = Array.from(options).map(opt => {
              const name = opt.querySelector('.option-name');
              return name ? name.textContent.trim() : '';
            });
            
            // Determine market type
            const groupText = group.textContent.toLowerCase();
            
            // MONEYLINE - no line values, just team names
            if (groupIdx === 0 && !names[0].match(/[\d\+\-]/)) {
              if (odds[0] && odds[1]) {
                markets.moneyline = {
                  awayOdds: odds[0],
                  homeOdds: odds[1]
                };
              }
            }
            // SPREAD - has +/- values
            else if (names.some(n => n.match(/^[\+\-]\d/))) {
              const awayLine = parseFloat(names[0].match(/([\+\-]\d+\.?\d*)/)?.[1] || 0);
              const homeLine = parseFloat(names[1].match(/([\+\-]\d+\.?\d*)/)?.[1] || 0);
              
              if (awayLine !== 0 || homeLine !== 0) {
                markets.spread = {
                  awayLine,
                  awayOdds: odds[0] || 0,
                  homeLine,
                  homeOdds: odds[1] || 0
                };
              }
            }
            // TOTAL - has O/U
            else if (names.some(n => n.match(/^[OU]/i))) {
              const totalLine = parseFloat(names[0].match(/(\d+\.?\d*)/)?.[1] || 
                                         names[1].match(/(\d+\.?\d*)/)?.[1] || 0);
              
              if (totalLine > 0) {
                markets.total = {
                  line: totalLine,
                  overOdds: odds[0] || 0,
                  underOdds: odds[1] || 0
                };
              }
            }
          });
          
          if (Object.keys(markets).length > 0) {
            games.push({ awayTeam, homeTeam, markets });
          }
        } catch (e) {
          console.error('Error:', e.message);
        }
      });
      
      return games;
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Scrape completed in ${duration}s`);
    console.log(`📊 Total games: ${results.length}`);
    
    let totalMarkets = 0, mlCount = 0, spreadCount = 0, totalCount = 0;
    
    results.forEach(game => {
      if (game.markets.moneyline) { mlCount++; totalMarkets++; }
      if (game.markets.spread) { spreadCount++; totalMarkets++; }
      if (game.markets.total) { totalCount++; totalMarkets++; }
    });
    
    console.log(`📊 Total markets: ${totalMarkets}`);
    console.log(`   - Moneyline: ${mlCount}`);
    console.log(`   - Spread: ${spreadCount}`);
    console.log(`   - Total: ${totalCount}`);
    
    console.log('\n📋 First 3 games:');
    results.slice(0, 3).forEach((game, idx) => {
      console.log(`\n${idx + 1}. ${game.awayTeam} @ ${game.homeTeam}`);
      
      if (game.markets.moneyline) {
        console.log(`   ✅ ML: ${game.markets.moneyline.awayOdds} / ${game.markets.moneyline.homeOdds}`);
      } else {
        console.log(`   ❌ ML: missing`);
      }
      
      if (game.markets.spread) {
        console.log(`   ✅ Spread: ${game.markets.spread.awayLine} (${game.markets.spread.awayOdds}) / ${game.markets.spread.homeLine} (${game.markets.spread.homeOdds})`);
      } else {
        console.log(`   ⚠️  Spread: missing`);
      }
      
      if (game.markets.total) {
        console.log(`   ✅ Total: ${game.markets.total.line} (o:${game.markets.total.overOdds}, u:${game.markets.total.underOdds})`);
      } else {
        console.log(`   ⚠️  Total: missing`);
      }
    });
    
    const checks = {
      gamesFound: results.length >= 3,
      hasMoneylines: mlCount >= 3,
      hasSpreads: spreadCount >= 3,
      hasTotals: totalCount >= 3
    };
    
    console.log('\n🔍 Validation:');
    Object.entries(checks).forEach(([k, v]) => {
      console.log(`   ${v ? '✅' : '❌'} ${k}`);
    });
    
    if (Object.values(checks).every(v => v)) {
      console.log('\n✅ ALL TESTS PASSED');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('\n' + '='.repeat(60));
}

testBetMGM().then(() => process.exit(0)).catch(() => process.exit(1));