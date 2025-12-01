// tests/debug-fanduel-network.js
// Intercept FanDuel's API calls to get clean JSON data

const puppeteer = require('puppeteer');

async function interceptFanDuelNetwork() {
  console.log('\n' + '='.repeat(70));
  console.log('🕵️  FANDUEL NETWORK INTERCEPTION');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    const apiCalls = [];

    // Intercept all network requests
    page.on('response', async (response) => {
      const url = response.url();
      
      // Look for API calls (usually contain 'api', 'data', or 'events')
      if (url.includes('api') || url.includes('events') || url.includes('nfl')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          
          if (contentType.includes('json')) {
            const data = await response.json();
            apiCalls.push({
              url: url,
              data: data,
              status: response.status()
            });
          }
        } catch (e) {
          // Not JSON or couldn't parse
        }
      }
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('\n📡 Loading FanDuel and capturing API calls...');
    await page.goto('https://sportsbook.fanduel.com/football/nfl', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    console.log('⏳ Waiting for all requests to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`\n📊 Captured ${apiCalls.length} API calls`);
    
    apiCalls.forEach((call, i) => {
      console.log(`\n${i + 1}. ${call.url}`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Data keys: ${Object.keys(call.data).join(', ')}`);
      
      // Look for arrays that might contain games
      Object.entries(call.data).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          console.log(`   → ${key} is array with ${value.length} items`);
          if (value.length > 0 && value.length < 50) {
            console.log(`      First item keys: ${Object.keys(value[0]).join(', ')}`);
          }
        }
      });
    });

    // Try to find the market prices data
    console.log('\n🔍 LOOKING FOR MARKET PRICES DATA:');
    const marketPricesCall = apiCalls.find(call => 
      call.url.includes('getMarketPrices')
    );

    if (marketPricesCall) {
      console.log('\n✅ FOUND MARKET PRICES API!');
      console.log('URL:', marketPricesCall.url);
      console.log(`\nData has ${Object.keys(marketPricesCall.data).length} market entries`);
      
      // Show first market entry in detail
      const firstKey = Object.keys(marketPricesCall.data)[0];
      console.log(`\nFirst market (key "${firstKey}"):`);
      console.log(JSON.stringify(marketPricesCall.data[firstKey], null, 2).substring(0, 1500));
      console.log('\n... (showing first 1500 chars)');
      
      // Save full data to file
      const fs = require('fs');
      fs.writeFileSync(
        'fanduel-market-prices.json',
        JSON.stringify(marketPricesCall.data, null, 2)
      );
      console.log('\n✅ Full data saved to: fanduel-market-prices.json');
    }
    
    // Also look for competition page
    const competitionCall = apiCalls.find(call => 
      call.url.includes('competition-page')
    );
    
    if (competitionCall) {
      console.log('\n✅ FOUND COMPETITION PAGE API!');
      console.log('URL:', competitionCall.url);
      
      const fs = require('fs');
      fs.writeFileSync(
        'fanduel-competition-page.json',
        JSON.stringify(competitionCall.data, null, 2)
      );
      console.log('✅ Saved to: fanduel-competition-page.json');
    }

    console.log('\n⏸️  Press Ctrl+C to close...');
    await new Promise(resolve => {
      process.on('SIGINT', resolve);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

interceptFanDuelNetwork();