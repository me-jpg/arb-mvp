// src/db/migrate-postgres.js
// PostgreSQL database migration script
// Creates all necessary tables and indexes for LineStream API

const { Pool } = require('pg');

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.log('Usage: DATABASE_URL=postgresql://... node src/db/migrate-postgres.js');
    process.exit(1);
}

console.log('🔄 Starting PostgreSQL migration...');
console.log(`📍 Connecting to: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

// Create connection pool
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();

    try {
        // Start transaction
        await client.query('BEGIN');
        console.log('✅ Transaction started');

        // ==========================================
        // TABLE 1: EVENTS
        // ==========================================
        console.log('\n📊 Creating events table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        event_id VARCHAR(255) PRIMARY KEY,
        sport VARCHAR(50) NOT NULL,
        home_team VARCHAR(100) NOT NULL,
        away_team VARCHAR(100) NOT NULL,
        start_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Events table created');

        // Events indexes
        console.log('   Creating indexes for events...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_events_sport ON events(sport)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time)');
        console.log('   ✅ Events indexes created');

        // ==========================================
        // TABLE 2: ODDS_SNAPSHOTS
        // ==========================================
        console.log('\n📊 Creating odds_snapshots table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS odds_snapshots (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        book VARCHAR(50) NOT NULL,
        market_type VARCHAR(50) NOT NULL,
        side VARCHAR(20) NOT NULL,
        line NUMERIC(10, 2),
        price INTEGER NOT NULL,
        captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Odds_snapshots table created');

        // Odds_snapshots indexes
        console.log('   Creating indexes for odds_snapshots...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_odds_event_id ON odds_snapshots(event_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_odds_book ON odds_snapshots(book)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_odds_captured_at ON odds_snapshots(captured_at)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_odds_composite ON odds_snapshots(event_id, book, market_type)');
        console.log('   ✅ Odds_snapshots indexes created');

        // ==========================================
        // TABLE 3: LINE_CHANGES
        // ==========================================
        console.log('\n📊 Creating line_changes table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS line_changes (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        book VARCHAR(50) NOT NULL,
        market_type VARCHAR(50) NOT NULL,
        side VARCHAR(20) NOT NULL,
        old_line NUMERIC(10, 2),
        new_line NUMERIC(10, 2),
        old_price INTEGER NOT NULL,
        new_price INTEGER NOT NULL,
        change_type VARCHAR(30) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Line_changes table created');

        // Line_changes indexes
        console.log('   Creating indexes for line_changes...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_line_changes_event_id ON line_changes(event_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_line_changes_book ON line_changes(book)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_line_changes_created_at ON line_changes(created_at)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_line_changes_composite ON line_changes(event_id, book, market_type, created_at)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_line_changes_type ON line_changes(change_type)');
        console.log('   ✅ Line_changes indexes created');

        // ==========================================
        // TABLE 4: EDGES
        // ==========================================
        console.log('\n📊 Creating edges table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS edges (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        market_type VARCHAR(50) NOT NULL,
        line NUMERIC(10, 2),
        book_a VARCHAR(50) NOT NULL,
        book_b VARCHAR(50) NOT NULL,
        edge_percent NUMERIC(10, 4) NOT NULL,
        is_arbitrage BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Edges table created');

        // Edges indexes
        console.log('   Creating indexes for edges...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_edges_event_id ON edges(event_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_edges_is_arbitrage ON edges(is_arbitrage)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_edges_edge_percent ON edges(edge_percent)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_edges_created_at ON edges(created_at)');
        console.log('   ✅ Edges indexes created');

        // ==========================================
        // TABLE 5: ARBITRAGE_OPPORTUNITIES
        // ==========================================
        console.log('\n📊 Creating arbitrage_opportunities table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        market_type VARCHAR(50) NOT NULL,
        profit_margin NUMERIC(5, 2) NOT NULL,
        total_stake NUMERIC(10, 2) NOT NULL,
        expected_profit NUMERIC(10, 2) NOT NULL,
        book_a VARCHAR(50) NOT NULL,
        book_b VARCHAR(50) NOT NULL,
        side_a VARCHAR(20) NOT NULL,
        side_b VARCHAR(20) NOT NULL,
        price_a INTEGER NOT NULL,
        price_b INTEGER NOT NULL,
        line_a NUMERIC(5, 2),
        line_b NUMERIC(5, 2),
        stake_a NUMERIC(10, 2) NOT NULL,
        stake_b NUMERIC(10, 2) NOT NULL,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Arbitrage_opportunities table created');

        // Arbitrage_opportunities indexes
        console.log('   Creating indexes for arbitrage_opportunities...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_arb_opportunities_detected ON arbitrage_opportunities(detected_at DESC)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_arb_opportunities_event ON arbitrage_opportunities(event_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_arb_opportunities_margin ON arbitrage_opportunities(profit_margin DESC)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_arb_opportunities_market ON arbitrage_opportunities(market_type)');
        console.log('   ✅ Arbitrage_opportunities indexes created');

        // ==========================================
        // TABLE 6: LATENCY_LOGS
        // ==========================================
        console.log('\n📊 Creating latency_logs table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS latency_logs (
        id SERIAL PRIMARY KEY,
        book VARCHAR(50) NOT NULL,
        event_id VARCHAR(255),
        scrape_duration_ms INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Latency_logs table created');

        // Latency_logs indexes
        console.log('   Creating indexes for latency_logs...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_latency_logs_book ON latency_logs(book)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_latency_logs_timestamp ON latency_logs(timestamp)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_latency_logs_event_id ON latency_logs(event_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_latency_logs_status ON latency_logs(status)');
        console.log('   ✅ Latency_logs indexes created');

        // ==========================================
        // VIEWS
        // ==========================================
        console.log('\n👁️  Creating arbitrages view...');
        await client.query(`
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
      ORDER BY e.created_at DESC
    `);
        console.log('✅ Arbitrages view created');

        // Commit transaction
        await client.query('COMMIT');
        console.log('\n✅ Transaction committed successfully');

        // ==========================================
        // VERIFY TABLES EXIST
        // ==========================================
        console.log('\n🔍 Verifying tables...');
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

        console.log(`\n📋 Tables created (${result.rows.length}):`);
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        // ==========================================
        // VERIFY INDEXES
        // ==========================================
        const indexResult = await client.query(`
      SELECT 
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

        console.log(`\n📊 Indexes created (${indexResult.rows.length}):`);
        let currentTable = '';
        indexResult.rows.forEach(row => {
            if (row.tablename !== currentTable) {
                currentTable = row.tablename;
                console.log(`\n   ${currentTable}:`);
            }
            console.log(`      ✓ ${row.indexname}`);
        });

        console.log('\n\n🎉 Migration completed successfully!');
        console.log('✅ All tables and indexes are ready');
        console.log('✅ Database is ready for production use');

    } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error('\n❌ Migration failed! Transaction rolled back.');
        console.error('Error:', error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        throw error;
    } finally {
        client.release();
    }
}

// Run migration and handle exit
runMigration()
    .then(() => {
        console.log('\n✅ Migration script completed');
        pool.end();
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Migration script failed');
        console.error(error);
        pool.end();
        process.exit(1);
    });
