// tests/latency/staleLineDetector.test.js
// Synthetic tests for staleLineDetector

const { computeStaleLinesFromChanges } = require('../../src/latency/staleLineDetector');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

// FIXED: Use tolerance for float comparisons (MINOR 3.6)
function assertApproxEqual(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`FAIL: ${message} (expected ~${expected}, got ${actual})`);
  }
}

console.log('=== staleLineDetector.test.js ===\n');

// Test 1: Basic stale line detection
{
  const changes = [
    // t = 0: DK moves
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    // t = 2000: MGM moves
    { event_id: 'EVT1', book: 'betmgm', market_type: 'moneyline', side: 'home', created_at: new Date(2000) },
    // t = 8000: DK moves again (MGM has not moved since t=2000, 6000ms ago)
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(8000) }
  ];
  
  // Threshold of 5000ms - MGM should be stale (6000ms without update vs DK's 8000ms update)
  const staleLines = computeStaleLinesFromChanges(changes, 5000);
  
  assert(staleLines.length === 1, `Expected 1 stale line, got ${staleLines.length}`);
  
  const stale = staleLines[0];
  assert(stale.staleBook === 'betmgm', `Stale book should be betmgm, got ${stale.staleBook}`);
  assert(stale.referenceBook === 'draftkings', `Reference book should be draftkings, got ${stale.referenceBook}`);
  // FIXED: Use tolerance for float comparison
  assertApproxEqual(stale.staleDurationMs, 6000, 1, `Stale duration should be ~6000ms`);
  assert(stale.eventId === 'EVT1', 'Event ID mismatch');
  assert(stale.marketType === 'moneyline', 'Market type mismatch');
  
  console.log('✓ Test 1: Basic stale line detection');
  console.log(`   ${stale.staleBook} stale by ${stale.staleDurationMs}ms vs ${stale.referenceBook}`);
}

// Test 2: No stale lines when all books move within threshold
{
  const changes = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT1', book: 'betmgm', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT1', book: 'espnbet', market_type: 'moneyline', side: 'home', created_at: new Date(2000) }
  ];
  
  // Threshold of 5000ms - all within 2000ms of each other, no stale
  const staleLines = computeStaleLinesFromChanges(changes, 5000);
  
  assert(staleLines.length === 0, `Expected 0 stale lines, got ${staleLines.length}`);
  
  console.log('✓ Test 2: No stale lines when all books are responsive');
}

// Test 3: Multiple stale books
{
  const changes = [
    // Only DK keeps updating, MGM and ESPN go stale
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT1', book: 'betmgm', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT1', book: 'espnbet', market_type: 'moneyline', side: 'home', created_at: new Date(2000) },
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(10000) }
  ];
  
  // Threshold of 5000ms - MGM stale by 9000ms, ESPN stale by 8000ms
  const staleLines = computeStaleLinesFromChanges(changes, 5000);
  
  assert(staleLines.length === 2, `Expected 2 stale lines, got ${staleLines.length}`);
  
  const mgmStale = staleLines.find(s => s.staleBook === 'betmgm');
  const espnStale = staleLines.find(s => s.staleBook === 'espnbet');
  
  assert(mgmStale, 'BetMGM should be stale');
  assert(espnStale, 'ESPN should be stale');
  // FIXED: Use tolerance for float comparison
  assertApproxEqual(mgmStale.staleDurationMs, 9000, 1, `MGM stale duration should be ~9000`);
  assertApproxEqual(espnStale.staleDurationMs, 8000, 1, `ESPN stale duration should be ~8000`);
  
  console.log('✓ Test 3: Multiple stale books detected');
  console.log(`   MGM: ${mgmStale.staleDurationMs}ms | ESPN: ${espnStale.staleDurationMs}ms`);
}

// Test 4: Different markets tracked separately
{
  const changes = [
    // Moneyline: DK updates, MGM goes stale
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT1', book: 'betmgm', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(10000) },
    
    // Spread: Both books active, no stale
    { event_id: 'EVT1', book: 'draftkings', market_type: 'spread', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT1', book: 'betmgm', market_type: 'spread', side: 'home', created_at: new Date(1000) }
  ];
  
  const staleLines = computeStaleLinesFromChanges(changes, 5000);
  
  assert(staleLines.length === 1, `Expected 1 stale line, got ${staleLines.length}`);
  assert(staleLines[0].marketType === 'moneyline', 'Stale should be in moneyline market');
  
  console.log('✓ Test 4: Different markets tracked separately');
}

// Test 5: Different events tracked separately
{
  const changes = [
    // EVT1: MGM goes stale
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT1', book: 'betmgm', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(10000) },
    
    // EVT2: Both responsive
    { event_id: 'EVT2', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT2', book: 'betmgm', market_type: 'moneyline', side: 'home', created_at: new Date(2000) }
  ];
  
  const staleLines = computeStaleLinesFromChanges(changes, 5000);
  
  assert(staleLines.length === 1, `Expected 1 stale line, got ${staleLines.length}`);
  assert(staleLines[0].eventId === 'EVT1', 'Stale should be in EVT1');
  
  console.log('✓ Test 5: Different events tracked separately');
}

// Test 6: Stale lines sorted by duration (longest first)
{
  const changes = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT1', book: 'betmgm', market_type: 'moneyline', side: 'home', created_at: new Date(3000) },
    { event_id: 'EVT1', book: 'espnbet', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(15000) }
  ];
  
  // ESPN: 15000 - 1000 = 14000ms stale
  // MGM: 15000 - 3000 = 12000ms stale
  const staleLines = computeStaleLinesFromChanges(changes, 5000);
  
  assert(staleLines.length === 2, `Expected 2 stale lines, got ${staleLines.length}`);
  assert(staleLines[0].staleDurationMs >= staleLines[1].staleDurationMs, 'Should be sorted by duration DESC');
  assert(staleLines[0].staleBook === 'espnbet', `Most stale should be espnbet, got ${staleLines[0].staleBook}`);
  
  console.log('✓ Test 6: Stale lines sorted by duration (longest first)');
}

// Test 7: Single book events ignored (need 2+ books to compare)
{
  const changes = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(10000) }
  ];
  
  const staleLines = computeStaleLinesFromChanges(changes, 5000);
  
  assert(staleLines.length === 0, `Expected 0 stale lines with single book, got ${staleLines.length}`);
  
  console.log('✓ Test 7: Single-book events correctly ignored');
}

// Test 8: Input array not mutated (MEDIUM bug 2.6 fix)
{
  const originalChanges = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(10000) },
    { event_id: 'EVT1', book: 'betmgm', market_type: 'moneyline', side: 'home', created_at: new Date(5000) }
  ];
  
  const firstTimeBefore = originalChanges[0].created_at.getTime();
  
  computeStaleLinesFromChanges(originalChanges, 1000);
  
  // First element should still have same timestamp (not re-ordered by sort)
  assert(originalChanges[0].created_at.getTime() === firstTimeBefore, 'Input array should not be mutated');
  
  console.log('✓ Test 8: Input array not mutated');
}

console.log('\n=== All staleLineDetector tests passed! ===\n');
