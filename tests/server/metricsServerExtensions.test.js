/**
 * tests/server/metricsServerExtensions.test.js
 * 
 * Verifies the new /api/latency endpoints in metricsServer.js.
 * We spin up the server in a child process (or import if exportable) and make HTTP requests.
 * Given existing pattern in repo, we'll try to require it if it exports a server or handler.
 * 
 * NOTE: metricsServer.js runs automatically when required if not guarded?
 * Inspecting file: line 260 `server.listen(...)` is at top level.
 * So importing it will start the server. We should probably start it in a child process to avoid port conflicts or hanging tests.
 */

const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');

const TEST_PORT = 8799; // Different from default 8788
const SERVER_PATH = 'src/server/metricsServer.js';

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${TEST_PORT}${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // If 200, return generic object with status and parsed JSON
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, raw: data, error: e });
                }
            });
        }).on('error', reject);
    });
}

async function runTests() {
    console.log('=== metricsServerExtensions.test.js ===');

    // 1. Start Server
    const env = { ...process.env, METRICS_PORT: TEST_PORT.toString() };
    console.log(`Starting server on port ${TEST_PORT}...`);

    const serverProc = spawn('node', [SERVER_PATH], { env, stdio: 'pipe' });

    // Wait for server to start (simple timeout)
    await new Promise(r => setTimeout(r, 2000));

    let failed = false;

    try {
        // Test 1: Health (Baseline)
        {
            const res = await makeRequest('/api/health');
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.data.status, 'ok');
            console.log('✓ Health Check passed');
        }

        // Test 2: Latency Summary
        {
            const res = await makeRequest('/api/latency/summary');
            assert.strictEqual(res.statusCode, 200);
            assert(res.data.latencySummary, 'Missing latencySummary field');
            assert(res.data.latencySummary.totalLineChangeEvents, 'Missing totalLineChangeEvents');
            console.log('✓ Latency Summary endpoint structure verified');
        }

        // Test 3: Book Latency
        {
            // We assume logs exist (or handle empty gracefully)
            const res = await makeRequest('/api/latency/books?limit=100');
            assert.strictEqual(res.statusCode, 200);
            assert(res.data.bookLatency, 'Missing bookLatency field');
            assert(res.data.bookLatency.byBook, 'Missing byBook field');
            // Even if empty, structure should match
            console.log('✓ Book Latency endpoint structure verified');
        }

        // Test 4: Book Filter
        {
            const res = await makeRequest('/api/latency/books?limit=100&books=unknown_book');
            assert.strictEqual(res.statusCode, 200);
            // specific check: totalSamples should be 0 because we filtered for a non-existent book
            assert.strictEqual(res.data.bookLatency.totalSamples, 0);
            console.log('✓ Book Filter verified');
        }

    } catch (err) {
        console.error('FAIL:', err);
        failed = true;
    } finally {
        // Cleanup
        serverProc.kill();
        if (failed) process.exit(1);
        console.log('\n=== All metrics tests passed ===\n');
    }
}

runTests();
