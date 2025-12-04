# ArbMVP

Real-time sportsbook arbitrage scanner, latency analyzer, and signal/strategy research harness. Built for quantitative sports betting research.

**Phases:**
1. **HF Scraping** – High-frequency odds collection from DraftKings, BetMGM, ESPN Bet via Puppeteer
2. **Latency Measurement** – Per-book speed analysis and stale line detection
3. **Signal Generation** – Convert market inefficiencies into actionable signals
4. **Strategy Simulation** – Paper trading with configurable strategies and grid search

---

## Quick Start

### Prerequisites

- **Node.js** v18+ (v20 recommended)
- **PostgreSQL** 14+ running locally
- **npm** for package management

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd arb-mvp
npm install

# 2. Create .env (copy example below)
cp .env.example .env   # or create manually

# 3. Apply database schema
psql -U postgres -d arbitrage_db -f migrations/001_initial_schema.sql

# 4. Run tests to verify setup
npm run test:all

# 5. Check system health
npm run diagnostics:check
```

### Minimal `.env`

```env
# Database
DB_ENABLED=true
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=arbitrage_db

# HF Tracker (optional tuning)
HF_INTERVAL_MS=20000
HF_MAX_EVENTS=6
HF_MIN_EDGE_PERCENT=0.0
```

**If diagnostics shows green, you're ready for research.**

---

## Core Scripts Cheat Sheet

| Script | Command | Description |
|--------|---------|-------------|
| **HF Tracker** | `npm run hf:run` | Start high-frequency odds scraping |
| **Latency Once** | `npm run latency:once` | Run latency analysis on recent data |
| **Latency Daemon** | `npm run latency:daemon` | Continuous latency analysis |
| **Latency Summary** | `npm run latency:summary` | Print latency dashboard from logs |
| **Latency Full** | `npm run latency:full` | Analyze + print summary in one command |
| **Signals Analyze** | `npm run signals:analyze` | Generate signals from latency/stale data |
| **Signals Summary** | `npm run signals:summary` | Summarize historical signals |
| **Signals Strategy** | `npm run signals:strategy` | Run single strategy simulation |
| **Signals Sweep** | `npm run signals:sweep` | Grid search over strategy configs |
| **Diagnostics** | `npm run diagnostics:check` | System health check |
| **Test All** | `npm run test:all` | Run all unit tests (57 tests) |
| **Test Latency** | `npm run test:latency` | Run latency module tests |
| **Test Signals** | `npm run test:signals` | Run signals module tests |
| **Metrics API** | `npm run metrics:serve` | Start HTTP API server (port 8788) |

---

## Folder Layout

```
arb-mvp/
├── src/
│   ├── highfreq/          # HF tracker, scraper, arb engine, change detection
│   ├── latency/           # Latency analyzer, stale detection, window builder
│   ├── signals/           # Signal generation, paper trader, strategy engine
│   ├── scrapers/          # Puppeteer-based sportsbook scrapers
│   ├── core/              # Team normalization, event ID generation
│   ├── utils/             # DB client, logger, shape validator
│   ├── diagnostics/       # System health check
│   ├── server/            # HTTP metrics API
│   └── websocket/         # Real-time dashboard WebSocket
├── tests/
│   ├── latency/           # Latency module tests (19 tests)
│   └── signals/           # Signal module tests (38 tests)
├── docs/
│   ├── DATA_MODEL.md      # Canonical data shapes
│   ├── LATENCY_DEMO_RUNBOOK.md  # Latency system guide
│   └── RESEARCH_PLAYBOOK.md     # End-to-end research workflow
├── logs/                  # JSONL output files (gitignored)
├── migrations/            # PostgreSQL schema files
└── config.js              # Centralized configuration
```

---

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HF TRACKER                                     │
│   Puppeteer → DraftKings, BetMGM, ESPN Bet (parallel scraping)              │
│                         ↓                                                   │
│   Normalize teams → Detect changes → Find arbitrage                         │
│                         ↓                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  PostgreSQL: line_changes, odds_snapshots, edges                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                         ↓ (pure_arb signals)                               │
│                  logs/signals.jsonl                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LATENCY ANALYZER                                   │
│   Query line_changes → Build time windows → Compute per-book metrics        │
│                         ↓                                                   │
│   ┌─────────────────────────────┐  ┌─────────────────────────────┐         │
│   │ logs/latency-metrics.jsonl  │  │  logs/stale-lines.jsonl     │         │
│   └─────────────────────────────┘  └─────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SIGNALS LAYER                                      │
│   stale lines → stale_vs_book signals                                       │
│   arb opportunities → pure_arb signals                                      │
│                         ↓                                                   │
│                  logs/signals.jsonl                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STRATEGY & RESEARCH                                     │
│   applyStrategy() → Filter, stake, exposure caps                            │
│   signals:sweep → Grid search (minEdge, stakeMode, caps)                    │
│                         ↓                                                   │
│   Output: selectedSignals, totalStake, EV, EV/Stake (capital efficiency)    │
└─────────────────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DIAGNOSTICS                                          │
│   npm run diagnostics:check → DB, logs, signals, strategy health            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Data schemas:** See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for precise field definitions.

---

## Safety & Scope

> ⚠️ **This is paper trading / research only.** No real-money execution is implemented.

**What this system does:**
- Collects real-time odds from sportsbooks
- Detects arbitrage opportunities and latency edges
- Generates signals for offline analysis
- Simulates strategy performance with paper P&L

**What this system does NOT do:**
- Place actual bets
- Connect to betting APIs for execution
- Handle real money in any way

**Future execution integration point:**
When ready for live trading, you would:
1. Replace paper trading in `strategyEngine.js` with real stake allocation
2. Add execution adapters (API calls to sportsbook betting endpoints)
3. Add position tracking and settlement reconciliation

This is intentionally out of scope for this research MVP.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Canonical data shapes (Event, LineChange, Signal, etc.) |
| [`docs/LATENCY_DEMO_RUNBOOK.md`](docs/LATENCY_DEMO_RUNBOOK.md) | Quick guide for latency analysis demos |
| [`docs/RESEARCH_PLAYBOOK.md`](docs/RESEARCH_PLAYBOOK.md) | Full end-to-end research workflow |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_ENABLED` | `false` | Enable PostgreSQL persistence |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | | Database password |
| `DB_NAME` | `arbitrage_db` | Database name |
| `HF_INTERVAL_MS` | `20000` | HF cycle interval (ms) |
| `HF_MAX_EVENTS` | `6` | Games per book to track |
| `HF_MIN_EDGE_PERCENT` | `0.0` | Minimum arb edge to log |
| `HF_DEBUG_TIMINGS` | `false` | Enable detailed timing logs |
| `ARB_DEBUG` | `false` | Enable verbose arb engine logs |
| `LATENCY_WINDOW_MS` | `30000` | Time window for latency grouping |
| `STALE_LINE_THRESHOLD_MS` | `60000` | Stale line detection threshold |
| `METRICS_PORT` | `8788` | HTTP API port |

---

## License

ISC

