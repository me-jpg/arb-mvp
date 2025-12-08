# B2B Sports Betting Data API - Deployment Guide

## Quick Start

```bash
# Start the API server
npm run api:start

# Or use the default start command
npm start
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/v1/odds/live/:sport` | Live odds (nfl, nba, mlb, nhl, ncaab, ncaaf) |
| `GET /api/v1/odds/movement/:eventId` | 24h line movement history |
| `GET /api/v1/books/latency` | Book activity metrics |
| `GET /api/v1/events` | Tracked events list |
| `GET /api/v1/edges` | Detected edges/arbitrages |

## Deploy to Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize and deploy
railway init
railway up

# Get your URL
railway domain
```

## Deploy to Render

1. Push code to GitHub
2. Go to render.com → New → Web Service
3. Connect GitHub repo
4. Build: `npm install`
5. Start: `npm start`
6. Deploy

## Environment Variables

```env
PORT=3000
DB_ENABLED=true
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=arbitrage_db
```

## Files Created

- `src/api/server.js` - Express API server
- `docs/API.md` - API documentation
- `landing/index.html` - Landing page

## Test Locally

```bash
# Start server
npm run api:start

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/odds/live/nfl
curl http://localhost:3000/api/v1/books/latency
curl http://localhost:3000/api/v1/events
curl http://localhost:3000/api/v1/edges
```

All endpoints return valid JSON with `{timestamp, count, data}` structure.
