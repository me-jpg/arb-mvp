/**
 * tests/metrics/runLatencyReportCli.test.js
 * 
 * Unit tests for latency report CLI.
 */

const assert = require('assert');
const { runLatencyReportCli } = require('../../src/metrics/run-latency-report');

console.log('=== Latency Report CLI Tests ===\\n');

/**
 * Helper: Capture console.log output
 */
function captureConsoleLog(fn) {
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };

    try {
        fn();
    } finally {
        console.log = originalLog;
    }

    return logs;
}

/**
 * Helper: Capture async console.log output
 */
async function captureConsoleLogAsync(fn) {
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };

    try {
        await fn();
    } finally {
        console.log = originalLog;
    }

    return logs;
}

/**
 * Test: JSON mode success
 */
{
    const options = { windowMinutes: 15, json: true };

    const deps = {
        config: {
            latencyMetrics: {
                windowMinutes: 20,
                minEventsPerBook: 25,
                maxBooks: 15
            }
        },
        dbFactory: async () => ({ close: async () => { } }),
        latencyAnalytics: {
            loadLatencyEvents: async () => [
                {
                    eventId: 'evt1',
                    marketType: 'moneyline',
                    firstBook: 'BookA',
                    laggingBooks: { 'BookB': 100 },
                    timestampMs: 1000000
                }
            ],
            computeCrossBookLatency: (events, opts) => ({
                books: {
                    BookB: { sampleCount: 30, avgLagMs: 100, p95LagMs: 250, maxLagMs: 500 }
                },
                global: {
                    windowMinutes: opts.windowMinutes,
                    totalEvents: events.length,
                    booksConsidered: ['BookB']
                }
            }),
            summarizeLatencyByBook: (stats, opts) => ({
                perBook: [
                    { book: 'BookB', sampleCount: 30, avgLagMs: 100, p95LagMs: 250, maxLagMs: 500 }
                ],
                global: {
                    windowMinutes: opts.windowMinutes || stats.global.windowMinutes,
                    totalEvents: stats.global.totalEvents,
                    booksConsidered: stats.global.booksConsidered
                }
            })
        }
    };

    (async () => {
        const logs = await captureConsoleLogAsync(async () => {
            const result = await runLatencyReportCli(options, deps);

            assert.strictEqual(result.windowMinutes, 15);
            assert.ok(result.summary);
            assert.strictEqual(result.summary.global.totalEvents, 1);
            assert.strictEqual(result.summary.perBook.length, 1);
            assert.strictEqual(result.summary.perBook[0].book, 'BookB');
        });

        // Verify JSON output
        assert.ok(logs.length > 0);
        const jsonOutput = JSON.parse(logs[0]);
        assert.ok(jsonOutput.latencySummary);
        assert.strictEqual(jsonOutput.latencySummary.global.totalEvents, 1);

        console.log('✓ JSON mode success: correct output and return value');
    })();
}

/**
 * Test: Pretty mode success
 */
setTimeout(async () => {
    const options = { windowMinutes: 10, json: false };

    const deps = {
        config: {
            latencyMetrics: {
                windowMinutes: 20,
                minEventsPerBook: 20,
                maxBooks: 15
            }
        },
        dbFactory: async () => ({ close: async () => { } }),
        latencyAnalytics: {
            loadLatencyEvents: async () => [],
            computeCrossBookLatency: (events, opts) => ({
                books: {
                    BookA: { sampleCount: 40, avgLagMs: 90, p95LagMs: 200, maxLagMs: 400 }
                },
                global: {
                    windowMinutes: opts.windowMinutes,
                    totalEvents: 42,
                    booksConsidered: ['BookA']
                }
            }),
            summarizeLatencyByBook: (stats, opts) => ({
                perBook: [
                    { book: 'BookA', sampleCount: 40, avgLagMs: 90, p95LagMs: 200, maxLagMs: 400 }
                ],
                global: {
                    windowMinutes: opts.windowMinutes || stats.global.windowMinutes,
                    totalEvents: 42,
                    booksConsidered: ['BookA']
                }
            })
        }
    };

    const logs = await captureConsoleLogAsync(async () => {
        const result = await runLatencyReportCli(options, deps);
        assert.strictEqual(result.windowMinutes, 10);
    });

    // Verify pretty output
    assert.ok(logs.some(line => line.includes('=== CROSS-BOOK LATENCY REPORT ===')));
    assert.ok(logs.some(line => line.includes('Window: 10 minutes')));
    assert.ok(logs.some(line => line.includes('Books (minEventsPerBook = 20)')));
    assert.ok(logs.some(line => line.includes('BookA:')));
    assert.ok(logs.some(line => line.includes('avg=90ms')));

    console.log('✓ Pretty mode success: human-readable output');
}, 100);

/**
 * Test: Default window from config
 */
setTimeout(async () => {
    const options = { windowMinutes: undefined, json: true };

    const deps = {
        config: {
            latencyMetrics: {
                windowMinutes: 25,
                minEventsPerBook: 15,
                maxBooks: 10
            }
        },
        dbFactory: async () => ({ close: async () => { } }),
        latencyAnalytics: {
            loadLatencyEvents: async (db, opts) => {
                assert.strictEqual(opts.windowMinutes, 25);
                return [];
            },
            computeCrossBookLatency: (events, opts) => ({
                books: {},
                global: {
                    windowMinutes: opts.windowMinutes,
                    totalEvents: 0,
                    booksConsidered: []
                }
            }),
            summarizeLatencyByBook: (stats, opts) => ({
                perBook: [],
                global: {
                    windowMinutes: opts.windowMinutes || stats.global.windowMinutes,
                    totalEvents: 0,
                    booksConsidered: []
                }
            })
        }
    };

    const logs = await captureConsoleLogAsync(async () => {
        const result = await runLatencyReportCli(options, deps);
        assert.strictEqual(result.windowMinutes, 25);
        assert.strictEqual(result.summary.global.windowMinutes, 25);
    });

    const jsonOutput = JSON.parse(logs[0]);
    assert.strictEqual(jsonOutput.latencySummary.global.windowMinutes, 25);

    console.log('✓ Default window from config: uses config value');
}, 200);

/**
 * Test: Error propagation
 */
setTimeout(async () => {
    const options = { windowMinutes: 15, json: false };

    const deps = {
        config: {
            latencyMetrics: {
                windowMinutes: 20,
                minEventsPerBook: 20,
                maxBooks: 15
            }
        },
        dbFactory: async () => ({ close: async () => { } }),
        latencyAnalytics: {
            loadLatencyEvents: async () => {
                throw new Error('Database connection failed');
            },
            computeCrossBookLatency: () => ({}),
            summarizeLatencyByBook: () => ({})
        }
    };

    try {
        await runLatencyReportCli(options, deps);
        assert.fail('Should have thrown error');
    } catch (err) {
        assert.strictEqual(err.message, 'Database connection failed');
        console.log('✓ Error propagation: throws errors correctly');
    }
}, 300);

/**
 * Test: Empty results (no books)
 */
setTimeout(async () => {
    const options = { windowMinutes: 5, json: false };

    const deps = {
        config: {
            latencyMetrics: {
                windowMinutes: 20,
                minEventsPerBook: 50,
                maxBooks: 15
            }
        },
        dbFactory: async () => ({ close: async () => { } }),
        latencyAnalytics: {
            loadLatencyEvents: async () => [],
            computeCrossBookLatency: (events, opts) => ({
                books: {},
                global: {
                    windowMinutes: opts.windowMinutes,
                    totalEvents: 0,
                    booksConsidered: []
                }
            }),
            summarizeLatencyByBook: (stats, opts) => ({
                perBook: [],
                global: stats.global
            })
        }
    };

    const logs = await captureConsoleLogAsync(async () => {
        const result = await runLatencyReportCli(options, deps);
        assert.strictEqual(result.summary.perBook.length, 0);
    });

    assert.ok(logs.some(line => line.includes('(no books with sufficient samples)')));

    console.log('✓ Empty results: handles gracefully');
}, 400);

setTimeout(() => {
    console.log('\\n=== All latency report CLI tests passed ===\\n');
}, 500);
