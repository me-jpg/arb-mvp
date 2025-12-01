// src/utils/db.js
// PostgreSQL database connection and operations

const { Pool } = require('pg');
const config = require('../../config');

class Database {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    if (!config.database.enabled) {
      console.log('ℹ️  Database disabled in config');
      return false;
    }

    try {
      this.pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.connected = true;
      console.log('✅ Database connected');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      this.connected = false;
      return false;
    }
  }

  /**
   * Upsert event
   */
  async upsertEvent(event) {
    if (!this.connected) return;

    try {
      const query = `
        INSERT INTO events (event_id, sport, home_team, away_team, start_time)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_id) 
        DO UPDATE SET 
          start_time = EXCLUDED.start_time,
          updated_at = CURRENT_TIMESTAMP
      `;

      await this.pool.query(query, [
        event.eventId,
        event.sport || 'NFL',
        event.homeTeam,
        event.awayTeam,
        event.startTime || null
      ]);
    } catch (error) {
      console.error(`DB Error upserting event ${event.eventId}:`, error.message);
    }
  }

  /**
   * Bulk upsert events
   */
  async upsertEvents(events) {
    if (!this.connected || !events.length) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const event of events) {
        const query = `
          INSERT INTO events (event_id, sport, home_team, away_team, start_time)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (event_id) 
          DO UPDATE SET 
            start_time = EXCLUDED.start_time,
            updated_at = CURRENT_TIMESTAMP
        `;

        await client.query(query, [
          event.eventId,
          event.sport || 'NFL',
          event.homeTeam,
          event.awayTeam,
          event.startTime || null
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('DB Error bulk upserting events:', error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Bulk insert odds snapshots
   */
  async insertOddsSnapshots(snapshots) {
    if (!this.connected || !snapshots.length) return;

    const client = await this.pool.connect();
    try {
      // Build bulk insert
      const values = [];
      const params = [];
      let paramCount = 1;

      for (const snapshot of snapshots) {
        values.push(
          `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5})`
        );
        params.push(
          snapshot.eventId,
          snapshot.book,
          snapshot.marketType,
          snapshot.line,
          snapshot.side,
          snapshot.price
        );
        paramCount += 6;
      }

      const query = `
        INSERT INTO odds_snapshots (event_id, book, market_type, line, side, price)
        VALUES ${values.join(', ')}
      `;

      await client.query(query, params);
    } catch (error) {
      console.error('DB Error inserting odds snapshots:', error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Bulk insert edges
   */
  async insertEdges(edges) {
    if (!this.connected || !edges.length) return;

    const client = await this.pool.connect();
    try {
      // Build bulk insert
      const values = [];
      const params = [];
      let paramCount = 1;

      for (const edge of edges) {
        values.push(
          `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6})`
        );
        params.push(
          edge.eventId,
          edge.marketType,
          edge.line,
          edge.bookA,
          edge.bookB,
          edge.edgePercent,
          edge.isArbitrage
        );
        paramCount += 7;
      }

      const query = `
        INSERT INTO edges (event_id, market_type, line, book_a, book_b, edge_percent, is_arbitrage)
        VALUES ${values.join(', ')}
      `;

      await client.query(query, params);
    } catch (error) {
      console.error('DB Error inserting edges:', error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Bulk insert line changes
   */
  async insertLineChanges(changes) {
    if (!this.connected || !changes.length) return;

    const client = await this.pool.connect();
    try {
      // Build bulk insert
      const values = [];
      const params = [];
      let paramCount = 1;

      for (const change of changes) {
        values.push(
          `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7}, $${paramCount + 8})`
        );
        params.push(
          change.eventId,
          change.book,
          change.marketType,
          change.side,
          change.oldLine || null,
          change.newLine || null,
          change.oldPrice,
          change.newPrice,
          change.changeType
        );
        paramCount += 9;
      }

      const query = `
        INSERT INTO line_changes (event_id, book, market_type, side, old_line, new_line, old_price, new_price, change_type)
        VALUES ${values.join(', ')}
      `;

      await client.query(query, params);
    } catch (error) {
      console.error('DB Error inserting line changes:', error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      console.log('✅ Database connection closed');
    }
  }
}

module.exports = new Database();