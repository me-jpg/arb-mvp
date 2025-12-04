// tests/latency/windowBuilder.test.js
// Synthetic tests for windowBuilder with FIXED-LENGTH windows

const { buildWindowsFromChanges } = require('../../src/latency/windowBuilder');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

console.log('=== windowBuilder.test.js ===\n');

// Test 1: FIXED windowing - windows have fixed length, not extending
// With windowMs=10000, changes at t=1000 and t=1500 are in same window
// Change at t=15000 starts a NEW window (since 15000 >= 1000 + 10000)
{
  const changes = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT1', book: 'betmgm',     market_type: 'moneyline', side: 'home', created_at: new Date(1500) },
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(15000) }
  ];
  
  const windows = buildWindowsFromChanges(changes, 10000);
  
  // First window [1000, 11000) has 2 books (DK + MGM)
  // Second window [15000, 25000) has only 1 book (DK) - filtered out
  // So we should get 1 window with 2 books
  assert(windows.length === 1, `Expected 1 window (2-book), got ${windows.length}`);
  
  const w1 = windows[0];
  assert(w1.eventId === 'EVT1', 'Window 1 eventId mismatch');
  assert(w1.marketType === 'moneyline', 'Window 1 marketType mismatch');
  assert(Object.keys(w1.changesByBook).length === 2, 'Window 1 should have 2 books');
  assert(w1.changesByBook['draftkings']?.length === 1, 'Window 1 should have 1 DK change');
  assert(w1.changesByBook['betmgm']?.length === 1, 'Window 1 should have 1 MGM change');
  
  // Verify window is fixed-length: endTime = startTime + windowMs
  assert(w1.endTime === w1.startTime + 10000, `Window should be fixed-length: endTime=${w1.endTime} startTime=${w1.startTime}`);
  
  console.log('✓ Test 1: Fixed-length windowing (2 changes in window 1, 1-book window filtered out)');
}

// Test 2: Multiple events don't mix
{
  const changes = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT2', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(1500) },
    { event_id: 'EVT1', book: 'betmgm',     market_type: 'moneyline', side: 'home', created_at: new Date(2000) },
    { event_id: 'EVT2', book: 'betmgm',     market_type: 'moneyline', side: 'home', created_at: new Date(2500) }
  ];
  
  const windows = buildWindowsFromChanges(changes, 10000);
  
  assert(windows.length === 2, `Expected 2 windows (one per event), got ${windows.length}`);
  
  const evt1Window = windows.find(w => w.eventId === 'EVT1');
  const evt2Window = windows.find(w => w.eventId === 'EVT2');
  
  assert(evt1Window, 'Should have window for EVT1');
  assert(evt2Window, 'Should have window for EVT2');
  assert(Object.keys(evt1Window.changesByBook).length === 2, 'EVT1 window should have 2 books');
  assert(Object.keys(evt2Window.changesByBook).length === 2, 'EVT2 window should have 2 books');
  
  console.log('✓ Test 2: Multiple events create separate windows');
}

// Test 3: Different market types don't mix
{
  const changes = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT1', book: 'betmgm',     market_type: 'spread',    side: 'home', created_at: new Date(1500) },
    { event_id: 'EVT1', book: 'betmgm',     market_type: 'moneyline', side: 'home', created_at: new Date(2000) }
  ];
  
  const windows = buildWindowsFromChanges(changes, 10000);
  
  // Moneyline has 2 books (DK, MGM), spread has 1 book (filtered)
  const mlWindow = windows.find(w => w.marketType === 'moneyline');
  
  assert(mlWindow, 'Should have moneyline window');
  assert(Object.keys(mlWindow.changesByBook).length === 2, 'Moneyline window should have 2 books');
  
  console.log('✓ Test 3: Different market types create separate windows');
}

// Test 4: Timestamp ordering preserved in changesByBook
{
  const changes = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(3000) },
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(1000) },
    { event_id: 'EVT1', book: 'betmgm',     market_type: 'moneyline', side: 'home', created_at: new Date(2000) }
  ];
  
  const windows = buildWindowsFromChanges(changes, 10000);
  
  assert(windows.length === 1, 'Should have 1 window');
  const dkChanges = windows[0].changesByBook['draftkings'];
  assert(dkChanges.length === 2, 'DK should have 2 changes');
  assert(dkChanges[0].timestamp < dkChanges[1].timestamp, 'DK changes should be time-ordered');
  
  console.log('✓ Test 4: Changes within book are time-ordered');
}

// Test 5: Windows don't extend indefinitely (the bug we fixed)
// If windows extended, all changes would be in one giant window
{
  const changes = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(0) },
    { event_id: 'EVT1', book: 'betmgm',     market_type: 'moneyline', side: 'home', created_at: new Date(5000) },
    // This should be in window 2 since 12000 >= 0 + 10000
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(12000) },
    { event_id: 'EVT1', book: 'betmgm',     market_type: 'moneyline', side: 'home', created_at: new Date(14000) },
  ];
  
  const windows = buildWindowsFromChanges(changes, 10000);
  
  // Should be 2 windows: [0, 10000) and [10000, 20000) 
  // Note: window 2 starts at aligned boundary (10000 in this case based on first change in new window)
  assert(windows.length === 2, `Expected 2 separate windows, got ${windows.length}. FIXED: Windows no longer extend indefinitely.`);
  
  console.log('✓ Test 5: Windows are fixed-length, not extending (regression test for MAJOR bug 1.1)');
}

// Test 6: Input array not mutated
{
  const originalChanges = [
    { event_id: 'EVT1', book: 'draftkings', market_type: 'moneyline', side: 'home', created_at: new Date(3000) },
    { event_id: 'EVT1', book: 'betmgm',     market_type: 'moneyline', side: 'home', created_at: new Date(1000) }
  ];
  
  // Copy to check mutation
  const firstTimeBefore = originalChanges[0].created_at.getTime();
  
  buildWindowsFromChanges(originalChanges, 10000);
  
  // First element should still be the same (not sorted in place)
  assert(originalChanges[0].created_at.getTime() === firstTimeBefore, 'Input array should not be mutated');
  
  console.log('✓ Test 6: Input array not mutated (MEDIUM bug 2.6 fix)');
}

console.log('\n=== All windowBuilder tests passed! ===\n');
