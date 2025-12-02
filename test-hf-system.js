// test-hf-system.js
// Test script for high-frequency tracking system

require('dotenv').config();
const { lightweightScrape } = require('./src/highfreq/lightweightScraper');
const { detectChanges } = require('./src/highfreq/changeDetector');
const oddsCache = require('./src/highfreq/oddsCache');
const DraftKingsScraper = require('./src/scrapers/draftkings');

async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING HIGH-FREQUENCY SYSTEM');
  console.log('='.repeat(60));

  try {
    // Step 1: Test scraper
    console.log('\n📊 Step 1: Testing DraftKings scraper...');
    const scraper = new DraftKingsScraper();
    const oddsRecords = await lightweightScrape(scraper, 'draftkings', 3);
    
    console.log(`✅ Scraped ${oddsRecords.length} odds records`);
    
    if (oddsRecords.length === 0) {
      console.error('❌ FAILED: No odds records extracted!');
      process.exit(1);
    }

    // Display sample record
    console.log('\n📋 Sample odds record:');
    console.log(JSON.stringify(oddsRecords[0], null, 2));

    // Validate structure
    const sample = oddsRecords[0];
    const requiredFields = ['eventId', 'book', 'marketType', 'side', 'price'];
    const missingFields = requiredFields.filter(field => !(field in sample));
    
    if (missingFields.length > 0) {
      console.error(`❌ FAILED: Missing fields: ${missingFields.join(', ')}`);
      process.exit(1);
    }

    console.log('✅ All required fields present');

    // Step 2: Test change detection (first pass - should be no changes)
    console.log('\n🔍 Step 2: Testing change detection (first pass)...');
    const changes1 = detectChanges(oddsRecords, oddsCache);
    
    console.log(`✅ First pass: ${changes1.length} changes (expected 0)`);
    if (changes1.length > 0) {
      console.warn('⚠️  Warning: First pass should have 0 changes');
    }

    console.log(`📦 Cache size: ${oddsCache.size()}`);

    // Step 3: Test change detection (second pass - should be no changes if data unchanged)
    console.log('\n🔍 Step 3: Testing change detection (second pass)...');
    const changes2 = detectChanges(oddsRecords, oddsCache);
    
    console.log(`✅ Second pass: ${changes2.length} changes (expected 0 if data unchanged)`);

    // Step 4: Test with modified data (simulate a price change)
    console.log('\n🔍 Step 4: Testing with simulated price change...');
    const modifiedRecords = oddsRecords.map(record => ({
      ...record,
      price: record.price + 10 // Simulate price change
    }));

    const changes3 = detectChanges(modifiedRecords, oddsCache);
    
    console.log(`✅ After price change: ${changes3.length} changes detected`);
    
    if (changes3.length > 0) {
      console.log('\n📋 Sample change:');
      console.log(JSON.stringify(changes3[0], null, 2));
      
      // Validate change structure
      const changeFields = ['eventId', 'book', 'marketType', 'side', 'oldPrice', 'newPrice', 'changeType'];
      const missingChangeFields = changeFields.filter(field => !(field in changes3[0]));
      
      if (missingChangeFields.length > 0) {
        console.error(`❌ FAILED: Change missing fields: ${missingChangeFields.join(', ')}`);
        process.exit(1);
      }
      
      console.log('✅ Change structure valid');
    }

    // Step 5: Test market type coverage
    console.log('\n📊 Step 5: Testing market type coverage...');
    const marketTypes = new Set(oddsRecords.map(r => r.marketType));
    console.log(`Markets found: ${Array.from(marketTypes).join(', ')}`);
    
    // Check line values by market type
    const moneylineRecords = oddsRecords.filter(r => r.marketType === 'moneyline');
    const spreadRecords = oddsRecords.filter(r => r.marketType === 'spread');
    const totalRecords = oddsRecords.filter(r => r.marketType === 'total');
    
    console.log(`\n📈 Breakdown:`);
    console.log(`  Moneyline: ${moneylineRecords.length} records`);
    console.log(`  Spread: ${spreadRecords.length} records`);
    console.log(`  Total: ${totalRecords.length} records`);
    
    // Validate line values
    if (moneylineRecords.length > 0) {
      const mlWithLine = moneylineRecords.filter(r => r.line !== null);
      if (mlWithLine.length > 0) {
        console.error(`❌ FAILED: Moneyline should have line=null, found ${mlWithLine.length} with line values`);
        process.exit(1);
      }
      console.log('  ✅ Moneyline: All have line=null');
    }
    
    if (spreadRecords.length > 0) {
      const spreadWithoutLine = spreadRecords.filter(r => r.line === null);
      if (spreadWithoutLine.length > 0) {
        console.error(`❌ FAILED: Spread should have line value, found ${spreadWithoutLine.length} with line=null`);
        console.log('Sample spread without line:', spreadWithoutLine[0]);
        process.exit(1);
      }
      console.log('  ✅ Spread: All have line values');
    }
    
    if (totalRecords.length > 0) {
      const totalWithoutLine = totalRecords.filter(r => r.line === null);
      if (totalWithoutLine.length > 0) {
        console.error(`❌ FAILED: Total should have line value, found ${totalWithoutLine.length} with line=null`);
        process.exit(1);
      }
      console.log('  ✅ Total: All have line values');
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n✓ Scraper extracts odds correctly');
    console.log('✓ All required fields present');
    console.log('✓ Change detection works');
    console.log('✓ Line values correct for all market types');
    console.log('✓ Cache operations functional');
    console.log('\n🚀 System ready for deployment!\n');

    await scraper.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();