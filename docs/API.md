# Sports Betting Odds API Documentation

## Overview

Real-time sports betting market intelligence API. Built for sharps, syndicates, and serious bettors.

## Base URL

- **Production:** `https://[YOUR-DEPLOYMENT-URL]/api/v1`
- **Local Development:** `http://localhost:3000/api/v1`

## Authentication

Currently in **beta** - no authentication required.

**Rate Limits:**

- 1000 requests/hour per IP
- Header `X-RateLimit-Remaining` shows remaining requests

---

## Endpoints

### Health Check

**Endpoint:** `GET /health`

**Description:** Check API status and database connection.

**Example Request:**

```bash
curl http://localhost:3000/health
```

**Example Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-12-07T21:45:00.000Z",
  "version": "1.0.0",
  "database": "connected"
}
```

---

### 1. Get Live Odds

**Endpoint:** `GET /api/v1/odds/live/{sport}`

**Description:** Returns current odds from all tracked sportsbooks for the specified sport. Data is from the last 5 minutes.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sport` | path | Yes | Sport identifier |

**Valid Sports:** `nfl`, `nba`, `mlb`, `nhl`, `ncaab`, `ncaaf`

**Example Request:**

```bash
curl http://localhost:3000/api/v1/odds/live/nfl
```

**Example Response:**

```json
{
  "sport": "nfl",
  "timestamp": "2025-12-07T21:45:00.000Z",
  "count": 24,
  "data": [
    {
      "book": "draftkings",
      "event_id": "nfl_20251207_dal_phi",
      "sport": "NFL",
      "home_team": "Philadelphia Eagles",
      "away_team": "Dallas Cowboys",
      "market_type": "moneyline",
      "side": "home",
      "line": null,
      "price": -150,
      "timestamp": "2025-12-07T21:44:30.000Z"
    }
  ]
}
```

---

### 2. Get Line Movement History

**Endpoint:** `GET /api/v1/odds/movement/{eventId}`

**Description:** Returns 24-hour line movement history for a specific game across all books.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | path | Yes | Event identifier |

**Example Request:**

```bash
curl http://localhost:3000/api/v1/odds/movement/nfl_20251207_dal_phi
```

**Example Response:**

```json
{
  "eventId": "nfl_20251207_dal_phi",
  "timestamp": "2025-12-07T21:45:00.000Z",
  "count": 15,
  "data": [
    {
      "event_id": "nfl_20251207_dal_phi",
      "book": "draftkings",
      "market_type": "spread",
      "side": "home",
      "old_line": -3.0,
      "new_line": -3.5,
      "old_price": -110,
      "new_price": -115,
      "change_type": "line_move",
      "timestamp": "2025-12-07T14:30:00.000Z"
    }
  ]
}
```

---

### 3. Get Book Latency Metrics

**Endpoint:** `GET /api/v1/books/latency`

**Description:** Returns activity metrics for all tracked sportsbooks from the last hour. Shows which books are most active.

**Example Request:**

```bash
curl http://localhost:3000/api/v1/books/latency
```

**Example Response:**

```json
{
  "timestamp": "2025-12-07T21:45:00.000Z",
  "count": 4,
  "data": [
    {
      "book": "draftkings",
      "sample_count": 145,
      "events_tracked": 12,
      "last_updated": "2025-12-07T21:44:00.000Z"
    },
    {
      "book": "fanduel",
      "sample_count": 138,
      "events_tracked": 11,
      "last_updated": "2025-12-07T21:43:30.000Z"
    }
  ]
}
```

---

### 4. Get Tracked Events

**Endpoint:** `GET /api/v1/events`

**Description:** Returns all tracked sporting events.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sport` | query | No | all | Filter by sport |
| `limit` | query | No | 50 | Max results to return |

**Example Request:**

```bash
curl "http://localhost:3000/api/v1/events?sport=nfl&limit=10"
```

**Example Response:**

```json
{
  "timestamp": "2025-12-07T21:45:00.000Z",
  "count": 10,
  "data": [
    {
      "event_id": "nfl_20251207_dal_phi",
      "sport": "NFL",
      "home_team": "Philadelphia Eagles",
      "away_team": "Dallas Cowboys",
      "start_time": "2025-12-08T01:00:00.000Z",
      "created_at": "2025-12-07T12:00:00.000Z",
      "updated_at": "2025-12-07T21:44:00.000Z"
    }
  ]
}
```

---

### 5. Get Detected Edges

**Endpoint:** `GET /api/v1/edges`

**Description:** Returns detected edges and arbitrage opportunities.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `minEdge` | query | No | 0 | Minimum edge percentage |
| `limit` | query | No | 100 | Max results to return |

**Example Request:**

```bash
curl "http://localhost:3000/api/v1/edges?minEdge=0.5&limit=50"
```

**Example Response:**

```json
{
  "timestamp": "2025-12-07T21:45:00.000Z",
  "count": 5,
  "data": [
    {
      "event_id": "nfl_20251207_dal_phi",
      "market_type": "moneyline",
      "line": null,
      "book_a": "draftkings",
      "book_b": "fanduel",
      "edge_percent": -1.25,
      "is_arbitrage": true,
      "timestamp": "2025-12-07T21:40:00.000Z",
      "home_team": "Philadelphia Eagles",
      "away_team": "Dallas Cowboys",
      "sport": "NFL"
    }
  ]
}
```

---

## Response Format

All responses follow this structure:

**Success (HTTP 200):**

```json
{
  "timestamp": "ISO 8601 timestamp",
  "count": "number of items",
  "data": "array of items"
}
```

**Error (HTTP 4xx/5xx):**

```json
{
  "error": "Error message description"
}
```

---

## Current Coverage

| Category | Values |
|----------|--------|
| **Sportsbooks** | DraftKings, FanDuel, BetMGM, ESPN Bet |
| **Sports** | NFL, NBA, MLB, NHL, NCAAB, NCAAF |
| **Markets** | Moneyline, Spread, Totals |
| **Update Frequency** | Every 30-60 seconds |

More sportsbooks and markets coming soon based on user feedback.

---

## Error Codes

| HTTP Code | Description |
|-----------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Endpoint doesn't exist |
| 500 | Internal Server Error |

---

## Support

Questions? Contact us at: [YOUR-EMAIL]

---

## Changelog

### v1.0.0 (2025-12-07)

- Initial release
- Live odds endpoint
- Line movement history endpoint
- Book latency metrics endpoint
- Events listing endpoint
- Edges/arbitrage detection endpoint
