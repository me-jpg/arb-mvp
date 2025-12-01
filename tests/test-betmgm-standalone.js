// tests/test-betmgm-standalone.js
// Standalone test for BetMGM scraper - no dependencies

const puppeteer = require('puppeteer');

async function delay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBetMGM() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING: BetMGM Multi-Market Scraper (Standalone)');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let results = [];

  try {
    const page = await browser.newPage();
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    console.log('\n⏳ Loading BetMGM NFL page...');
    const url = 'https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35';
    
    const startTime = Date.now();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('✅ Page loaded, waiting for content...');
    
    // Wait for game elements to appear
    try {
      await page.waitForSelector('.grid-wrapper', { timeout: 15000 });
      console.log('✅ Game elements detected, waiting additional time for odds...');
    } catch (e) {
      console.log('⚠️  No game elements detected, waiting anyway...');
    }
    
    await delay(8000, 10000);

    console.log('⏳ Extracting game data...');
    results = await page.evaluate(() => {
      const games = [];
      
      // Find all game containers
      const gameElements = document.querySelectorAll('.grid-wrapper');
      
      gameElements.forEach(gameEl => {
        try {
          // Extract team names
          const teamElements = gameEl.querySelectorAll('.participant');
          if (teamElements.length < 2) return;
          
          const awayTeam = teamElements[0]?.textContent?.trim() || '';
          const homeTeam = teamElements[1]?.textContent?.trim() || '';
          
          if (!awayTeam || !homeTeam) return;
          
          // Extract all odds for this game
          const oddsButtons = gameEl.querySelectorAll('.option');
          const allOdds = Array.from(oddsButtons).map(btn => {
            const oddsText = btn.querySelector('.option-indicator')?.textContent?.trim() || '';
            return parseInt(oddsText) || 0;
          });
          
          // Extract spread and total values
          const lineTexts = Array.from(gameEl.querySelectorAll('.option-name')).map(el => 
            el.textContent.trim()
          );
          
          const markets = {};
          
          // MONEYLINE (first 2 odds)
          if (allOdds.length >= 2) {
            markets.moneyline = {
              awayOdds: allOdds[0],
              homeOdds: allOdds[1]
            };
          }
          
          // SPREAD (next 2 odds + line values)
          if (allOdds.length >= 4) {
            const spreadRegex = /([+\-−]?\d+\.?\d*)/;
            let awaySpreadLine = 0;
            let homeSpreadLine = 0;
            
            lineTexts.forEach(text => {
              const match = text.match(spreadRegex);
              if (match && (text.includes('Spread') || text.includes('Line'))) {
                const value = parseFloat(match[1].replace('−', '-'));
                if (!awaySpreadLine) {
                  awaySpreadLine = value;
                } else if (!homeSpreadLine) {
                  homeSpreadLine = value;
                }
              }
            });
            
            if (awaySpreadLine !== 0 || homeSpreadLine !== 0) {
              markets.spread = {
                awayLine: awaySpreadLine,
                awayOdds: allOdds[2],
                homeLine: homeSpreadLine,
                homeOdds: allOdds[3]
              };
            }
          }
          
          // TOTAL (next 2 odds + total value)
          if (allOdds.length >= 6) {
            const totalRegex = /([Oo]|[Uu])\s*(\d+\.?\d*)/;
            let totalLine = 0;
            
            lineTexts.forEach(text => {
              const match = text.match(totalRegex);
              if (match) {
                totalLine = parseFloat(match[2]);
              }
            });
            
            if (totalLine > 0) {
              markets.total = {
                line: totalLine,
                overOdds: allOdds[4],
                underOdds: allOdds[5]
              };
            }
          }
          
          if (Object.keys(markets).length > 0) {
            games.push({
              awayTeam,
              homeTeam,
              markets
            });
          }
        } catch (e) {
          console.error('Error parsing game:', e.message);
        }
      });
      
      return games;
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Scrape completed in ${duration}s`);
    console.log(`📊 Total games: ${results.length}`);
    
    // Count markets
    let totalMarkets = 0;
    let mlCount = 0;
    let spreadCount = 0;
    let totalCount = 0;
    
    results.forEach(game => {
      if (game.markets) {
        if (game.markets.moneyline) { mlCount++; totalMarkets++; }
        if (game.markets.spread) { spreadCount++; totalMarkets++; }
        if (game.markets.total) { totalCount++; totalMarkets++; }
      }
    });
    
    console.log(`📊 Total markets: ${totalMarkets}`);
    console.log(`   - Moneyline: ${mlCount}`);
    console.log(`   - Spread: ${spreadCount}`);
    console.log(`   - Total: ${totalCount}`);
    
    // Show first 3 games
    console.log('\n📋 Sample Games:');
    results.slice(0, 3).forEach((game, idx) => {
      console.log(`\n${idx + 1}. ${game.awayTeam} @ ${game.homeTeam}`);
      
      if (game.markets.moneyline) {
        console.log(`   ✅ Moneyline: away=${game.markets.moneyline.awayOdds}, home=${game.markets.moneyline.homeOdds}`);
      } else {
        console.log(`   ❌ Moneyline: missing`);
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
    
    // Validation
    console.log('\n🔍 Validation Checks:');
    
    const checks = {
      gamesFound: results.length > 0,
      hasMoneylines: mlCount > 0,
      hasSpreads: spreadCount > 0,
      hasTotals: totalCount > 0,
      avgMarketsPerGame: totalMarkets / results.length >= 1.5
    };
    
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}: ${passed}`);
    });
    
    const allPassed = Object.values(checks).every(v => v === true);
    
    if (allPassed) {
      console.log('\n✅ ALL TESTS PASSED');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
    }
    
    const expectedMarkets = results.length * 3;
    const coveragePercent = (totalMarkets / expectedMarkets * 100).toFixed(1);
    console.log(`\n📊 Market Coverage: ${totalMarkets}/${expectedMarkets} (${coveragePercent}%)`);

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('\n' + '='.repeat(60));
}

testBetMGM().then(() => {
  console.log('✅ Test completed\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});