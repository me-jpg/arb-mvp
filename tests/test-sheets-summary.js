// tests/test-sheets-summary.js
// Test Google Sheets summary logging

require('dotenv').config();
const SheetsLogger = require('../src/output/sheets');

async function test() {
  console.log('🧪 Testing Google Sheets Summary Logging\n');
  
  try {
    const sheets = new SheetsLogger();
    
    console.log('📊 Initializing Google Sheets...');
    await sheets.initialize();
    console.log('✅ Connected!\n');
    
    console.log('📝 Logging test summary...');
    const testSummary = {
      timestamp: new Date().toISOString(),
      cycle: 999,
      matched: 26,
      totalArbitrages: 5,
      dkGames: 26,
      fdGames: 26,
      betmgmGames: 8,
      espnbetGames: 13,
      bovadaGames: 12,
      mybookieGames: 16
    };
    
    await sheets.logSummary(testSummary);
    
    console.log('\n✅ Test complete!');
    console.log('📊 Check your Google Sheet "Summary" tab');
    console.log('   You should see a new row with:');
    console.log(`   - Timestamp: ${testSummary.timestamp}`);
    console.log(`   - Cycle: ${testSummary.cycle}`);
    console.log(`   - Matched: ${testSummary.matched}`);
    console.log(`   - Total Arbs: ${testSummary.totalArbitrages}`);
    console.log(`   - Book counts: 26, 26, 8, 13, 12, 16`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

test();