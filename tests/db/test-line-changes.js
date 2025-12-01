// tests/db/test-line-changes.js
// Test script for line_changes table and insertLineChanges() function

require('dotenv').config();
const db = require('../../src/utils/db');

async function testLineChanges() {
  console.log('🧪 Testing line_changes table...\n');

  // Connect to database
  const connected = await db.connect();
  if (!connected) {
    console.error('❌ Failed to connect to database');
    process.exit(1);
  }

  try {
    // Create test event first (if it doesn't exist)
    const testEventId = '2025-12-01_Test_Team_A_vs_Test_Team_B';
    console.log('1. Creating test event...');
    await db.upsertEvent({
      eventId: testEventId,
      sport: 'NFL',
      homeTeam: 'Test Team A',
      awayTeam: 'Test Team B',
      startTime: new Date().toISOString()
    });
    console.log('   ✅ Test event created\n');

    // Create test line changes
    const testChanges = [
      {
        eventId: testEventId,
        book: 'draftkings',
        marketType: 'moneyline',
        side: 'home',
        oldLine: null,
        newLine: null,
        oldPrice: -110,
        newPrice: -115,
        changeType: 'price_down'
      },
      {
        eventId: testEventId,
        book: 'fanduel',
        marketType: 'spread',
        side: 'away',
        oldLine: -7.0,
        newLine: -7.5,
        oldPrice: -110,
        newPrice: -110,
        changeType: 'line_move'
      },
      {
        eventId: testEventId,
        book: 'betmgm',
        marketType: 'total',
        side: 'over',
        oldLine: 45.5,
        newLine: 45.5,
        oldPrice: -105,
        newPrice: -115,
        changeType: 'juice_move'
      }
    ];

    console.log('2. Inserting test line changes...');
    console.log(`   Changes to insert: ${testChanges.length}`);
    
    await db.insertLineChanges(testChanges);
    
    console.log('   ✅ Line changes inserted\n');

    // Query to verify
    console.log('3. Verifying inserted data...');
    const result = await db.pool.query(
      'SELECT * FROM line_changes WHERE event_id = $1 ORDER BY created_at DESC',
      [testEventId]
    );

    console.log(`   Rows found: ${result.rows.length}\n`);
    
    if (result.rows.length > 0) {
      console.log('   Sample row:');
      const row = result.rows[0];
      console.log(`   - Book: ${row.book}`);
      console.log(`   - Market: ${row.market_type}`);
      console.log(`   - Side: ${row.side}`);
      console.log(`   - Old Price: ${row.old_price}`);
      console.log(`   - New Price: ${row.new_price}`);
      console.log(`   - Change Type: ${row.change_type}`);
      console.log(`   - Created: ${row.created_at}\n`);
    }

    // Test with empty array (should be no-op)
    console.log('4. Testing with empty array...');
    await db.insertLineChanges([]);
    console.log('   ✅ No errors with empty array\n');

    // Summary
    console.log('✅ All tests passed!');
    console.log(`   Total line changes inserted: ${testChanges.length}`);
    console.log(`   Total rows in table: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run tests
testLineChanges().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});