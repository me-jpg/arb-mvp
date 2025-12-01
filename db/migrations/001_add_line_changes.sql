-- Migration: Add line_changes table
-- Run this if you already have the database set up from Phase 1

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