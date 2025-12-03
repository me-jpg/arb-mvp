-- migrations/add-arbitrage-opportunities.sql
-- Add arbitrage opportunities table for Phase 1+2 integration

CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  profit_margin DECIMAL(5,2) NOT NULL,
  total_stake DECIMAL(10,2) NOT NULL,
  expected_profit DECIMAL(10,2) NOT NULL,
  book_a VARCHAR(50) NOT NULL,
  book_b VARCHAR(50) NOT NULL,
  side_a VARCHAR(20) NOT NULL,
  side_b VARCHAR(20) NOT NULL,
  price_a INTEGER NOT NULL,
  price_b INTEGER NOT NULL,
  line_a DECIMAL(5,2),
  line_b DECIMAL(5,2),
  stake_a DECIMAL(10,2) NOT NULL,
  stake_b DECIMAL(10,2) NOT NULL,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_arb_opportunities_detected ON arbitrage_opportunities(detected_at DESC);
CREATE INDEX idx_arb_opportunities_event ON arbitrage_opportunities(event_id);
CREATE INDEX idx_arb_opportunities_margin ON arbitrage_opportunities(profit_margin DESC);
CREATE INDEX idx_arb_opportunities_market ON arbitrage_opportunities(market_type);

-- Add comment
COMMENT ON TABLE arbitrage_opportunities IS 'Stores detected arbitrage opportunities with stake calculations';