// config.js
// Configuration for ARB MVP - 4 Book System

const CONFIG = {
  // Arbitrage detection settings
  minProfitMargin: 0.5,  // ⬅️ CHANGED from 1.5 to 0.5 to catch smaller arbitrages
  totalStake: 1000,

  // Scraping settings
  scrapeInterval: 60,     // seconds between cycles
  headless: true,         // run browsers in headless mode
  staleThreshold: 120,    // seconds - lines older than this are considered stale (2 minutes)

  // Log file paths
  logs: {
    lineChanges: 'logs/line-changes.jsonl',
    latencyMetrics: 'logs/latency-metrics.jsonl'
  },

  // Book URLs (for reference)
  books: {
    draftkings: 'https://sportsbook.draftkings.com/leagues/football/nfl',
    betmgm: 'https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35',
    espnbet: 'https://espnbet.com/sport/american-football/organization/usa/competition/nfl'
  },

  // Execution settings
  execution: {
    enabled: true,
    dryRun: false,
    logTelemetry: true,
    healthAdvisory: {
      enforcementMode: 'ignore'  // 'ignore' | 'log' | 'halt'
    },
    defaultStake: parseFloat(process.env.EXECUTION_DEFAULT_STAKE || '50'),
    simSlippageBps: parseFloat(process.env.EXECUTION_SIM_SLIPPAGE_BPS || '0'),
    simRejectProb: parseFloat(process.env.EXECUTION_SIM_REJECT_PROB || '0'),
    risk: {
      bankroll: 10000,
      baseUnit: 10,
      kellyFraction: 0.25,
      minStake: 5,
      maxStake: 500,
      caps: {
        maxPerBet: 1000,
        maxPerBookExposure: 5000,
        maxDailyLoss: 2000
      }
    },
    retry: {
      maxAttempts: 1,
      baseDelayMs: 100,
      maxDelayMs: 2000,
      backoffFactor: 2,
      retryableErrorCodes: ['NETWORK_ERROR', 'TIMEOUT'],
      retryableFailureReasons: ['transient', 'unknown']
    },
    idempotency: {
      enabled: true,
      lookbackWindowMs: 5 * 60 * 1000 // 5 minutes
    },
    arbExecution: {
      strategy: 'sequential_conservative',
      maxLegsPerArb: 4
    },
    hedging: {
      enabled: false,                  // default: no hedging (backward compatible)
      mode: 'flatten_exposure',        // v1 only
      maxHedgeFraction: 1.0,           // hedge up to 100% of filledStake
      executeHedges: false             // default: compute-only, no execution
    },
    latencyGuard: {
      enabled: false,                  // default: NO-OP (backward compatible)
      maxLegAgeMs: 2000,               // maximum age for any leg (in ms)
      maxSkewBetweenLegsMs: 1500,      // max allowed difference between freshest and stalest leg
      action: 'skip'                   // 'skip' | 'warn_only'
    },
    mode: 'simulation',  // 'simulation' | 'paper' | 'live' - default to simulation for safety
    safety: {
      requireHealthAdvisoryIgnoreOrLog: true,
      requireIdempotencyEnabled: true,
      requireRiskCapsEnabled: true
    }
  },

  // Alert settings
  discord: {
    enabled: true,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL
  },

  sheets: {
    enabled: false,  // Disabled for now
    spreadsheetId: process.env.SPREADSHEET_ID
  },

  // Database configuration
  database: {
    enabled: process.env.DB_ENABLED === 'true' || false,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'arbitrage_db'
  },

  // Path to Google service account credentials JSON file
  sheetsCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-credentials.json',

  // Risk management
  risk: {
    maxExposurePerBook: 5000,
    maxDailyLoss: 1000,
    enableRiskChecks: true
  },

  // Stake sizing config
  stakeSizing: {
    mode: process.env.STAKE_SIZING_MODE || 'kelly',
    kellyFraction: parseFloat(process.env.KELLY_FRACTION || '0.25'),
    minStake: parseFloat(process.env.MIN_STAKE || '10'),
    maxStake: parseFloat(process.env.MAX_STAKE || '500')
  },

  // ML Model (Linear Model Support)
  mlModel: {
    enabled: process.env.ML_MODEL_ENABLED === '1',
    mode: process.env.ML_MODEL_MODE || 'none', // none | linear
    modelPath: process.env.ML_MODEL_PATH || 'models/linear-model.json'
  }
};

function getStakeSizingConfig() {
  return CONFIG.stakeSizing;
}

function getExecutionHealthAdvisoryMode(config = CONFIG) {
  return config?.execution?.healthAdvisory?.enforcementMode || 'ignore';
}

function getExecutionRiskConfig(config = CONFIG) {
  const risk = config?.execution?.risk;
  if (!risk) {
    return {
      bankroll: 10000,
      baseUnit: 10,
      kellyFraction: 0.25,
      minStake: 5,
      maxStake: 500,
      caps: { maxPerBet: 1000 }
    };
  }
  return {
    bankroll: risk.bankroll || 10000,
    baseUnit: risk.baseUnit || 10,
    kellyFraction: risk.kellyFraction || 0.25,
    minStake: risk.minStake,
    maxStake: risk.maxStake,
    caps: risk.caps || {}
  };
}

function getExecutionRetryConfig(config = CONFIG) {
  const retry = config?.execution?.retry;
  if (!retry) {
    return {
      maxAttempts: 1,
      baseDelayMs: 100,
      maxDelayMs: 2000,
      backoffFactor: 2,
      retryableErrorCodes: ['NETWORK_ERROR', 'TIMEOUT'],
      retryableFailureReasons: ['transient', 'unknown']
    };
  }
  return {
    maxAttempts: retry.maxAttempts !== undefined ? retry.maxAttempts : 1,
    baseDelayMs: retry.baseDelayMs !== undefined ? retry.baseDelayMs : 100,
    maxDelayMs: retry.maxDelayMs !== undefined ? retry.maxDelayMs : 2000,
    backoffFactor: retry.backoffFactor !== undefined ? retry.backoffFactor : 2,
    retryableErrorCodes: retry.retryableErrorCodes || ['NETWORK_ERROR', 'TIMEOUT'],
    retryableFailureReasons: retry.retryableFailureReasons || ['transient', 'unknown']
  };
}

/**
 * Get execution idempotency configuration with defaults.
 * @param {Object} config - Full config object
 * @returns {Object} Idempotency config with defaults
 */
function getExecutionIdempotencyConfig(config = CONFIG) {
  const idempotency = config?.execution?.idempotency;
  if (!idempotency) {
    return {
      enabled: true,
      lookbackWindowMs: 5 * 60 * 1000
    };
  }
  return {
    enabled: idempotency.enabled !== undefined ? idempotency.enabled : true,
    lookbackWindowMs: idempotency.lookbackWindowMs !== undefined ? idempotency.lookbackWindowMs : 5 * 60 * 1000
  };
}

/**
 * Get arb execution configuration with defaults.
 * @param {Object} config - Full config object
 * @returns {Object} Arb execution config with defaults
 */
function getArbExecutionConfig(config = CONFIG) {
  const execCfg = (config && config.execution) || {};
  const arbCfg = execCfg.arbExecution || {};
  return {
    strategy: arbCfg.strategy || 'sequential_conservative',
    maxLegsPerArb: typeof arbCfg.maxLegsPerArb === 'number' ? arbCfg.maxLegsPerArb : 4
  };
}

/**
 * Get execution hedging configuration with defaults.
 * @param {Object} config - Full config object
 * @returns {Object} Hedging config with defaults
 */
function getExecutionHedgingConfig(config = CONFIG) {
  const execCfg = (config && config.execution) || {};
  const h = execCfg.hedging || {};
  return {
    enabled: !!h.enabled,
    mode: h.mode || 'flatten_exposure',
    maxHedgeFraction: typeof h.maxHedgeFraction === 'number' ? h.maxHedgeFraction : 1.0,
    executeHedges: !!h.executeHedges
  };
}

/**
 * Get execution mode configuration with defaults.
 * @param {Object} config - Full config object
 * @returns {Object} Mode config with defaults
 */
function getExecutionModeConfig(config = CONFIG) {
  const execCfg = (config && config.execution) || {};
  const safety = execCfg.safety || {};
  return {
    mode: execCfg.mode || 'simulation',
    safety: {
      requireHealthAdvisoryIgnoreOrLog: safety.requireHealthAdvisoryIgnoreOrLog !== false,
      requireIdempotencyEnabled: safety.requireIdempotencyEnabled !== false,
      requireRiskCapsEnabled: safety.requireRiskCapsEnabled !== false
    }
  };
}

/**
 * Get execution latency guard configuration with defaults.
 * @param {Object} config - Full config object
 * @returns {Object} Latency guard config with defaults
 */
function getExecutionLatencyGuardConfig(config = CONFIG) {
  const execCfg = (config && config.execution) || {};
  const lg = execCfg.latencyGuard || {};
  return {
    enabled: !!lg.enabled,
    maxLegAgeMs: typeof lg.maxLegAgeMs === 'number' ? lg.maxLegAgeMs : 2000,
    maxSkewBetweenLegsMs: typeof lg.maxSkewBetweenLegsMs === 'number' ? lg.maxSkewBetweenLegsMs : 1500,
    action: lg.action || 'skip'
  };
}

/**
 * Get execution profile configuration merged with base config.
 * @param {Object} baseConfig - Base configuration object
 * @param {string} profileName - Profile name to apply
 * @returns {Object} Merged configuration
 */
function getExecutionProfileConfig(baseConfig, profileName) {
  const profiles = DEFAULT_EXECUTION_PROFILES;
  const profile = profiles[profileName];

  if (!profile) {
    // Unknown profile: return baseConfig unchanged
    return baseConfig || {};
  }

  // Shallow merge: profile.execution overrides baseConfig.execution
  const cfg = baseConfig || {};
  const mergedExecution = Object.assign(
    {},
    cfg.execution || {},
    profile.execution || {}
  );

  return Object.assign({}, cfg, { execution: mergedExecution });
}

module.exports = {
  ...CONFIG,
  getStakeSizingConfig,
  getExecutionHealthAdvisoryMode,
  getExecutionRiskConfig,
  getExecutionRetryConfig,
  getExecutionIdempotencyConfig,
  getArbExecutionConfig,
  getExecutionHedgingConfig,
  getExecutionModeConfig,
  getExecutionLatencyGuardConfig,
  DEFAULT_EXECUTION_PROFILES,
  getExecutionProfileConfig
};