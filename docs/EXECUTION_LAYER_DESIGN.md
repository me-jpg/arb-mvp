# Execution Layer Design (Spec Only)

## Purpose & Scope
- Bridge signals/strategy outputs to planned orders, simulated execution, and realized P&L.
- Operates after HF tracker, latency/stale engines, and signals layer; before results/PnL integration.
- V1 is offline/paper-only; real-money execution is a future gated phase.
- Inputs: selected signals (pure_arb, stale_vs_book, etc.) from `strategyEngine`.
- Outputs: execution logs (JSONL), simulated fills, and linkage to results/PnL for closed-loop analytics.
- Works alongside future risk/bankroll manager and monitoring/metrics surfaces.

## Proposed Folder Structure (future; no code yet)
- `src/execution/orderPlanner.js` — build `PlannedOrder` objects from selected signals/strategy output; handles stake assignment & side/market translation.
- `src/execution/riskGuard.js` — apply bankroll/exposure/ban-prevention rules; returns `RiskDecision`.
- `src/execution/executionEngine.js` — orchestrate planner → riskGuard → adapter/sim → logging; batches, retries, shutdown.
- `src/execution/bookAdapter/*.js` — per-book adapters (DK, MGM, ESPN, etc.), initially mocked; normalize requests/results.
- `src/execution/simulatedExchange.js` — deterministic/offline fills with slippage/rejection knobs; used for paper trading and tests.
- `src/execution/executionLogger.js` — append `ExecutionEvent` JSONL lines under `logs/execution/`.

## Data Contracts (shapes, spec only)
```ts
type PlannedOrder = {
  orderId: string;              // unique, derived from signalId + timestamp
  eventId: string;              // matches DATA_MODEL eventId
  book: string;                 // draftkings | betmgm | espnbet | ...
  marketType: 'moneyline' | 'spread' | 'total';
  side: 'home' | 'away' | 'over' | 'under';
  line?: number;                // spread/total value
  price: number;                // American odds
  stake: number;                // planned stake in currency units
  sourceSignalId: string;       // ties back to signal
  strategyId?: string;          // strategy config identifier
  createdAt: string;            // ISO
  metadata?: Record<string, any>; // extras (edgeEstimate, confidence, etc.)
};

type ExecutionRequest = {
  requestId: string;            // correlation id
  book: string;
  plannedOrder: PlannedOrder;
  adapterPayload?: Record<string, any>; // book-specific fields (market ids, tokens)
  sentAt: string;
};

type ExecutionResult = {
  requestId: string;
  status: 'filled' | 'partial' | 'rejected' | 'canceled' | 'timeout';
  filledStake: number;
  avgFillPrice?: number;
  slippage?: number;            // price difference vs planned
  errorCode?: string;           // adapter-defined or generic
  message?: string;
  decidedAt: string;
  fillEvents?: Array<{ stake: number; price: number; at: string }>;
};

type RiskDecision = {
  allowed: boolean;
  reasons: string[];            // if !allowed
  postOrderExposure?: {         // computed hypothetical exposure if allowed
    total: number;
    byBook: Record<string, number>;
    byEvent: Record<string, number>;
  };
  bankrollPctAtRisk?: number;
  computedAt: string;
};

type ExecutionEvent = {
  orderId: string;
  signalId: string;
  strategyId?: string;
  eventId: string;
  book: string;
  marketType: string;
  side: string;
  line?: number;
  price: number;
  stake: number;
  riskDecision: RiskDecision;
  request: ExecutionRequest;
  result?: ExecutionResult;
  latencyMs?: number;           // request → result
  warnings?: string[];
  createdAt: string;
};
```

## Core Flows (prose/sequences)

### Flow A: Signals → Planned Orders → Simulated Execution → P&L
1. Input: selected signals from `strategyEngine` (already sized or with suggested stake).
2. `orderPlanner` converts each signal to `PlannedOrder` (maps marketType/side/line/price/stake, sets orderId).
3. `riskGuard` evaluates each PlannedOrder → `RiskDecision` (bankroll %, per-book/event exposure).
4. If allowed, `executionEngine` builds `ExecutionRequest` and sends to `simulatedExchange`.
5. `simulatedExchange` returns `ExecutionResult` (filled/partial/rejected, slippage); `executionLogger` writes `ExecutionEvent` JSONL.
6. Outputs feed into P&L: join `ExecutionEvent` (by orderId/signalId/eventId) with results + existing PnL simulator for realized vs EV tracking.

### Flow B: Book Rejects or Partial Fills
1. `ExecutionResult.status` = rejected/partial.
2. `executionEngine` may retry with reduced stake or alternate book (configurable), or mark abandoned.
3. Log failure/partial in `ExecutionEvent` with errorCode/message.
4. Analytics: aggregate rejection/partial rates per book, slippage stats, fill latency.
5. P&L: partial fills use filledStake; rejections contribute zero stake but are counted in failure metrics.

### Flow C: One Side of Arb Fills, Other Does NOT
1. Detect via linked signals/orders for same event/arb pair; if one result = filled and paired leg = rejected/timeout.
2. Mark as `unhedged` in `ExecutionEvent` warnings; track worst-case exposure.
3. Mitigations (sim-only): attempt alternative book; cap unhedged exposure per event; optionally auto-cancel filled leg in sim to model real risk.
4. Feed into risk constraints: reduce future max stake for that event/book; record in unhedged exposure metrics.

## Safety Constraints & Ban-Prevention (planned)
- Bankroll-based:
  - Max stake per order as % bankroll.
  - Max exposure per event and per book.
  - Daily loss/drawdown caps.
- Behavioral (future real execution):
  - Rounded stakes (human-looking) vs exact Kelly.
  - Random latency between legs.
  - Max high-EV bets/hour/book; occasional recreational/noise bets (design only).
- Operational:
  - Max concurrent orders in flight.
  - Adapter timeouts; retries capped.
  - Safe shutdown: stop issuing new orders, wait for in-flight to resolve/log.
- Legal/ToS note: This design is for simulation and careful manual support; automated live-clicking/API use is a later, explicitly gated step with separate review.

## Interfaces to Existing Systems
- Signals / strategyEngine: consume SelectedSignal (must include eventId, marketType, side, line, price, primaryBook, strategyStake/edge).
- PnL + results: join `ExecutionEvent` with existing `pnlSimulator` via signalId/orderId/eventId; realized P&L uses filledStake/avgFillPrice.
- Diagnostics/metrics: emit counters/histograms — success rate, rejection rate, fill latency, slippage, unhedged exposure, per-book failure counts.

## Implementation Roadmap (future work)
1. Implement `simulatedExchange.js` with deterministic slippage/rejection knobs + JSONL logging.
2. Add `orderPlanner` + `executionLogger`; wire simple CLI `execution:simulate` (strategy → planner → sim → log).
3. Add `riskGuard` basic bankroll/exposure limits; integrate into executionEngine orchestrator.
4. Enhance analytics: surface unhedged legs, rejection rates, slippage summaries; tie into PnL report.
5. After stable simulation, draft separate design for real book adapters (browser/API), with additional compliance and safety gates.

### Running the simulation (once implemented)
- `npm run execution:simulate -- --limit=100 --minEdge=0.02 --book=draftkings`
- Outputs: counts for allowed/blocked/filled/partial/rejected and simulated exposure; logs to `logs/execution/execution-events.jsonl`.

