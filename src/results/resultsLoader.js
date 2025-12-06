// src/results/resultsLoader.js
// Offline loader for final results (CSV or JSONL) into an eventId->result map

const fs = require('fs');
const path = require('path');
const { normalizeTeam, createEventId } = require('../core/normalizer');

const DEFAULT_RESULTS_PATH = path.join(process.cwd(), 'results');

function normalizeEventId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Pattern: YYYY-MM-DD_Team_A_vs_Team_B (canonical HF)
  const underscored = trimmed.match(/^(\d{4}-\d{2}-\d{2})_(.+)_vs_(.+)$/);
  if (underscored) {
    const [, date, teamA, teamB] = underscored;
    return createEventId(normalizeTeam(teamA.replace(/_/g, ' ')), normalizeTeam(teamB.replace(/_/g, ' ')), date);
  }

  // Pattern: YYYY-MM-DD Team A vs Team B
  const spaced = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)\s+vs\s+(.+)$/i);
  if (spaced) {
    const [, date, teamA, teamB] = spaced;
    return createEventId(normalizeTeam(teamA), normalizeTeam(teamB), date);
  }

  // Fallback to provided string
  return trimmed;
}

function parseScoreRow(row, context = 'results') {
  if (!row || typeof row !== 'object') {
    console.warn(`[RESULTS] ${context}: Invalid row (not object)`);
    return null;
  }

  const eventId = normalizeEventId(row.eventId || row.event_id);
  const final = row.final || row.score || null;
  const homeScore = final ? final.homeScore ?? final.home : row.homeScore ?? row.home;
  const awayScore = final ? final.awayScore ?? final.away : row.awayScore ?? row.away;

  if (!eventId) {
    console.warn(`[RESULTS] ${context}: Missing eventId, skipping`);
    return null;
  }

  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    console.warn(`[RESULTS] ${context}: Missing scores for ${eventId}, skipping`);
    return null;
  }

  return {
    eventId,
    final: {
      homeScore: Number(homeScore),
      awayScore: Number(awayScore)
    }
  };
}

function loadJsonl(filePath) {
  const out = [];
  const content = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  for (const [idx, line] of content.entries()) {
    try {
      const obj = JSON.parse(line);
      const parsed = parseScoreRow(obj, `${path.basename(filePath)}:${idx + 1}`);
      if (parsed) out.push(parsed);
    } catch (err) {
      console.warn(`[RESULTS] ${filePath}:${idx + 1} malformed JSON, skipping`);
    }
  }
  return out;
}

function loadCsv(filePath) {
  const out = [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const idxEvent = headers.indexOf('eventid');
  const idxHome = headers.indexOf('homescore');
  const idxAway = headers.indexOf('awayscore');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const row = {
      eventId: idxEvent >= 0 ? cols[idxEvent] : cols[0],
      homeScore: idxHome >= 0 ? Number(cols[idxHome]) : Number(cols[1]),
      awayScore: idxAway >= 0 ? Number(cols[idxAway]) : Number(cols[2])
    };
    const parsed = parseScoreRow(row, `${path.basename(filePath)}:${i + 1}`);
    if (parsed) out.push(parsed);
  }
  return out;
}

function collectFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];
  const entries = fs.readdirSync(targetPath);
  return entries
    .filter(f => f.endsWith('.jsonl') || f.endsWith('.csv'))
    .map(f => path.join(targetPath, f));
}

function loadResults(options = {}) {
  const { resultsPath = DEFAULT_RESULTS_PATH } = options;
  const files = collectFiles(resultsPath);
  const map = new Map();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const rows = ext === '.csv' ? loadCsv(file) : loadJsonl(file);
    for (const row of rows) {
      map.set(row.eventId, row);
    }
  }

  return map;
}

module.exports = {
  loadResults,
  parseScoreRow,
  normalizeEventId
};

