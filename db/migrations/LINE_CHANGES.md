# Line Changes Tracking - Phase 2

## Overview

The `line_changes` table tracks all price and line movements across sportsbooks in real-time, enabling:
- Latency analysis (which book moves first)
- Stale line detection (delays between book updates)
- Market efficiency measurement
- Historical volatility analysis

## Database Schema

### line_changes Table

```sql
CREATE TABLE line_changes (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) REFERENCES events(event_id),
    book VARCHAR(50),
    market_type VARCHAR(50),  -- moneyline, spread, total
    side VARCHAR(20),          -- home, away, over, under
    old_line NUMERIC(10, 2),   -- Previous line (NULL for moneyline)
    new_line NUMERIC(10, 2),   -- New line (NULL for moneyline)
    old_price INTEGER,         -- Previous American odds
    new_price INTEGER,         -- New American odds
    change_type VARCHAR(30),   -- Type of change (see below)
    created_at TIMESTAMP
);
```

### Change Types

| Type | Description | Example |
|------|-------------|---------|
| `price_up` | Price increased (less favorable) | -110 → -115 |
| `price_down` | Price decreased (more favorable) | -110 → -105 |
| `line_move` | Line changed, price same/similar | Spread -7 → -7.5 |
| `juice_move` | Line same, significant price change | -110 → -120 on same line |

### Indexes

- `event_id` - Fast lookup by game
- `book` - Filter by sportsbook
- `created_at` - Time-series queries
- `(event_id, book, market_type, created_at)` - Composite for analytics
- `change_type` - Filter by movement type

## API Usage

### Insert Line Changes

```javascript
const db = require('./src/utils/db');

const changes = [
  {
    eventId: '2025-12-01_Team_A_vs_Team_B',
    book: 'draftkings',
    marketType: 'moneyline',
    side: 'home',
    oldLine: null,
    newLine: null,
    oldPrice: -110,
    newPrice: -115,
    changeType: 'price_down'
  },
  {
    eventId: '2025-12-01_Team_A_vs_Team_B',
    book: 'fanduel',
    marketType: 'spread',
    side: 'away',
    oldLine: -7.0,
    newLine: -7.5,
    oldPrice: -110,
    newPrice: -110,
    changeType: 'line_move'
  }
];

await db.insertLineChanges(changes);
```

### Query Examples

**Find all changes for an event:**
```sql
SELECT * FROM line_changes
WHERE event_id = '2025-12-01_Team_A_vs_Team_B'
ORDER BY created_at DESC;
```

**Find price movements in last hour:**
```sql
SELECT * FROM line_changes
WHERE created_at > NOW() - INTERVAL '1 hour'
AND change_type IN ('price_up', 'price_down')
ORDER BY created_at DESC;
```

**Book latency analysis:**
```sql
-- Which book moved first for each event?
SELECT DISTINCT ON (event_id, market_type)
    event_id,
    market_type,
    book,
    created_at as first_move_time
FROM line_changes
ORDER BY event_id, market_type, created_at ASC;
```

**Average delay between books:**
```sql
WITH first_moves AS (
  SELECT DISTINCT ON (event_id, market_type)
    event_id,
    market_type,
    created_at as first_time
  FROM line_changes
  ORDER BY event_id, market_type, created_at ASC
),
subsequent_moves AS (
  SELECT 
    lc.event_id,
    lc.market_type,
    lc.book,
    lc.created_at,
    fm.first_time
  FROM line_changes lc
  JOIN first_moves fm 
    ON lc.event_id = fm.event_id 
    AND lc.market_type = fm.market_type
  WHERE lc.created_at > fm.first_time
)
SELECT 
  book,
  AVG(EXTRACT(EPOCH FROM (created_at - first_time))) as avg_delay_seconds
FROM subsequent_moves
GROUP BY book
ORDER BY avg_delay_seconds ASC;
```

## Migration

If you already have the database from Phase 1:

```bash
psql -U arb_user -d arbitrage_db -f db/migrations/001_add_line_changes.sql
```

If setting up fresh:

```bash
psql -U arb_user -d arbitrage_db -f db/schema.sql
```

## Testing

Run the test suite:

```bash
node tests/db/test-line-changes.js
```

Expected output:
```
🧪 Testing line_changes table...

1. Creating test event...
   ✅ Test event created

2. Inserting test line changes...
   Changes to insert: 3
   ✅ Line changes inserted

3. Verifying inserted data...
   Rows found: 3

   Sample row:
   - Book: draftkings
   - Market: moneyline
   - Side: home
   - Old Price: -110
   - New Price: -115
   - Change Type: price_down
   - Created: 2025-11-30T...

4. Testing with empty array...
   ✅ No errors with empty array

✅ All tests passed!
   Total line changes inserted: 3
   Total rows in table: 3
```

## Next Steps (Phase 2 Continued)

1. Build high-frequency scraper (5-10s intervals)
2. Implement delta detection logic
3. Add in-memory cache for previous odds state
4. Create change classification algorithm
5. Build latency analytics dashboard