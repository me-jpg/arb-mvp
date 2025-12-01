-- Database schema for arbitrage detection system
-- Run this to initialize the database

-- Events table: unique games being tracked
CREATE TABLE IF NOT EXISTS events (
    event_id VARCHAR(255) PRIMARY KEY,
    sport VARCHAR(50) NOT NULL,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    start_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_sport ON events(sport);
CREATE INDEX idx_events_start_time ON events(start_time);

-- Odds snapshots: historical odds data
CREATE TABLE IF NOT EXISTS odds_snapshots (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    book VARCHAR(50) NOT NULL,
    market_type VARCHAR(50) NOT NULL,
    line NUMERIC(10, 2),  -- NULL for moneyline, value for spread/total
    side VARCHAR(20) NOT NULL,  -- home, away, over, under
    price INTEGER NOT NULL,  -- American odds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_odds_event_id ON odds_snapshots(event_id);
CREATE INDEX idx_odds_book ON odds_snapshots(book);
CREATE INDEX idx_odds_created_at ON odds_snapshots(created_at);
CREATE INDEX idx_odds_composite ON odds_snapshots(event_id, book, market_type);

-- Edges: detected opportunities (including non-arbs)
CREATE TABLE IF NOT EXISTS edges (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    market_type VARCHAR(50) NOT NULL,
    line NUMERIC(10, 2),  -- The line value (spread/total)
    book_a VARCHAR(50) NOT NULL,
    book_b VARCHAR(50) NOT NULL,
    edge_percent NUMERIC(10, 4) NOT NULL,  -- Negative = arbitrage
    is_arbitrage BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_edges_event_id ON edges(event_id);
CREATE INDEX idx_edges_is_arbitrage ON edges(is_arbitrage);
CREATE INDEX idx_edges_edge_percent ON edges(edge_percent);
CREATE INDEX idx_edges_created_at ON edges(created_at);

-- Line changes: track price/line movements over time
CREATE TABLE IF NOT EXISTS line_changes (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    book VARCHAR(50) NOT NULL,
    market_type VARCHAR(50) NOT NULL,
    side VARCHAR(20) NOT NULL,  -- home, away, over, under
    old_line NUMERIC(10, 2),  -- NULL for moneyline, previous line for spread/total
    new_line NUMERIC(10, 2),  -- NULL for moneyline, new line for spread/total
    old_price INTEGER NOT NULL,  -- Previous American odds
    new_price INTEGER NOT NULL,  -- New American odds
    change_type VARCHAR(30) NOT NULL,  -- price_up, price_down, line_move, juice_move
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_line_changes_event_id ON line_changes(event_id);
CREATE INDEX idx_line_changes_book ON line_changes(book);
CREATE INDEX idx_line_changes_created_at ON line_changes(created_at);
CREATE INDEX idx_line_changes_composite ON line_changes(event_id, book, market_type, created_at);
CREATE INDEX idx_line_changes_type ON line_changes(change_type);

-- View for easy arbitrage querying
CREATE OR REPLACE VIEW arbitrages AS
SELECT 
    e.*,
    ev.sport,
    ev.home_team,
    ev.away_team,
    ev.start_time
FROM edges e
JOIN events ev ON e.event_id = ev.event_id
WHERE e.is_arbitrage = TRUE
ORDER BY e.created_at DESC;