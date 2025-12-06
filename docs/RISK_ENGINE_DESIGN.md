# Risk & Bankroll Engine Design (Spec Only)

## Purpose & Scope
- Provide centralized bankroll and exposure controls for ArbMVP.
- Acts as the policy brain feeding `riskGuard` (real-time gate) inside `executionEngine`.
- Governs stake sizing limits, exposure caps (book/event/market/time), drawdown/daily loss controls, and ban-risk heuristics.
- Consumes signals/strategy outputs; protects execution; informs PnL simulator and future dashboards.
- V1 is offline/sim-only; real-money protections are future, gated.

## Core Concepts
- **Bankroll**: total tracked capital (global or per-user); basis for % limits.
- **Exposure**: at-risk stake by book, event, marketType, and time window (e.g., daily).
- **Limits**: max stake per order (% bankroll), per-book cap, per-event cap, per-day cap; max daily loss; max drawdown from peak.
- **Risk Modes**: presets (conservative / normal / aggressive) that set limit multipliers.
- **Ban-Risk Heuristics**: rate/behavioral rules to avoid sharp, bot-like patterns (volume, clustering, unrounded stakes, lack of noise bets).

## Data Contracts (spec only)
```ts
type BankrollConfig = {
  initialBankroll: number;
  targetBankroll?: number;
  maxStakePctPerOrder: number;          // e.g., 1% of bankroll
  maxExposurePctPerEvent: number;       // combined legs on same event
  maxExposurePctPerBook: number;        // outstanding per book
  maxDailyLossPct: number;              // vs starting bankroll of day
  maxDrawdownPct: number;               // vs rolling equity peak
  perBookCaps?: Record<string, number>; // absolute stake caps per book
  perSportCaps?: Record<string, number>;
  riskMode: 'conservative' | 'normal' | 'aggressive';
  modeMultipliers?: Record<string, number>; // adjust limits by mode
};

type ExposureSnapshot = {
  asOf: string;
  bankroll: number;
  openExposureTotal: number;
  byBook: Record<string, number>;
  byEvent: Record<string, number>;
  byMarketType: Record<string, number>;
  byDay: Record<string, number>;        // for daily caps
  openOrders: string[];                 // orderIds
};

type RiskRule = {
  id: string;
  description: string;
  enabled: boolean;
  severity: 'info' | 'warn' | 'block';
  fn: string;                           // evaluation function name
  params?: Record<string, any>;
};

type RiskCheckResult = {
  allowed: boolean;
  violatedRules: Array<{ id: string; severity: string; reason: string }>;
  suggestedStakeAdjustment?: number;    // lower stake if possible
  notes?: string[];
};

type BanRiskMetrics = {
  highEVBetsPerHour: number;
  avgStakeRoundnessScore: number;       // 1 = very round, 0 = noisy
  fractionNoiseBets: number;            // noise/cover vs sharp
  rapidFireClusters: number;            // bursts within short windows
  perBookVolumeHourly: Record<string, number>;
};

// RiskDecision from execution spec can embed:
// { allowed, reasons, postOrderExposure, bankrollPctAtRisk, banRisk?: BanRiskMetrics, checkResult?: RiskCheckResult }
```

## Flows & Evaluation Order

### Flow A: Pre-order Risk Evaluation
1. `PlannedOrder` arrives (from orderPlanner).
2. Load current `ExposureSnapshot` + recent PnL (rolling day).
3. Apply bankroll limits: stake ≤ maxStakePctPerOrder * bankroll.
4. Check per-book/event exposure vs caps and per-day cap.
5. Evaluate daily loss and drawdown thresholds.
6. Run ban-risk heuristics: high-EV velocity, clustering, stake roundness, noise ratio.
7. Produce `RiskCheckResult`; build `RiskDecision` for `riskGuard/executionEngine`.

### Flow B: Post-execution Risk Update
1. After `ExecutionResult`, update exposure (remove filled stake from open, add realized PnL).
2. Update rolling PnL windows, drawdown state, per-book win/loss.
3. Update ban-risk counters (success/failure rates, volume/hour, clustering).
4. Optionally switch riskMode or tighten limits when thresholds breached (e.g., move to conservative after loss).

### Flow C: Daily Reset / Session Management
1. Daily windows reset at configurable cutoff (e.g., 4am ET) or on session start.
2. Multiple sessions per day: maintain per-session and per-day aggregates.
3. Persist risk state between runs (V1: JSONL snapshots; future: DB).

## Ban-Prevention Model (Detailed)
- **Stake Shaping**: snap to buckets [10, 20, 25, 50, 75, 100, 150, 200] ± small jitter; avoid exact Kelly outputs.
- **Temporal Behavior**: cap high-EV bets/hour/book; enforce minimum spacing; random delays between paired legs.
- **Noise / Cover Bets**: target ratio (e.g., ≥10% recreational/noise) with small stakes and round numbers; tracked as sim-only metric initially.
- **Clustering**: flag bursts (e.g., >N bets in <M minutes per book/market).
- **Leg Pairing**: limit unhedged exposure; cap outstanding single-leg risk.
- Mark which are sim-only vs future real-execution gates (all above start as sim metrics; can graduate to hard blocks later).

## Interfaces & Storage
- Inputs: `ExecutionEvent` logs, PnL summaries, strategy config (edge thresholds, stakeMode), bankroll config/env.
- Outputs: risk state snapshots, rule violations, mode switches to `logs/risk/` (JSONL); summary metrics for dashboards/CLI later.
- State: V1 in-memory with periodic JSONL snapshots; future migration to DB tables.

## Implementation Roadmap (future work)
1. Create `src/risk/` (later) with riskState loader (BankrollConfig from config/env), in-memory `ExposureSnapshot`, periodic JSONL snapshots.
2. Implement pure functions (max stake %, per-book/event caps, daily loss, drawdown) with tests — no execution wiring yet.
3. Add ban-risk metric collectors (stake roundness, volume/hour, clustering) in pure form + tests.
4. Wire checks into `riskGuard` once execution layer is coded; return rich `RiskDecision`.
5. Integrate PnL summaries to adjust limits dynamically (e.g., tighten in drawdown).
6. Add CLI `risk:summary` (later) to print current state/violations.
7. After stable sim, consider real-time hooks for live execution with additional compliance review.

