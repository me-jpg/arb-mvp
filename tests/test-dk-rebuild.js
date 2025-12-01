// tests/test-dk-rebuild.js
// Comprehensive DraftKings page inspector

const puppeteer = require('puppeteer');

async function inspect() {
  console.log('🔍 DRAFTKINGS INSPECTOR - Starting...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Anti-detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    console.log('📡 Loading DraftKings NFL page...\n');
    await page.goto('https://sportsbook.draftkings.com/leagues/football/nfl', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('⏳ Waiting 15 seconds for content to load...\n');
    await new Promise(r => setTimeout(r, 15000));

    const analysis = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Find patterns
      const atCount = lines.filter(l => l === 'AT').length;
      const moneylineCount = lines.filter(l => l === 'Moneyline').length;
      
      // Find lines with team @ team pattern
      const atGames = [];
      lines.forEach((line, idx) => {
        if (line === 'AT' && idx > 0 && idx < lines.length - 1) {
          atGames.push({
            index: idx,
            away: lines[idx - 1],
            home: lines[idx + 1],
            next10: lines.slice(idx + 2, idx + 12)
          });
        }
      });
      
      // Find odds patterns
      const oddsPattern = /[+\-−]\d{3,4}/g;
      const allOdds = [...text.matchAll(oddsPattern)].map(m => m[0]);
      
      return {
        totalLines: lines.length,
        atCount,
        moneylineCount,
        atGames: atGames.slice(0, 5), // First 5 games
        totalOdds: allOdds.length,
        first50Lines: lines.slice(0, 50),
        sampleOdds: allOdds.slice(0, 30)
      };
    });

    console.log('=' .repeat(60));
    console.log('ANALYSIS RESULTS');
    console.log('='.repeat(60));
    console.log(`Total lines on page: ${analysis.totalLines}`);
    console.log(`"AT" markers found: ${analysis.atCount}`);
    console.log(`"Moneyline" found: ${analysis.moneylineCount}`);
    console.log(`Total odds found: ${analysis.totalOdds}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('FIRST 50 LINES');
    console.log('='.repeat(60));
    analysis.first50Lines.forEach((line, i) => {
      console.log(`[${i}] ${line}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('GAMES FOUND (via AT pattern)');
    console.log('='.repeat(60));
    analysis.atGames.forEach((game, i) => {
      console.log(`\nGame ${i + 1}:`);
      console.log(`  Away: ${game.away}`);
      console.log(`  Home: ${game.home}`);
      console.log(`  Next 10 lines after "AT":`);
      game.next10.forEach((line, j) => {
        console.log(`    [+${j+2}] ${line}`);
      });
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('FIRST 30 ODDS');
    console.log('='.repeat(60));
    analysis.sampleOdds.forEach((odd, i) => {
      console.log(`[${i}] ${odd}`);
    });
    
    console.log('\n\n🌐 Browser will stay open for 2 minutes.');
    console.log('👀 Manually inspect the page to verify data.');
    console.log('⏹️  Press Ctrl+C when done.\n');
    
    await new Promise(r => setTimeout(r, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspect();