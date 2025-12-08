/**
 * src/execution/arbExposureAnalyzer.js
 * 
 * Offline analyzer for arb pairs and unhedged exposure.
 * Read-only analysis of execution logs and signals.
 */

/**
 * Build arb groups and pairs from signals.
 * @param {Array<Object>} signals - Signal array
 * @returns {Object} Groups with pairs
 */
function buildArbGroupsFromSignals(signals = []) {
    const groups = {};

    for (const signal of signals) {
        // Derive groupId from signal metadata or fallback to constructed ID
        let groupId = signal.metadata?.arbGroupId || signal.arbGroupId;

        if (!groupId) {
            // Fallback: construct from eventId + marketType + line
            const eventId = signal.eventId || 'unknown';
            const marketType = signal.marketType || 'unknown';
            const line = signal.metadata?.line || signal.metadata?.total || signal.metadata?.spread || signal.line || '';
            groupId = `${eventId}_${marketType}_${line}`;
        }

        if (!groups[groupId]) {
            groups[groupId] = {
                groupId,
                eventId: signal.eventId,
                marketType: signal.marketType,
                line: signal.metadata?.line || signal.metadata?.total || signal.metadata?.spread || signal.line,
                signals: [],
                pairs: []
            };
        }

        groups[groupId].signals.push(signal);
    }

    // Form pairs within each group
    for (const group of Object.values(groups)) {
        const signalsByBook = {};

        // Group by book
        for (const sig of group.signals) {
            const book = sig.book;
            if (!signalsByBook[book]) {
                signalsByBook[book] = [];
            }
            signalsByBook[book].push(sig);
        }

        // Try to pair signals across different books with opposite sides
        const books = Object.keys(signalsByBook);
        const paired = new Set();

        for (let i = 0; i < books.length; i++) {
            for (let j = i + 1; j < books.length; j++) {
                const book1 = books[i];
                const book2 = books[j];

                for (const sig1 of signalsByBook[book1]) {
                    if (paired.has(sig1.signalId)) continue;

                    for (const sig2 of signalsByBook[book2]) {
                        if (paired.has(sig2.signalId)) continue;

                        // Check if they're opposite sides
                        const side1 = sig1.betSide || sig1.metadata?.betSide;
                        const side2 = sig2.betSide || sig2.metadata?.betSide;

                        const areOpposite = (
                            (side1 === 'home' && side2 === 'away') ||
                            (side1 === 'away' && side2 === 'home') ||
                            (side1 === 'over' && side2 === 'under') ||
                            (side1 === 'under' && side2 === 'over')
                        );

                        if (areOpposite) {
                            group.pairs.push({
                                id: `${sig1.signalId}_${sig2.signalId}`,
                                legs: [sig1, sig2]
                            });
                            paired.add(sig1.signalId);
                            paired.add(sig2.signalId);
                            break;
                        }
                    }
                }
            }
        }
    }

    return { groups };
}

/**
 * Analyze arb exposure from signals and execution events.
 * @param {Object} params
 * @param {Array<Object>} params.signals - Signals
 * @param {Array<Object>} params.executionEvents - Execution events
 * @returns {Object} Exposure analysis summary
 */
function analyzeArbExposure({ signals = [], executionEvents = [] } = {}) {
    // Build arb groups
    const { groups } = buildArbGroupsFromSignals(signals);

    // Map execution events by source signal ID
    const execBySignal = {};
    for (const event of executionEvents) {
        const signalId = event.sourceSignalId || event.signalId;
        if (signalId) {
            if (!execBySignal[signalId]) {
                execBySignal[signalId] = [];
            }
            execBySignal[signalId].push(event);
        }
    }

    // Analyze each pair
    let fullyHedged = 0;
    let unhedgedSingleLeg = 0;
    let noFill = 0;
    let totalUnhedgedExposure = 0;
    const byBook = {};
    const worstUnhedged = [];

    for (const group of Object.values(groups)) {
        for (const pair of group.pairs) {
            const legStatuses = [];

            for (const leg of pair.legs) {
                const events = execBySignal[leg.signalId] || [];
                let status = 'no_exec';
                let filledStake = 0;
                let book = leg.book;

                for (const event of events) {
                    if (event.status === 'filled' || event.orderStatus === 'filled') {
                        status = 'filled';
                        filledStake += event.filledStake || event.stake || 0;
                    } else if (event.status === 'partial' || event.orderStatus === 'partial') {
                        status = 'partial';
                        filledStake += event.filledStake || 0;
                    } else if (event.status === 'rejected' || event.orderStatus === 'rejected') {
                        status = 'rejected';
                    } else if (event.status === 'blocked' || event.orderStatus === 'blocked') {
                        status = 'blocked';
                    }
                }

                legStatuses.push({ book, status, filledStake });
            }

            // Classify pair
            const filledLegs = legStatuses.filter(l => l.status === 'filled' || l.status === 'partial');

            if (filledLegs.length >= 2) {
                // Fully hedged
                fullyHedged++;
                for (const leg of filledLegs) {
                    if (!byBook[leg.book]) {
                        byBook[leg.book] = { fullyHedgedPairs: 0, unhedgedPairs: 0, unhedgedExposure: 0 };
                    }
                    byBook[leg.book].fullyHedgedPairs++;
                }
            } else if (filledLegs.length === 1) {
                // Unhedged single leg
                unhedgedSingleLeg++;
                const exposure = filledLegs[0].filledStake;
                totalUnhedgedExposure += exposure;

                const book = filledLegs[0].book;
                if (!byBook[book]) {
                    byBook[book] = { fullyHedgedPairs: 0, unhedgedPairs: 0, unhedgedExposure: 0 };
                }
                byBook[book].unhedgedPairs++;
                byBook[book].unhedgedExposure += exposure;

                worstUnhedged.push({
                    groupId: group.groupId,
                    eventId: group.eventId,
                    marketType: group.marketType,
                    line: group.line,
                    books: [book],
                    exposure
                });
            } else {
                // No fill
                noFill++;
            }
        }
    }

    // Sort worst unhedged by exposure
    worstUnhedged.sort((a, b) => b.exposure - a.exposure);

    return {
        totals: {
            groups: Object.keys(groups).length,
            pairs: Object.values(groups).reduce((sum, g) => sum + g.pairs.length, 0),
            fullyHedged,
            unhedgedSingleLeg,
            noFill,
            totalUnhedgedExposure
        },
        byBook,
        worstUnhedged: worstUnhedged.slice(0, 10)
    };
}

module.exports = {
    buildArbGroupsFromSignals,
    analyzeArbExposure
};
