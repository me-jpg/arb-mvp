# Research Playbook

A step-by-step guide to using ArbMVP for quantitative sports betting research.

**Audience:** Quant-curious engineers, data scientists, or technical advisors who want to analyze sportsbook edge and latency patterns.

**Scope:** Offline research and simulation only—no live trading.

---

## Overview

This playbook walks you through:

1. **Sanity check** – Verify tests pass and system is healthy
2. **Collect raw data** – Run HF tracker during live games
3. **Build latency metrics** – Analyze book speed and stale lines
4. **Generate signals** – Convert inefficiencies into tradeable signals
5. **Simulate strategies** – Paper trade with various configs
6. **Sweep & optimize** – Grid search for best strategy parameters

Each step builds on the previous. By the end, you'll have a research workflow you can repeat across multiple sessions.

---

## Step 1 – Sanity Check

Before anything else, verify the system is working.

### Run Tests

```bash
npm run test:all
```

**Good output:**
```
=== All windowBuilder tests passed! ===
=== All latencyAnalyzer tests passed! ===
=== All staleLineDetector tests passed! ===
=== All signalGenerator tests passed! ===
=== All paperTrader tests passed! ===
=== All arbSignalAdapter tests passed! ===
=== All strategyEngine tests passed! ===
=== All strategySweep tests passed! ===
```

All 57 tests should pass.

### Run Diagnostics

```bash
npm run diagnostics:check
```

**Good output:**
```
✅ DB connection:      OK (or WARN if disabled)
✅ Logs directory:     OK
✅ Latency logs:       OK (or WARN if no data yet)
✅ Signals log:        OK (or WARN if no data yet)
✅ Paper trader:       OK
✅ Strategy engine:    OK

⚠️  Overall status: READY WITH WARNINGS
```

Warnings about missing log data are normal on first run—you'll generate that data next.

---

## Step 2 – Collect Raw Market Data

Run the high-frequency tracker during **live games** to collect odds and detect line changes.

### Basic Usage

```bash
npm run hf:run
```

This will:
- Launch headless browsers for DraftKings, BetMGM, ESPN Bet
- Scrape odds every ~20 seconds (configurable)
- Detect line changes and write to `line_changes` table
- Check for arbitrage opportunities each cycle
- Persist `pure_arb` signals to `logs/signals.jsonl`

### Suggested Duration

| Goal | Duration |
|------|----------|
| Quick demo | 5–10 minutes |
| Meaningful latency data | 30–60 minutes |
| Edge characterization | Multiple sessions |

### Configuration Knobs

Set in `.env` or as environment variables:

| Variable | Default | Effect |
|----------|---------|--------|
| `HF_INTERVAL_MS` | `20000` | Cycle interval. Lower = more data, higher load |
| `HF_MAX_EVENTS` | `6` | Games per book. More = better cross-book overlap |
| `HF_MIN_EDGE_PERCENT` | `0.0` | Minimum arb edge to log. `0` = log all positive edges |
| `HF_DEBUG_TIMINGS` | `false` | Set `true` for performance timing breakdown |

### Example: Enable Debug Timings

```bash
# Windows PowerShell
$env:HF_DEBUG_TIMINGS = "true"; npm run hf:run

# Linux/Mac
HF_DEBUG_TIMINGS=true npm run hf:run
```

Output will include:
```
[HF_TIMING] scrape:
   draftkings: 15200ms
   betmgm: 12400ms
   espnbet: 14800ms
[HF_TIMING] arbitrage engine: 2ms
[HF_TIMING] total: 15250ms (interval=20000ms, utilization=76.3%)
```

### When to Run

- **Best:** During live NFL/NBA games (high line movement)
- **Okay:** Pre-game (less movement, still useful for latency baseline)
- **Avoid:** Off-hours with no live events (no line changes to analyze)

---

## Step 3 – Build Latency & Stale Line Metrics

After collecting data, run the latency analyzer to compute per-book speed metrics.

### One-Time Analysis (Recommended)

```bash
npm run latency:once
```

Or for continuous analysis:
```bash
npm run latency:daemon
```

### View the Dashboard

```bash
npm run latency:summary
```

**Example output:**
```
======================================================================
LATENCY METRICS SUMMARY (last 200 metric rows)
======================================================================

Book           Obs   Avg Delay   First%   Last%   SpeedScore
----------------------------------------------------------------------
draftkings      42       350ms    45.2%   18.5%        0.267
espnbet         38       680ms    32.1%   28.4%        0.037
betmgm          35       920ms    22.7%   53.1%       -0.304

======================================================================
STALE LINE SUMMARY (last 200 stale events)
======================================================================

Book           Stale Events   Avg Duration (ms)
--------------------------------------------------
betmgm                   18                8200
espnbet                  11                6400
draftkings                4                3100
```

### Interpreting Results

| Metric | What It Means |
|--------|---------------|
| **Avg Delay** | Average ms behind the fastest book. Lower = faster. |
| **First%** | How often this book moves first. Higher = faster data feed. |
| **Last%** | How often this book is last to update. Higher = slower. |
| **SpeedScore** | `First% - Last%`. Positive = fast, negative = slow. |
| **Stale Events** | Times this book was significantly behind others. |
| **Avg Duration** | How long stale periods lasted on average. |

### Output Files

| File | Contents |
|------|----------|
| `logs/latency-metrics.jsonl` | Per-book latency stats per analysis run |
| `logs/stale-lines.jsonl` | Individual stale line events (if any detected) |

**"No stale lines yet"** is normal if books are updating at similar speeds or your `STALE_LINE_THRESHOLD_MS` is high.

---

## Step 4 – Generate Signals + Paper EV

Convert latency data and stale lines into actionable signals.

### Run Signal Analysis

```bash
npm run signals:analyze
```

This will:
1. Read `logs/latency-metrics.jsonl` and `logs/stale-lines.jsonl`
2. Generate `stale_vs_book` signals from stale line events
3. Run paper trading simulation to estimate EV
4. Persist signals to `logs/signals.jsonl`

**Example output:**
```
📊 SIGNAL ANALYSIS
────────────────────────────────────────────────────────────
📈 Loaded 44 latency metrics
⚠️  Loaded 8 stale line events
🎯 Generated 8 signals

📊 PAPER TRADING SIMULATION
────────────────────────────────────────────────────────────
   Signals: 8
   Total stake: $400.00
   Avg edge: 4.25%
   Expected value: $17.00

💾 Signals persisted: 8 → logs/signals.jsonl
```

### Signal Types

| Type | Source | Meaning |
|------|--------|---------|
| `pure_arb` | HF tracker | Pure 2-way arbitrage opportunity |
| `stale_vs_book` | Latency analyzer | Stale line vs. faster reference book |

### What Gets Persisted

All signals are appended to `logs/signals.jsonl` with:
- Unique ID
- Event, market, side
- Primary book (where you'd hypothetically bet)
- Edge estimate
- Confidence score
- Metadata (stale duration, arb details, etc.)

See [`docs/DATA_MODEL.md`](DATA_MODEL.md) for full schema.

---

## Step 5 – Summaries & Strategy Simulation

Now analyze your historical signals and test strategy configurations.

### Signals Summary

```bash
npm run signals:summary
```

Shows distributions by:
- Signal type (pure_arb vs stale_vs_book)
- Primary book
- Edge histogram
- Global stats (count, avg edge, etc.)

### Single Strategy Simulation

```bash
npm run signals:strategy
```

Runs `applyStrategy()` on historical signals with configurable parameters.

**CLI options:**
```bash
npm run signals:strategy -- --minEdge=0.03 --stakeMode=flat --flatStake=50 --maxPerEvent=2
```

**Output:**
```
📊 STRATEGY RESULTS
────────────────────────────────────────────────────────────
   Input signals: 45
   Selected: 28
   Rejected: 17
   Total stake: $1,400.00
   Expected value: $42.00
   Exposure by book: { draftkings: $800, betmgm: $600 }
```

### Grid Search (Sweep)

```bash
npm run signals:sweep
```

Runs `applyStrategy()` across a grid of configurations:

| Parameter | Default Grid Values |
|-----------|---------------------|
| `minEdge` | 2%, 3%, 4%, 5% |
| `stakeMode` | flat, edge_scaled |
| `maxSignalsPerEvent` | 1, 2 |
| `maxTotalStakePerBook` | $3,000, $5,000 |

**Output:**
```
══════════════════════════════════════════════════════════════════════════════════════════
  CONFIG                                               SEL   STAKE        EV    EV/STAKE
──────────────────────────────────────────────────────────────────────────────────────────
  min=2%  edge_s  pE=2  pB=5000                          45   $2,400.00   $86.40     3.60%
  min=3%  flat    pE=1  pB=3000                          28   $1,400.00   $56.00     4.00%
  min=4%  edge_s  pE=1  pB=5000                          18   $1,200.00   $52.80     4.40%
  ...

🏆 Best config by EV: min=2% edge perEvt=2 perBook=5000

🎯 Best config by EV/Stake (capital efficiency): min=4% edge perEvt=1 perBook=5000
```

**Key metrics:**
- **EV** – Expected value in dollars
- **EV/Stake** – Capital efficiency (higher = better use of bankroll)

**CLI filters:**
```bash
npm run signals:sweep -- --limit=500 --type=pure_arb --book=draftkings
```

---

## Step 6 – Recommended Workflows

### Workflow A: Quick Session (Single Evening)

Best for: Demo, quick edge check, single game night.

```bash
# 1. Verify system
npm run test:all
npm run diagnostics:check

# 2. Start HF tracker during live games (let run 30-60 min)
npm run hf:run

# 3. In another terminal: analyze + summarize
npm run latency:full           # Latency analysis + summary
npm run signals:analyze        # Generate signals
npm run signals:summary        # View signal distributions

# 4. Test strategies
npm run signals:strategy       # Single config
npm run signals:sweep          # Grid search
```

### Workflow B: Edge Characterization (Multiple Nights)

Best for: Building robust statistical picture of book latency and edge.

```bash
# Night 1, 2, 3, ...
npm run hf:run                 # Run during games, 60+ min each

# After each session:
npm run latency:once

# After accumulating data:
npm run signals:analyze

# Comprehensive sweep:
npm run signals:sweep -- --limit=2000

# Compare patterns:
npm run signals:sweep -- --type=pure_arb
npm run signals:sweep -- --type=stale_vs_book
npm run signals:sweep -- --book=draftkings
npm run signals:sweep -- --book=betmgm
```

### Workflow C: Book-Specific Analysis

Best for: Evaluating whether a specific book is worth targeting.

```bash
# Collect data as usual
npm run hf:run

# Analyze latency for specific book patterns
npm run latency:summary

# Filter signals by book
npm run signals:summary -- --book=betmgm
npm run signals:sweep -- --book=betmgm
```

---

## Tips & Troubleshooting

### Empty Results

| Symptom | Cause | Fix |
|---------|-------|-----|
| 0 line changes | No live games | Run during NFL/NBA game times |
| 0 stale lines | Books updating similarly | Lower `STALE_LINE_THRESHOLD_MS` |
| 0 arb opportunities | No price discrepancies | Normal—real arbs are rare |

### Performance Issues

| Symptom | Fix |
|---------|-----|
| "Cycle took longer than interval" | Increase `HF_INTERVAL_MS` or reduce `HF_MAX_EVENTS` |
| High memory usage | Restart HF tracker periodically (auto-restarts every 50 cycles) |

### Data Quality

| Issue | Solution |
|-------|----------|
| Same game different event IDs | Team normalization should handle this automatically |
| Stale cached data | Clear `logs/` directory and start fresh |

---

## Future Directions

These are **not implemented yet**, but logical next steps:

| Area | Possible Enhancement |
|------|---------------------|
| **Automation** | n8n or Airflow for scheduled HF runs |
| **Cloud DB** | Supabase or Neon for persistent cloud Postgres |
| **Dashboard** | React/Vue UI for real-time monitoring |
| **Execution** | API adapters for real bet placement |
| **Backtesting** | Historical odds replay for strategy validation |

For now, this repo focuses on **research infrastructure**. Execution is intentionally out of scope.

---

## Quick Reference

| Task | Command |
|------|---------|
| Run tests | `npm run test:all` |
| Check health | `npm run diagnostics:check` |
| Start HF tracker | `npm run hf:run` |
| Analyze latency | `npm run latency:once` |
| View latency dashboard | `npm run latency:summary` |
| Generate signals | `npm run signals:analyze` |
| Summarize signals | `npm run signals:summary` |
| Run strategy | `npm run signals:strategy` |
| Grid search | `npm run signals:sweep` |

---

## See Also

- [`README.md`](../README.md) – Project overview and setup
- [`DATA_MODEL.md`](DATA_MODEL.md) – Canonical data shapes
- [`LATENCY_DEMO_RUNBOOK.md`](LATENCY_DEMO_RUNBOOK.md) – Quick latency demo guide




