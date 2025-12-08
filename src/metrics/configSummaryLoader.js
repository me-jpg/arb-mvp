/**
 * src/metrics/configSummaryLoader.js
 * 
 * Load current config summary for introspection (ML, stake sizing, risk, HF).
 */

const config = require('../../config');

/**
 * Load config summary (read-only introspection).
 */
function loadConfigSummary() {
    const mlScoring = config.mlScoring || {};
    const mlModel = config.mlModel || {};
    const stakeSizing = config.stakeSizing || {};
    const execution = config.execution || {};
    const hf = config.highfreq || config.hf || {};

    // Try to load bankroll config
    let bankroll = null;
    try {
        const { getBankrollConfig } = require('../risk/bankrollConfig');
        if (typeof getBankrollConfig === 'function') {
            bankroll = getBankrollConfig();
        }
    } catch (err) {
        // Bankroll config not available
    }

    const riskCaps = bankroll ? {
        maxStakePctPerOrder: bankroll.maxStakePctPerOrder ?? null,
        maxExposurePctPerEvent: bankroll.maxExposurePctPerEvent ?? null,
        maxExposurePctPerBook: bankroll.maxExposurePctPerBook ?? null,
        maxDailyLossPct: bankroll.maxDailyLossPct ?? null,
        mode: bankroll.riskMode || 'normal'
    } : {
        maxStakePctPerOrder: null,
        maxExposurePctPerEvent: null,
        maxExposurePctPerBook: null,
        maxDailyLossPct: null,
        mode: 'unknown'
    };

    return {
        mlScoring: {
            enabled: !!mlScoring.enabled,
            mode: mlScoring.mode || null,
            minScore: Number.isFinite(mlScoring.minScore) ? mlScoring.minScore : null
        },
        mlModel: {
            enabled: !!mlModel.enabled,
            mode: mlModel.mode || null,
            modelPath: mlModel.modelPath || null
        },
        stakeSizing: {
            mode: stakeSizing.mode || null,
            flatStake: stakeSizing.flatStake ?? null,
            kellyBaseFraction: stakeSizing.kellyBaseFraction ?? null,
            maxStakePctBankroll: stakeSizing.maxStakePctBankroll ?? null,
            minStake: stakeSizing.minStake ?? null
        },
        execution: {
            defaultStake: execution.defaultStake ?? null,
            simSlippageBps: execution.simSlippageBps ?? null,
            simRejectProb: execution.simRejectProb ?? null
        },
        hf: {
            enabledBooks: hf.books || hf.enabledBooks || null,
            maxEvents: hf.maxEvents ?? null,
            intervalMs: hf.intervalMs || hf.interval || null
        },
        riskCaps
    };
}

module.exports = {
    loadConfigSummary
};
