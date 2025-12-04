# Latency Analytics Demo Runbook

A quick guide to running the ArbMVP latency analysis system for demos and data collection.

---

## 1. Prerequisites

### Database
- PostgreSQL running locally or accessible remotely.
- Schema applied: `psql -U postgres -d arbitrage_db -f migrations/001_initial_schema.sql`

### Environment Variables
Create a `.env` file in the project root (copy from `.env.example` if available):

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=arbitrage_db

# High-Frequency Tracker
HF_ENABLED=true
HF_MAX_EVENTS=12          # Games per book (default: 12)
HF_MIN_EDGE_PERCENT=0.0   # Minimum edge % to log (0 = log all positive edges)
HF_INTERVAL_MS=10000      # Scrape interval in ms (default: 10s)

# Latency Analysis
LATENCY_WINDOW_MS=30000       # Time window for grouping changes (default: 30s)
STALE_LINE_THRESHOLD_MS=5000  # Delay before a line is considered "stale" (default: 5s)

# Debug (optional)
ARB_DEBUG=false           # Set to "true" for verbose arbitrage logging
```

### Node.js
- Node.js v18+ recommended.
- Install dependencies: `npm install`

---

## 2. Start High-Frequency Tracker

```bash
npm run hf:run
```

This will:
- Launch headless browsers for each configured sportsbook (DraftKings, BetMGM, ESPN Bet).
- Scrape odds every `HF_INTERVAL_MS` milliseconds.
- Detect line changes and write them to the `line_changes` table.
- Check for arbitrage opportunities on each cycle.

**For verbose debug output:**
```bash
# Windows PowerShell
$env:ARB_DEBUG = "true"; npm run hf:run

# Linux/Mac
ARB_DEBUG=true npm run hf:run
```

**Guidance:** Let this run for **5–15 minutes** during live games to accumulate meaningful `line_changes` data for latency analysis.

---

## 3. Run Latency Analyzer

### One-time analysis (recommended for demos)
```bash
npm run latency:once
```

This:
- Queries `line_changes` from the last 10 minutes.
- Builds time windows and computes per-book latency metrics.
- Detects stale lines (books that lag behind others).
- Writes results to:
  - `logs/latency-metrics.jsonl`
  - `logs/stale-lines.jsonl` (if any stale lines found)

### Continuous analysis (daemon mode)
```bash
npm run latency:daemon
```

Runs analysis in a loop (every 60 seconds by default). Press `Ctrl+C` to stop gracefully.

---

## 4. View Latency Dashboard

```bash
npm run latency:summary
```

**Example output:**

```
📈 LATENCY DASHBOARD
Reading from: C:\Users\jacob\arb-mvp\logs

======================================================================
LATENCY METRICS SUMMARY (last 200 metric rows)
======================================================================

Book           Obs   Avg Delay   First%   Last%   SpeedScore
----------------------------------------------------------------------
draftkings      42       350ms    45.2%   18.5%        0.267
espnbet         38       680ms    32.1%   28.4%        0.037
betmgm          35       920ms    22.7%   53.1%       -0.304

📊 Total metric rows analyzed: 115

======================================================================
STALE LINE SUMMARY (last 200 stale events)
======================================================================

Book           Stale Events   Avg Duration (ms)
--------------------------------------------------
betmgm                   18                8200
espnbet                  11                6400
draftkings                4                3100

⚠️ Total stale events analyzed: 33
```

### Interpreting the Output

| Metric | Meaning |
|--------|---------|
| **Avg Delay** | Average milliseconds behind the fastest book per market move. Lower = faster. |
| **First%** | How often this book moves first on a market. Higher = faster/better data feed. |
| **Last%** | How often this book is the last to update. Higher = slower/laggier. |
| **SpeedScore** | `First% - Last%`. Positive = generally fast. Negative = generally slow. |
| **Stale Events** | Count of times this book was significantly behind others. |
| **Avg Duration** | Average staleness duration in milliseconds when stale. |

**Quick interpretation:**
- Books at the **top** of the latency table (highest SpeedScore) have the fastest odds updates.
- Books with many **stale events** may have slower data feeds or rate-limiting issues.

---

## 5. Tuning & Tips

### Environment Variables

| Variable | Effect |
|----------|--------|
| `HF_MAX_EVENTS` | More events = more cross-book overlap = better latency data. Try 15–20 for richer analysis. |
| `HF_MIN_EDGE_PERCENT` | Set to `0` to see all edges. Set to `0.5` or higher to filter noise. |
| `STALE_LINE_THRESHOLD_MS` | Lower = more sensitive stale detection. Default 5000ms is reasonable. |
| `LATENCY_WINDOW_MS` | Larger windows group more changes together. Default 30000ms (30s) works well. |

### Common Issues

| Problem | Solution |
|---------|----------|
| Empty latency summary | Let HF tracker run longer, or ensure live games are in progress. |
| No stale lines detected | Normal if books are updating at similar speeds. Lower `STALE_LINE_THRESHOLD_MS` to be more sensitive. |
| "0 unique eventIds" in HF output | No live games found. Try during NFL/NBA game times. |
| Cycle time > interval warning | Normal on slower machines. Consider increasing `HF_INTERVAL_MS`. |

### Quick Demo Workflow

```bash
# 1. Start HF tracker (let run 5-10 min during live games)
npm run hf:run

# 2. In another terminal, run analysis + summary
npm run latency:full

# Or separately:
npm run latency:once
npm run latency:summary
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run hf:run` | Start HF tracker (daemon) |
| `npm run hf:run:debug` | Start HF tracker with verbose debug output |
| `npm run latency:once` | Run latency analysis once |
| `npm run latency:daemon` | Run latency analysis continuously |
| `npm run latency:summary` | Print latency dashboard from logs |
| `npm run latency:full` | Run analysis once + print summary |
| `npm run test:latency` | Run latency module unit tests |

