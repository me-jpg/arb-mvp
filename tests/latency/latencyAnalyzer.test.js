// tests/latency/latencyAnalyzer.test.js
// Synthetic tests for latencyAnalyzer

const { computeLatencyMetrics } = require('../../src/latency/latencyAnalyzer');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

console.log('=== latencyAnalyzer.test.js ===\n');

// Test 1: DraftKings is fastest in most windows
{
  const windows = [
    // Window 1: DK moves at t=1000, MGM at t=2000, ESPN at t=2500
    {
      eventId: 'EVT1',
      marketType: 'moneyline',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 1000 }],
        'betmgm': [{ timestamp: 2000 }],
        'espnbet': [{ timestamp: 2500 }]
      }
    },
    // Window 2: DK moves at t=5000, MGM at t=5500
    {
      eventId: 'EVT1',
      marketType: 'spread',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 5000 }],
        'betmgm': [{ timestamp: 5500 }]
      }
    },
    // Window 3: MGM moves first this time
    {
      eventId: 'EVT2',
      marketType: 'moneyline',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 10500 }],
        'betmgm': [{ timestamp: 10000 }]
      }
    }
  ];
  
  const metrics = computeLatencyMetrics(windows);
  
  const dk = metrics.find(m => m.book === 'draftkings');
  const mgm = metrics.find(m => m.book === 'betmgm');
  const espn = metrics.find(m => m.book === 'espnbet');
  
  assert(dk, 'Should have DraftKings metrics');
  assert(mgm, 'Should have BetMGM metrics');
  assert(espn, 'Should have ESPN metrics');
  
  // DK was first in 2/3 windows
  assert(dk.fractionFirstToMove > 0.6, `DK fractionFirstToMove should be > 0.6, got ${dk.fractionFirstToMove}`);
  
  // MGM was first in 1/3 windows
  assert(mgm.fractionFirstToMove > 0.3, `MGM fractionFirstToMove should be > 0.3, got ${mgm.fractionFirstToMove}`);
  
  console.log('✓ Test 1: fractionFirstToMove correctly identifies fast books');
  console.log(`   DK: ${(dk.fractionFirstToMove * 100).toFixed(0)}% first | MGM: ${(mgm.fractionFirstToMove * 100).toFixed(0)}% first`);
}

// Test 2: Average delay calculation
{
  const windows = [
    // DK at t=0, MGM at t=500, ESPN at t=1000
    {
      eventId: 'EVT1',
      marketType: 'moneyline',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 0 }],
        'betmgm': [{ timestamp: 500 }],
        'espnbet': [{ timestamp: 1000 }]
      }
    },
    // DK at t=5000, MGM at t=5600
    {
      eventId: 'EVT1',
      marketType: 'spread',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 5000 }],
        'betmgm': [{ timestamp: 5600 }]
      }
    }
  ];
  
  const metrics = computeLatencyMetrics(windows);
  
  const dk = metrics.find(m => m.book === 'draftkings');
  const mgm = metrics.find(m => m.book === 'betmgm');
  const espn = metrics.find(m => m.book === 'espnbet');
  
  // DK was always first, so avgDelay should be 0
  assert(dk.avgDelayMsVsFastest === 0, `DK delay should be 0, got ${dk.avgDelayMsVsFastest}`);
  
  // MGM delays: 500ms in window 1, 600ms in window 2 → avg 550ms
  assert(mgm.avgDelayMsVsFastest === 550, `MGM avgDelay should be 550, got ${mgm.avgDelayMsVsFastest}`);
  
  // ESPN delay: only in 1 window, 1000ms
  assert(espn.avgDelayMsVsFastest === 1000, `ESPN avgDelay should be 1000, got ${espn.avgDelayMsVsFastest}`);
  
  console.log('✓ Test 2: avgDelayMsVsFastest calculated correctly');
  console.log(`   DK: ${dk.avgDelayMsVsFastest}ms | MGM: ${mgm.avgDelayMsVsFastest}ms | ESPN: ${espn.avgDelayMsVsFastest}ms`);
}

// Test 3: fractionLastToMove identifies lagging books
{
  const windows = [
    // ESPN is last in both windows
    {
      eventId: 'EVT1',
      marketType: 'moneyline',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 1000 }],
        'betmgm': [{ timestamp: 1200 }],
        'espnbet': [{ timestamp: 2000 }]
      }
    },
    {
      eventId: 'EVT2',
      marketType: 'moneyline',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 5000 }],
        'betmgm': [{ timestamp: 5100 }],
        'espnbet': [{ timestamp: 6000 }]
      }
    }
  ];
  
  const metrics = computeLatencyMetrics(windows);
  
  const espn = metrics.find(m => m.book === 'espnbet');
  
  // ESPN was last in both windows
  assert(espn.fractionLastToMove === 1.0, `ESPN fractionLastToMove should be 1.0, got ${espn.fractionLastToMove}`);
  
  console.log('✓ Test 3: fractionLastToMove correctly identifies lagging books');
  console.log(`   ESPN fractionLastToMove: ${(espn.fractionLastToMove * 100).toFixed(0)}%`);
}

// Test 4: Market breakdown tracking
{
  const windows = [
    {
      eventId: 'EVT1',
      marketType: 'moneyline',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 1000 }],
        'betmgm': [{ timestamp: 2000 }]
      }
    },
    {
      eventId: 'EVT1',
      marketType: 'spread',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 5000 }],
        'betmgm': [{ timestamp: 4500 }] // MGM faster on spread
      }
    }
  ];
  
  const metrics = computeLatencyMetrics(windows);
  
  const dk = metrics.find(m => m.book === 'draftkings');
  
  assert(dk.marketBreakdown['moneyline'], 'DK should have moneyline breakdown');
  assert(dk.marketBreakdown['spread'], 'DK should have spread breakdown');
  assert(dk.marketBreakdown['moneyline'].firstMoverCount === 1, 'DK first on moneyline');
  assert(dk.marketBreakdown['spread'].firstMoverCount === 0, 'DK not first on spread');
  
  console.log('✓ Test 4: Market breakdown tracked correctly');
}

// Test 5: Single-book windows are excluded
{
  const windows = [
    {
      eventId: 'EVT1',
      marketType: 'moneyline',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 1000 }]
        // Only one book - should be skipped
      }
    },
    {
      eventId: 'EVT2',
      marketType: 'moneyline',
      side: 'home',
      changesByBook: {
        'draftkings': [{ timestamp: 5000 }],
        'betmgm': [{ timestamp: 5500 }]
      }
    }
  ];
  
  const metrics = computeLatencyMetrics(windows);
  
  const dk = metrics.find(m => m.book === 'draftkings');
  
  // Only 1 window should be counted (the one with 2 books)
  assert(dk.totalWindows === 1, `DK totalWindows should be 1, got ${dk.totalWindows}`);
  
  console.log('✓ Test 5: Single-book windows correctly excluded');
}

console.log('\n=== All latencyAnalyzer tests passed! ===\n');



