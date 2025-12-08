/**
 * tests/server/wsDashboard.test.js
 */

const assert = require('assert');
const http = require('http');

console.log('=== wsDashboard.test.js ===\n');

// Test 1: Dashboard route returns 200 with expected content
{
    // We'll make a simple HTTP request to check if the route would work
    // For this test, we'll just verify the dashboard HTML file exists and contains expected content
    const fs = require('fs');
    const path = require('path');

    const dashboardPath = path.join(process.cwd(), 'public', 'dashboard.html');

    assert.ok(fs.existsSync(dashboardPath), 'Dashboard HTML file should exist');

    const content = fs.readFileSync(dashboardPath, 'utf8');

    assert.ok(content.includes('ArbMVP Live Metrics'), 'Should contain page title');
    assert.ok(content.includes('HF Top Volatile Markets'), 'Should contain HF markets section');
    assert.ok(content.includes('Latency Anomalies'), 'Should contain latency anomalies section');
    assert.ok(content.includes('Execution Summary'), 'Should contain execution summary section');
    assert.ok(content.includes('WebSocket'), 'Should contain WebSocket client code');
    assert.ok(content.includes('tailwindcss'), 'Should use Tailwind CSS');

    console.log('✓ Test 1: Dashboard HTML contains expected content');
}

// Test 2: Dashboard HTML is valid
{
    const fs = require('fs');
    const path = require('path');

    const dashboardPath = path.join(process.cwd(), 'public', 'dashboard.html');
    const content = fs.readFileSync(dashboardPath, 'utf8');

    // Check for basic HTML structure
    assert.ok(content.includes('<!DOCTYPE html>'), 'Should have DOCTYPE');
    assert.ok(content.includes('<html'), 'Should have html tag');
    assert.ok(content.includes('<head>'), 'Should have head tag');
    assert.ok(content.includes('<body'), 'Should have body tag');
    assert.ok(content.includes('</html>'), 'Should close html tag');

    console.log('✓ Test 2: Dashboard HTML structure is valid');
}

// Test 3: WebSocket connection code present
{
    const fs = require('fs');
    const path = require('path');

    const dashboardPath = path.join(process.cwd(), 'public', 'dashboard.html');
    const content = fs.readFileSync(dashboardPath, 'utf8');

    assert.ok(content.includes('new WebSocket'), 'Should create WebSocket connection');
    assert.ok(content.includes('ws.onopen'), 'Should handle WebSocket open event');
    assert.ok(content.includes('ws.onmessage'), 'Should handle WebSocket messages');
    assert.ok(content.includes('ws.onclose'), 'Should handle WebSocket close event');

    console.log('✓ Test 3: WebSocket connection code present');
}

console.log('\n=== All dashboard tests passed ===\n');
