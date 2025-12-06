// src/risk/bankrollConfig.js
// Load bankroll config from env + config.js

const config = require('../../config');

function getBankrollConfig() {
  return {
    initialBankroll: parseFloat(process.env.RISK_INITIAL_BANKROLL || '10000'),
    targetBankroll: parseFloat(process.env.RISK_TARGET_BANKROLL || '10000'),
    maxStakePctPerOrder: parseFloat(process.env.RISK_MAX_STAKE_PCT || '2') / 100,
    maxExposurePctPerEvent: parseFloat(process.env.RISK_MAX_EVENT_EXPOSURE_PCT || '10') / 100,
    maxDailyLossPct: parseFloat(process.env.RISK_MAX_DAILY_LOSS_PCT || '10') / 100,
    maxExposurePctPerBook: parseFloat(process.env.RISK_MAX_BOOK_EXPOSURE_PCT || '20') / 100,
    perBookCaps: config.execution?.perBookCaps || {},
    riskMode: process.env.RISK_MODE || 'normal'
  };
}

module.exports = {
  getBankrollConfig
};

