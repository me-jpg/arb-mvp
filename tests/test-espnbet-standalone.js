// tests/test-espnbet-standalone.js
// Standalone test for ESPN Bet scraper - no dependencies

const puppeteer = require('puppeteer');

async function delay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testESPNBet() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING: ESPN Bet Multi-Market Scraper (Standalone)');
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

    console.log('\n⏳ Loading ESPN Bet NFL page...');
    const startTime = Date.now();
    
    await page.goto('https://espnbet.com/sport/football/organization/united-states/competition/nfl#lines', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('✅ Page loaded, waiting for content...');
    
    // Wait for event cards to appear
    try {
      await page.waitForSelector('[class*="EventCard"]', { timeout: 15000 });
      console.log('✅ Event cards detected, waiting additional time for markets...');
    } catch (e) {
      console.log('⚠️  No event cards detected, waiting anyway...');
    }
    
    await delay(8000, 10000);

    console.log('⏳ Extracting game data...');
    results = await page.evaluate(() => {
      const games = [];
      
      // Find all event cards
      const eventCards = document.querySelectorAll('[class*="EventCard"]');
      
      eventCards.forEach(card => {
        try {
          // Extract team names
          const teamElements = card.querySelectorAll('[class*="CompetitorName"]');
          if (teamElements.length < 2) return;
          
          const awayTeam = teamElements[0]?.textContent?.trim() || '';
          const homeTeam = teamElements[1]?.textContent?.trim() || '';
          
          if (!awayTeam || !homeTeam) return;
          
          // Extract all market containers
          const marketContainers = card.querySelectorAll('[class*="Market"]');
          
          const markets = {};
          
          marketContainers.forEach(container => {
            try {
              const marketTitle = container.querySelector('[class*="MarketTitle"]')?.textContent?.trim() || '';
              
              // Get all selections in this market
              const selections = container.querySelectorAll('[class*="Selection"]');
              const odds = Array.from(selections).map(sel => {
                const oddsText = sel.querySelector('[class*="odd"]')?.textContent?.trim() || '';
                return parseInt(oddsText) || 0;
              });
              
              // MONEYLINE
              if (marketTitle.toLowerCase().includes('money') || marketTitle.toLowerCase().includes('winner')) {
                if (odds.length >= 2) {
                  markets.moneyline = {
                    awayOdds: odds[0],
                    homeOdds: odds[1]
                  };
                }
              }
              
              // SPREAD
              else if (marketTitle.toLowerCase().includes('spread') || marketTitle.toLowerCase().includes('handicap')) {
                if (odds.length >= 2) {
                  const labels = Array.from(selections).map(sel => 
                    sel.querySelector('[class*="label"]')?.textContent?.trim() || ''
                  );
                  
                  let awaySpread = 0;
                  let homeSpread = 0;
                  
                  labels.forEach((label, idx) => {
                    const match = label.match(/([+\-−]?\d+\.?\d*)/);
                    if (match) {
                      const value = parseFloat(match[1].replace('−', '-'));
                      if (idx === 0) awaySpread = value;
                      else if (idx === 1) homeSpread = value;
                    }
                  });
                  
                  if (awaySpread !== 0 || homeSpread !== 0) {
                    markets.spread = {
                      awayLine: awaySpread,
                      awayOdds: odds[0],
                      homeLine: homeSpread,
                      homeOdds: odds[1]
                    };
                  }
                }
              }
              
              // TOTAL
              else if (marketTitle.toLowerCase().includes('total') || marketTitle.toLowerCase().includes('over/under')) {
                if (odds.length >= 2) {
                  const labels = Array.from(selections).map(sel => 
                    sel.querySelector('[class*="label"]')?.textContent?.trim() || ''
                  );
                  
                  let totalLine = 0;
                  
                  labels.forEach(label => {
                    const match = label.match(/(\d+\.?\d*)/);
                    if (match && !totalLine) {
                      totalLine = parseFloat(match[1]);
                    }
                  });
                  
                  if (totalLine > 0) {
                    markets.total = {
                      line: totalLine,
                      overOdds: odds[0],
                      underOdds: odds[1]
                    };
                  }
                }
              }
            } catch (e) {
              // Skip this market
            }
          });
          
          if (Object.keys(markets).length > 0) {
            games.push({
              awayTeam,
              homeTeam,
              markets
            });
          }
        } catch (e) {
          // Skip this game
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
    
    // Show all games
    console.log('\n📋 All Games:');
    results.forEach((game, idx) => {
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
      expectedGames: results.length >= 10,
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

testESPNBet().then(() => {
  console.log('✅ Test completed\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});