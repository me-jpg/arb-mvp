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

  // Check if database is enabled (via DATABASE_URL or config)
  const databaseUrl = process.env.DATABASE_URL;
  const dbEnabled = databaseUrl || config.database?.enabled;

  if (!dbEnabled) {
    console.log('⚠️  Database disabled in config');
    return;
  }

  try {
    // Use DATABASE_URL if available (Railway standard), otherwise use config
    if (databaseUrl) {
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      console.log('✅ Connecting to database via DATABASE_URL');
    } else {
      pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name
      });
      console.log('✅ Connecting to database via config params');
    }

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
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
      const offset = idx * 7;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
      );

      values.push(
        snapshot.eventId,
        snapshot.book,
        snapshot.marketType,
        snapshot.side,
        snapshot.line || null,
        snapshot.price,
        snapshot.scrapedAt || snapshot.detectedAt || new Date()
      );
    });

    const query = `
      INSERT INTO odds_snapshots (event_id, book, market_type, side, line, price, captured_at)
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
        change.newLine || null,
        change.oldPrice,
        change.newPrice,
        change.changeType,
        change.timestamp ? new Date(change.timestamp) : new Date()
      );
    });

    const query = `
      INSERT INTO line_changes (event_id, book, market_type, side, old_line, new_line, old_price, new_price, change_type, created_at)
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

// ============================================
// API QUERY FUNCTIONS
// ============================================

/**
 * Get latest odds for a specific sport across all books
 * Returns odds from the last 5 minutes
 */
async function getLatestOdds(sport) {
  if (!pool) {
    return [];
  }

  try {
    const result = await pool.query(`
      SELECT 
        os.book,
        os.event_id,
        e.sport,
        e.home_team,
        e.away_team,
        e.start_time,
        os.market_type,
        os.side,
        os.line,
        os.price,
        os.captured_at as timestamp
      FROM odds_snapshots os
      JOIN events e ON os.event_id = e.event_id
      WHERE LOWER(e.sport) = LOWER($1)
      AND os.captured_at > NOW() - INTERVAL '5 minutes'
      ORDER BY os.captured_at DESC, os.book ASC
      LIMIT 500
    `, [sport]);

    return result.rows;
  } catch (error) {
    console.error('Error in getLatestOdds:', error.message);
    return [];
  }
}

/**
 * Get line movement history for a specific event
 * Returns movements from last 24 hours
 */
async function getLineMovements(eventId) {
  if (!pool) {
    return [];
  }

  try {
    // Note: line_changes usually has created_at, make sure that exists. 
    // The previous migration file showed 'created_at'.
    const result = await pool.query(`
      SELECT 
        event_id,
        book,
        market_type,
        side,
        old_line,
        new_line,
        old_price,
        new_price,
        change_type,
        created_at as timestamp
      FROM line_changes 
      WHERE event_id = $1 
      AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at ASC
    `, [eventId]);

    return result.rows;
  } catch (error) {
    console.error('Error in getLineMovements:', error.message);
    return [];
  }
}

/**
 * Get latency metrics per book from last hour
 */
async function getLatencyMetrics() {
  if (!pool) {
    return [];
  }

  try {
    const result = await pool.query(`
      SELECT 
        book,
        COUNT(*) as sample_count,
        COUNT(DISTINCT event_id) as events_tracked,
        MAX(created_at) as last_updated
      FROM line_changes
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY book
      ORDER BY sample_count DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error in getLatencyMetrics:', error.message);
    return [];
  }
}

/**
 * Get tracked events
 */
async function getEvents(sport = null, limit = 50) {
  if (!pool) {
    return [];
  }

  try {
    let sql = `
      SELECT 
        event_id,
        sport,
        home_team,
        away_team,
        start_time,
        created_at,
        updated_at
      FROM events
    `;

    const params = [];
    if (sport) {
      sql += ` WHERE LOWER(sport) = LOWER($1)`;
      params.push(sport);
    }

    sql += ` ORDER BY start_time DESC LIMIT ${parseInt(limit)}`;

    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error in getEvents:', error.message);
    return [];
  }
}

/**
 * Upsert event (insert or update)
 */
async function upsertEvent(event) {
  if (!pool) {
    throw new Error('Database not connected');
  }

  try {
    const query = `
      INSERT INTO events (event_id, sport, home_team, away_team, start_time, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (event_id) 
      DO UPDATE SET 
        start_time = EXCLUDED.start_time,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      event.eventId,
      event.sport,
      event.homeTeam,
      event.awayTeam,
      event.startTime ? new Date(event.startTime) : null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error in upsertEvent:', error.message);
    throw error;
  }
}

/**
 * Get detected edges/arbitrages
 */
async function getEdges(minEdge = 0, limit = 100) {
  if (!pool) {
    return [];
  }

  try {
    const result = await pool.query(`
      SELECT 
        ed.event_id,
        ed.market_type,
        ed.line,
        ed.book_a,
        ed.book_b,
        ed.edge_percent,
        ed.is_arbitrage,
        ed.created_at as timestamp,
        e.home_team,
        e.away_team,
        e.sport
      FROM edges ed
      JOIN events e ON ed.event_id = e.event_id
      WHERE ABS(ed.edge_percent) >= $1
      ORDER BY ed.created_at DESC
      LIMIT $2
    `, [minEdge, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error in getEdges:', error.message);
    return [];
  }
}

/**
 * Get historical odds for backtesting
 */
async function getHistoricalOdds(sport, startDate, endDate, limit = 1000) {
  if (!pool) {
    return [];
  }

  try {
    const result = await pool.query(`
      SELECT 
        os.book,
        os.event_id,
        e.sport,
        e.home_team,
        e.away_team,
        e.start_time,
        os.market_type,
        os.side,
        os.line,
        os.price,
        os.captured_at as timestamp
      FROM odds_snapshots os
      JOIN events e ON os.event_id = e.event_id
      WHERE LOWER(e.sport) = LOWER($1)
      AND os.captured_at BETWEEN $2 AND $3
      ORDER BY os.captured_at DESC
      LIMIT $4
    `, [sport, startDate, endDate, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error in getHistoricalOdds:', error.message);
    return [];
  }
}

module.exports = {
  connect,
  close,
  insertOddsSnapshots,
  insertLineChanges,
  insertArbitrageOpportunities,
  query,
  // API functions
  getLatestOdds,
  getLineMovements,
  getLatencyMetrics,
  getEvents,
  upsertEvent,
  getEdges,
  getHistoricalOdds,
  get connected() {
    return pool !== null;
  }
};