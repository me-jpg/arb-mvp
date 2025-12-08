/**
 * src/risk/riskSnapshotLogger.js
 * 
 * Helper to capture and log periodic risk snapshots.
 */

const fs = require('fs');
const path = require('path');
const { getBankrollConfig } = require('./bankrollConfig');
const { getCurrentExposure, getDayLoss } = require('./riskState');

const LOG_DIR = path.join(process.cwd(), 'logs', 'risk');
const LOG_FILE = path.join(LOG_DIR, 'risk-snapshots.jsonl');

/**
 * Captures the current risk state and appends it to the JSONL log.
 * @param {Object} context - Optional metadata (e.g., source: 'simulation')
 * @returns {Object|null} The snapshot object, or null if failed.
 */
function captureRiskSnapshot(context = {}) {
    try {
        // Ensure dirt exists
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        const config = getBankrollConfig();
        const exposure = getCurrentExposure();
        const dayLoss = getDayLoss();

        const snapshot = {
            takenAt: new Date().toISOString(),
            bankroll: config.initialBankroll, // Or dynamic if updated
            exposure: {
                total: exposure.openExposureTotal,
                byBook: exposure.byBook,
                byEvent: exposure.byEvent,
                byMarketType: exposure.byMarketType
            },
            currentDayLoss: dayLoss,
            mode: config.riskMode,
            source: context.source || 'unknown',
            notes: context.notes || []
        };

        fs.appendFileSync(LOG_FILE, JSON.stringify(snapshot) + '\n');

        return snapshot;
    } catch (err) {
        console.error('Failed to capture risk snapshot:', err.message);
        return null;
    }
}

module.exports = {
    captureRiskSnapshot,
    LOG_FILE // exposed for tools/tests
};
