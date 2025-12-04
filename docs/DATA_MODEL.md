# Data Model Reference

Canonical shapes for core data types in ArbMVP. Use this to avoid field name mismatches.

---

## Event

Represents a unique game being tracked.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | string | ✓ | Format: `YYYY-MM-DD_Team1_vs_Team2` |
| `sport` | string | ✓ | e.g., `"nfl"`, `"nba"` |
| `home_team` | string | ✓ | Normalized team name |
| `away_team` | string | ✓ | Normalized team name |
| `start_time` | ISO string | | Game start time |
| `created_at` | ISO string | | DB auto-generated |

```json
{
  "event_id": "2025-12-04_Dallas_Cowboys_vs_Detroit_Lions",
  "sport": "nfl",
  "home_team": "Detroit Lions",
  "away_team": "Dallas Cowboys",
  "start_time": "2025-12-04T20:15:00.000Z"
}
```

---

## OddsSnapshot

A point-in-time odds record from a sportsbook.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | string | ✓ | References `events.event_id` |
| `book` | string | ✓ | e.g., `"draftkings"`, `"betmgm"`, `"espnbet"` |
| `market_type` | string | ✓ | `"moneyline"`, `"spread"`, `"total"` |
| `side` | string | ✓ | `"home"`, `"away"`, `"over"`, `"under"` |
| `price` | number | ✓ | American odds (e.g., `-110`, `+150`) |
| `line` | number | | Spread/total value; `null` for moneyline |
| `created_at` | ISO string | | DB auto-generated |

```json
{
  "event_id": "2025-12-04_Dallas_Cowboys_vs_Detroit_Lions",
  "book": "draftkings",
  "market_type": "spread",
  "side": "home",
  "price": -110,
  "line": -3.5,
  "created_at": "2025-12-04T18:30:00.000Z"
}
```

---

## LineChange

Tracks a price or line movement. **DB column is `detected_at`, not `created_at`.**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | string | ✓ | References `events.event_id` |
| `book` | string | ✓ | Sportsbook identifier |
| `market_type` | string | ✓ | `"moneyline"`, `"spread"`, `"total"` |
| `side` | string | ✓ | `"home"`, `"away"`, `"over"`, `"under"` |
| `old_price` | number | ✓ | Previous American odds |
| `new_price` | number | ✓ | New American odds |
| `old_line` | number | | Previous line value (null for ML) |
| `new_line` | number | | New line value (null for ML) |
| `change_type` | string | ✓ | `"price_up"`, `"price_down"`, `"line_move"`, `"juice_move"` |
| `detected_at` | ISO string | ✓ | **⚠️ NOT `created_at`** |

```json
{
  "event_id": "2025-12-04_Dallas_Cowboys_vs_Detroit_Lions",
  "book": "draftkings",
  "market_type": "spread",
  "side": "home",
  "old_price": -110,
  "new_price": -115,
  "old_line": -3.5,
  "new_line": -3.5,
  "change_type": "price_down",
  "detected_at": "2025-12-04T18:45:00.000Z"
}
```

---

## LatencyMetric

Per-book latency stats written to `logs/latency-metrics.jsonl`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `book` | string | ✓ | Sportsbook identifier |
| `windowCount` | number | ✓ | Number of windows analyzed |
| `fractionFirstToMove` | number | ✓ | 0.0–1.0 |
| `fractionLastToMove` | number | ✓ | 0.0–1.0 |
| `avgDelayMsVsFastest` | number | ✓ | Average ms behind fastest book |
| `marketBreakdown` | object | | Per-market stats |
| `timestamp` | ISO string | ✓ | When metric was computed |

```json
{
  "book": "draftkings",
  "windowCount": 42,
  "fractionFirstToMove": 0.45,
  "fractionLastToMove": 0.18,
  "avgDelayMsVsFastest": 350,
  "marketBreakdown": { "moneyline": 15, "spread": 20, "total": 7 },
  "timestamp": "2025-12-04T19:00:00.000Z"
}
```

---

## StaleLineEvent

Logged when a book's line is stale vs. others. Written to `logs/stale-lines.jsonl`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `eventId` | string | ✓ | The game |
| `marketType` | string | ✓ | Market where staleness detected |
| `side` | string | ✓ | Which side |
| `staleBook` | string | ✓ | The lagging book |
| `referenceBook` | string | ✓ | The book that moved most recently |
| `staleDurationMs` | number | ✓ | How long the line was stale |
| `staleStartedAt` | ISO string | ✓ | When stale period began |
| `staleDetectedAt` | ISO string | ✓ | When staleness was detected |
| `timestamp` | ISO string | | When logged |

```json
{
  "eventId": "2025-12-04_Dallas_Cowboys_vs_Detroit_Lions",
  "marketType": "moneyline",
  "side": "home",
  "staleBook": "betmgm",
  "referenceBook": "draftkings",
  "staleDurationMs": 8500,
  "staleStartedAt": "2025-12-04T18:40:00.000Z",
  "staleDetectedAt": "2025-12-04T18:40:08.500Z",
  "timestamp": "2025-12-04T19:00:00.000Z"
}
```

---

## Signal

A tradeable signal generated from latency/stale data. Used for paper trading simulation.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | ✓ | Unique ID: `{type}_{eventId}_{timestamp}` |
| `createdAt` | ISO string | ✓ | When signal was generated |
| `type` | enum | ✓ | `"pure_arb"`, `"stale_vs_book"`, `"latency_edge"` |
| `eventId` | string | ✓ | The game |
| `marketType` | string | ✓ | `"moneyline"`, `"spread"`, `"total"` |
| `side` | string | ✓ | `"home"`, `"away"`, `"over"`, `"under"` |
| `primaryBook` | string | ✓ | Where we'd place the hypothetical bet (fast book) |
| `referenceBook` | string | | For stale comparisons (the slow book) |
| `price` | number | ✓ | American odds at signal time |
| `edgeEstimate` | number | ✓ | Estimated edge as decimal (0.03 = 3%) |
| `confidence` | number | | 0.0–1.0 confidence score |
| `metadata` | object | | Additional context (staleDurationMs, etc.) |

```json
{
  "id": "stale_vs_book_2025-12-04_DAL_vs_DET_1733340000000",
  "createdAt": "2025-12-04T19:00:00.000Z",
  "type": "stale_vs_book",
  "eventId": "2025-12-04_Dallas_Cowboys_vs_Detroit_Lions",
  "marketType": "moneyline",
  "side": "home",
  "primaryBook": "draftkings",
  "referenceBook": "betmgm",
  "price": -110,
  "edgeEstimate": 0.032,
  "confidence": 0.75,
  "metadata": {
    "staleDurationMs": 8500,
    "staleBook": "betmgm"
  }
}
```

**Persistence:** All signals generated by `npm run signals:analyze` are appended to `logs/signals.jsonl` for offline study and historical analysis. Each persisted entry includes an additional `persistedAt` timestamp.

---

## Quick Reference: Key Field Names

| Table/Type | Timestamp Column |
|------------|------------------|
| `events` | `created_at` |
| `odds_snapshots` | `created_at` |
| `line_changes` | **`detected_at`** ⚠️ |
| `edges` | `created_at` |
| LatencyMetric (JSONL) | `timestamp` |
| StaleLineEvent (JSONL) | `timestamp` |
| Signal | `createdAt` |
| Signal (persisted) | `persistedAt` |

