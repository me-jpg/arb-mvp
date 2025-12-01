// tests/run-all-tests.js
// Master test runner for Phase 1

const { spawn } = require('child_process');
const path = require('path');

const tests = [
  {
    name: 'Market Normalization',
    file: 'test-market-normalization.js',
    description: 'Tests market type, spread, and total normalization'
  },
  {
    name: 'Multi-Market Matching',
    file: 'test-multimarket-matching.js',
    description: 'Tests event matching with multiple markets'
  },
  {
    name: 'DraftKings Multi-Market',
    file: 'test-dk-multimarket.js',
    description: 'Tests DraftKings scraper (ML + Spread + Total)'
  },
  {
    name: 'FanDuel Multi-Market',
    file: 'test-fd-multimarket.js',
    description: 'Tests FanDuel scraper (ML + Spread + Total)'
  }
];

let currentTest = 0;
const results = [];

console.log('\n' + '═'.repeat(70));
console.log('🧪 PHASE 1 TEST SUITE - RUNNING ALL TESTS');
console.log('═'.repeat(70));
console.log(`\nTotal tests to run: ${tests.length}\n`);

function runTest(index) {
  if (index >= tests.length) {
    printSummary();
    return;
  }

  const test = tests[index];
  console.log('─'.repeat(70));
  console.log(`📋 Test ${index + 1}/${tests.length}: ${test.name}`);
  console.log(`   ${test.description}`);
  console.log('─'.repeat(70));

  const testPath = path.join(__dirname, test.file);
  const proc = spawn('node', [testPath], {
    stdio: 'inherit',
    shell: true
  });

  const startTime = Date.now();

  proc.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    results.push({
      name: test.name,
      passed: code === 0,
      duration
    });

    if (code === 0) {
      console.log(`\n✅ Test completed in ${duration}s\n`);
    } else {
      console.log(`\n❌ Test failed after ${duration}s\n`);
    }

    // Run next test
    runTest(index + 1);
  });

  proc.on('error', (error) => {
    console.error(`\n❌ Error running test: ${error.message}\n`);
    results.push({
      name: test.name,
      passed: false,
      duration: '0'
    });
    runTest(index + 1);
  });
}

function printSummary() {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 FINAL TEST SUMMARY');
  console.log('═'.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n📋 Individual Test Results:');
  results.forEach((result, idx) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`   ${icon} ${idx + 1}. ${result.name} (${result.duration}s)`);
  });

  console.log('\n📊 Overall Statistics:');
  console.log(`   Total tests: ${results.length}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Success rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Phase 1 implementation is working correctly.');
    console.log('\nNext steps:');
    console.log('1. Run the full system: npm start');
    console.log('2. Monitor for 24 hours');
    console.log('3. Track arbitrages detected');
    console.log('4. Verify 0% false positive rate');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED');
    console.log('Review the output above for details on failed tests.');
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(result => {
      console.log(`   ❌ ${result.name}`);
    });
  }

  console.log('\n' + '═'.repeat(70) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

// Start running tests
runTest(0);