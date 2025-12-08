// src/execution/executionLogger.js
// Append execution events to JSONL
// Supports telemetry fields: engineVersion, riskRuleSummary, fillQuality, simRunId

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs', 'execution');
const LOG_FILE = path.join(LOG_DIR, 'execution-events.jsonl');
const ADVISORY_LOG_FILE = path.join(process.cwd(), 'logs', 'execution-health-advisory.jsonl');

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  const advisoryDir = path.dirname(ADVISORY_LOG_FILE);
  if (!fs.existsSync(advisoryDir)) {
    fs.mkdirSync(advisoryDir, { recursive: true });
  }
}

function logExecutionEvent(event) {
  if (!event) return;
  try {
    ensureDir();
    const line = JSON.stringify(event) + '\n';
    fs.appendFile(LOG_FILE, line, 'utf8', (err) => {
      if (err) console.error('[executionLogger] write failed', err.message);
    });

    // Advisory logging (read-only, async, no branching)
    logHealthAdvisory().catch(() => { });
  } catch (err) {
    console.error('[executionLogger] error', err.message);
  }
}

async function logHealthAdvisory() {
  try {
    const { loadExecutionHealth } = require('../metrics/executionHealthLoader');
    const { evaluateExecutionHealthForBatch } = require('./executionHealthAdvisoryIntegration');
    const config = require('../config');

    const healthSummary = await loadExecutionHealth({ limit: 1000, windowMinutes: 15 });
    const advisoryCtx = evaluateExecutionHealthForBatch(healthSummary, config);

    const advisoryLog = {
      type: 'execution_health_advisory',
      timestamp: new Date().toISOString(),
      level: advisoryCtx.advisory.level,
      enforcementMode: advisoryCtx.enforcementMode,
      haltRecommended: advisoryCtx.haltRecommended,
      shouldAffectExecution: advisoryCtx.shouldAffectExecution,
      reasons: advisoryCtx.advisory.reasons.slice(0, 3),
      metrics: {
        globalFillRate: advisoryCtx.advisory.metrics.globalFillRate,
        globalRejectRate: advisoryCtx.advisory.metrics.globalRejectRate
      }
    };

    // Enforcement: Emit halt log if conditions met
    if (advisoryCtx.enforcementMode === 'halt' && advisoryCtx.haltRecommended) {
      const haltLog = {
        type: 'execution_health_halt',
        timestamp: new Date().toISOString(),
        level: advisoryCtx.advisory.level,
        enforcementMode: advisoryCtx.enforcementMode,
        reasons: advisoryCtx.advisory.reasons.slice(0, 3)
      };
      ensureDir();
      const haltLine = JSON.stringify(haltLog) + '\n';
      fs.appendFile(ADVISORY_LOG_FILE, haltLine, 'utf8', () => { });
    }

    ensureDir();
    const line = JSON.stringify(advisoryLog) + '\n';
    fs.appendFile(ADVISORY_LOG_FILE, line, 'utf8', () => { });
  } catch {
    // Silent failure - advisory only
  }
}

module.exports = {
  logExecutionEvent,
  LOG_FILE,
  ADVISORY_LOG_FILE
};
