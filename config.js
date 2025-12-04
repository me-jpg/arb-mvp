// config.js
// Configuration for ARB MVP - 4 Book System

module.exports = {
  // Arbitrage detection settings
  minProfitMargin: 0.5,  // ⬅️ CHANGED from 1.5 to 0.5 to catch smaller arbitrages
  totalStake: 1000,
  
  // Scraping settings
  scrapeInterval: 60,     // seconds between cycles
  headless: true,         // run browsers in headless mode
  staleThreshold: 120,    // seconds - lines older than this are considered stale (2 minutes)
  
  // Book URLs (for reference)
  books: {
    draftkings: 'https://sportsbook.draftkings.com/leagues/football/nfl',
    betmgm: 'https://sports.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35',
    espnbet: 'https://espnbet.com/sport/american-football/organization/usa/competition/nfl'
  },
  
  // Alert settings
  discord: {
    enabled: true,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL
  },
  
  sheets: {
    enabled: false,  // Disabled for now
    spreadsheetId: process.env.SPREADSHEET_ID
  },
  
  // Database configuration
  database: {
    enabled: process.env.DB_ENABLED === 'true' || false,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'arbitrage_db'
  },
  
  // Path to Google service account credentials JSON file
  sheetsCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-credentials.json',
  
  // High-frequency tracking configuration
  highFrequency: {
    enabled: process.env.HF_ENABLED === 'true' || false,
    // Interval between cycles - realistically 20s+ with 3 books and Puppeteer
    // Typical cycle: scraping ~15-18s (parallel), arb engine <10ms, DB <100ms
    intervalMs: parseInt(process.env.HF_INTERVAL_MS || '20000'), // 20 seconds (realistic default)
    maxEvents: parseInt(process.env.HF_MAX_EVENTS || '6'), // Track top 6 games per book (reduced for speed)
    markets: ['moneyline', 'spread', 'total'], // Which markets to track
    books: ['draftkings', 'betmgm', 'espnbet'], // Which books to track
    
    // HF-specific arbitrage threshold (separate from Phase 1 minProfitMargin)
    // Set to 0 to see ALL positive edges, or e.g. 0.5 for 0.5% minimum
    arbitrageMinEdgePercent: parseFloat(process.env.HF_MIN_EDGE_PERCENT || '0.0'),
    
    // Performance instrumentation
    debugTimings: process.env.HF_DEBUG_TIMINGS === 'true' || false,
    
    // Health monitoring: warn if utilization exceeds this threshold for N consecutive cycles
    maxUtilizationWarning: parseFloat(process.env.HF_MAX_UTILIZATION || '1.5'), // 150%
    utilizationWarnCycles: parseInt(process.env.HF_UTIL_WARN_CYCLES || '3')
  },
  
  // Phase 3: Latency & stale line analytics
  latency: {
    enabled: process.env.LATENCY_ENABLED === 'true' || false,
    windowMs: parseInt(process.env.LATENCY_WINDOW_MS || '30000'), // 30 second windows
    intervalMs: parseInt(process.env.LATENCY_ANALYZER_INTERVAL_MS || '60000'), // Analyze every 60s
    staleThresholdMs: parseInt(process.env.STALE_LINE_THRESHOLD_MS || '60000'), // 60s stale threshold
    minWindowsPerBook: parseInt(process.env.LATENCY_MIN_WINDOWS_PER_BOOK || '5') // Min windows to qualify
  },
  
  // Phase 4: Real-time dashboard
  dashboard: {
    enabled: process.env.DASHBOARD_ENABLED === 'true' || true,
    port: parseInt(process.env.DASHBOARD_PORT || '8787')
  }
};