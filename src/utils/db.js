// src/utils/db.js
const { Pool } = require('pg');
const config = require('../../config');

let pool = null;

/**
 * Connect to PostgreSQL database
 */
async function connect() {
  if (pool) {
    console.log('⚠️  Database already connected');
    return;
  }

  if (!config.database?.enabled) {
    console.log('⚠️  Database disabled in config');
    return;
  }

  try {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name
    });

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    pool = null;
    throw error;
  }
}

/**
 * Close database connection
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database connection closed');
  }
}

/**
 * Insert odds snapshots
 */
async function insertOddsSnapshots(snapshots) {
  if (!pool) {
    throw new Error('Database not connected');
  }

  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return;
  }

  try {
    const values = [];
    const placeholders = [];
    
    snapshots.forEach((snapshot, idx) => {
      const offset = idx * 8;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`
      );
      
      values.push(
        snapshot.eventId,
        snapshot.book,
        snapshot.marketType,
        snapshot.side,
        snapshot.line || null,
        snapshot.price,
        snapshot.scrapedAt,
        snapshot.detectedAt || new Date()
      );
    });

    const query = `
      INSERT INTO odds_snapshots (event_id, book, market_type, side, line, price, scraped_at, detected_at)
      VALUES ${placeholders.join(', ')}
    `;

    await pool.query(query, values);
  } catch (error) {
    console.error('Error inserting odds snapshots:', error.message);
    throw error;
  }
}

/**
 * Insert line changes
 */
async function insertLineChanges(changes) {
  if (!pool) {
    throw new Error('Database not connected');
  }

  if (!Array.isArray(changes) || changes.length === 0) {
    return;
  }

  try {
    const values = [];
    const placeholders = [];
    
    changes.forEach((change, idx) => {
      const offset = idx * 10;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`
      );
      
      values.push(
        change.eventId,
        change.book,
        change.marketType,
        change.side,
        change.oldLine || null,
        change.line || null,
        change.oldPrice,
        change.price,
        change.changeType,
        change.detectedAt || new Date()
      );
    });

    const query = `
      INSERT INTO line_changes (event_id, book, market_type, side, old_line, new_line, old_price, new_price, change_type, detected_at)
      VALUES ${placeholders.join(', ')}
    `;

    await pool.query(query, values);
  } catch (error) {
    console.error('Error inserting line changes:', error.message);
    throw error;
  }
}

/**
 * Insert arbitrage opportunities
 */
async function insertArbitrageOpportunities(opportunities) {
  if (!pool) {
    throw new Error('Database not connected');
  }

  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return;
  }

  try {
    const values = [];
    const placeholders = [];
    
    opportunities.forEach((opp, idx) => {
      const offset = idx * 14;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`
      );
      
      values.push(
        opp.eventId,
        opp.marketType,
        opp.profitMargin,
        opp.totalStake,
        opp.expectedProfit,
        opp.bookA,
        opp.bookB,
        opp.sideA,
        opp.sideB,
        opp.priceA,
        opp.priceB,
        opp.lineA || null,
        opp.lineB || null,
        opp.stakeA,
        opp.stakeB
      );
    });

    const query = `
      INSERT INTO arbitrage_opportunities (
        event_id, market_type, profit_margin, total_stake, expected_profit,
        book_a, book_b, side_a, side_b, price_a, price_b,
        line_a, line_b, stake_a, stake_b
      ) VALUES ${placeholders.join(', ')}
    `;

    await pool.query(query, values);
  } catch (error) {
    console.error('Error inserting arbitrage opportunities:', error.message);
    throw error;
  }
}

/**
 * Execute a raw SQL query
 */
async function query(sql, params = []) {
  if (!pool) {
    throw new Error('Database not connected');
  }

  return pool.query(sql, params);
}

module.exports = {
  connect,
  close,
  insertOddsSnapshots,
  insertLineChanges,
  insertArbitrageOpportunities,
  query,
  get connected() {
    return pool !== null;
  }
};