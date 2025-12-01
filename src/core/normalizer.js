// src/core/normalizer.js
// Enhanced normalizer: team names + dates + multi-market matching

const { extractMarkets } = require('./marketNormalizer');

const TEAM_MAPPINGS = {
  // DraftKings Specific Formats (exact match - these come first for priority)
  'la rams': 'Los Angeles Rams',
  'la chargers': 'Los Angeles Chargers',
  'ny jets': 'New York Jets',
  'ny giants': 'New York Giants',
  'no saints': 'New Orleans Saints',
  'sf 49ers': 'San Francisco 49ers',
  'ne patriots': 'New England Patriots',
  'tb buccaneers': 'Tampa Bay Buccaneers',
  'kc chiefs': 'Kansas City Chiefs',
  'lv raiders': 'Las Vegas Raiders',
  'gb packers': 'Green Bay Packers',
  'buf bills': 'Buffalo Bills',
  'mia dolphins': 'Miami Dolphins',
  'bal ravens': 'Baltimore Ravens',
  'cin bengals': 'Cincinnati Bengals',
  'cle browns': 'Cleveland Browns',
  'pit steelers': 'Pittsburgh Steelers',
  'hou texans': 'Houston Texans',
  'ind colts': 'Indianapolis Colts',
  'jax jaguars': 'Jacksonville Jaguars',
  'ten titans': 'Tennessee Titans',
  'den broncos': 'Denver Broncos',
  'dal cowboys': 'Dallas Cowboys',
  'phi eagles': 'Philadelphia Eagles',
  'was commanders': 'Washington Commanders',
  'chi bears': 'Chicago Bears',
  'det lions': 'Detroit Lions',
  'min vikings': 'Minnesota Vikings',
  'atl falcons': 'Atlanta Falcons',
  'car panthers': 'Carolina Panthers',
  'ari cardinals': 'Arizona Cardinals',
  'sea seahawks': 'Seattle Seahawks',

  // AFC East
  'buffalo bills': 'Buffalo Bills',
  'bills': 'Buffalo Bills',
  'buf': 'Buffalo Bills',
  'miami dolphins': 'Miami Dolphins',
  'dolphins': 'Miami Dolphins',
  'mia': 'Miami Dolphins',
  'new england patriots': 'New England Patriots',
  'patriots': 'New England Patriots',
  'ne': 'New England Patriots',
  'new york jets': 'New York Jets',
  'nyj jets': 'New York Jets',
  'jets': 'New York Jets',
  'nyj': 'New York Jets',

  // AFC North
  'baltimore ravens': 'Baltimore Ravens',
  'ravens': 'Baltimore Ravens',
  'bal': 'Baltimore Ravens',
  'cincinnati bengals': 'Cincinnati Bengals',
  'bengals': 'Cincinnati Bengals',
  'cin': 'Cincinnati Bengals',
  'cleveland browns': 'Cleveland Browns',
  'browns': 'Cleveland Browns',
  'cle': 'Cleveland Browns',
  'pittsburgh steelers': 'Pittsburgh Steelers',
  'steelers': 'Pittsburgh Steelers',
  'pit': 'Pittsburgh Steelers',

  // AFC South
  'houston texans': 'Houston Texans',
  'texans': 'Houston Texans',
  'hou': 'Houston Texans',
  'indianapolis colts': 'Indianapolis Colts',
  'colts': 'Indianapolis Colts',
  'ind': 'Indianapolis Colts',
  'jacksonville jaguars': 'Jacksonville Jaguars',
  'jaguars': 'Jacksonville Jaguars',
  'jax': 'Jacksonville Jaguars',
  'tennessee titans': 'Tennessee Titans',
  'titans': 'Tennessee Titans',
  'ten': 'Tennessee Titans',

  // AFC West
  'denver broncos': 'Denver Broncos',
  'broncos': 'Denver Broncos',
  'den': 'Denver Broncos',
  'kansas city chiefs': 'Kansas City Chiefs',
  'chiefs': 'Kansas City Chiefs',
  'kc': 'Kansas City Chiefs',
  'las vegas raiders': 'Las Vegas Raiders',
  'raiders': 'Las Vegas Raiders',
  'lv': 'Las Vegas Raiders',
  'los angeles chargers': 'Los Angeles Chargers',
  'lac chargers': 'Los Angeles Chargers',
  'chargers': 'Los Angeles Chargers',
  'lac': 'Los Angeles Chargers',

  // NFC East
  'dallas cowboys': 'Dallas Cowboys',
  'cowboys': 'Dallas Cowboys',
  'dal': 'Dallas Cowboys',
  'new york giants': 'New York Giants',
  'nyg giants': 'New York Giants',
  'giants': 'New York Giants',
  'nyg': 'New York Giants',
  'philadelphia eagles': 'Philadelphia Eagles',
  'eagles': 'Philadelphia Eagles',
  'phi': 'Philadelphia Eagles',
  'washington commanders': 'Washington Commanders',
  'commanders': 'Washington Commanders',
  'was': 'Washington Commanders',
  'wsh': 'Washington Commanders',
  'wsh commanders': 'Washington Commanders',

  // NFC North
  'chicago bears': 'Chicago Bears',
  'bears': 'Chicago Bears',
  'chi': 'Chicago Bears',
  'detroit lions': 'Detroit Lions',
  'lions': 'Detroit Lions',
  'det': 'Detroit Lions',
  'green bay packers': 'Green Bay Packers',
  'packers': 'Green Bay Packers',
  'gb': 'Green Bay Packers',
  'minnesota vikings': 'Minnesota Vikings',
  'vikings': 'Minnesota Vikings',
  'min': 'Minnesota Vikings',

  // NFC South
  'atlanta falcons': 'Atlanta Falcons',
  'falcons': 'Atlanta Falcons',
  'atl': 'Atlanta Falcons',
  'carolina panthers': 'Carolina Panthers',
  'panthers': 'Carolina Panthers',
  'car': 'Carolina Panthers',
  'new orleans saints': 'New Orleans Saints',
  'saints': 'New Orleans Saints',
  'no': 'New Orleans Saints',
  'tampa bay buccaneers': 'Tampa Bay Buccaneers',
  'buccaneers': 'Tampa Bay Buccaneers',
  'tb': 'Tampa Bay Buccaneers',

  // NFC West
  'arizona cardinals': 'Arizona Cardinals',
  'cardinals': 'Arizona Cardinals',
  'ari': 'Arizona Cardinals',
  'los angeles rams': 'Los Angeles Rams',
  'lar rams': 'Los Angeles Rams',
  'rams': 'Los Angeles Rams',
  'lar': 'Los Angeles Rams',
  'san francisco 49ers': 'San Francisco 49ers',
  '49ers': 'San Francisco 49ers',
  'sf': 'San Francisco 49ers',
  'seattle seahawks': 'Seattle Seahawks',
  'seahawks': 'Seattle Seahawks',
  'sea': 'Seattle Seahawks'
};

function cleanTeamName(rawName) {
  return rawName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\./g, '')
    .replace(/\s*@\s*/g, ' ')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/moneyline|ml|spread|total/gi, '')
    .replace(/[-–]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeam(rawName) {
  if (!rawName) {
    console.warn('⚠️  normalizeTeam called with empty value');
    return rawName;
  }

  const cleaned = cleanTeamName(rawName);
  const normalized = TEAM_MAPPINGS[cleaned];

  if (!normalized) {
    console.warn(`⚠️  Unknown team name: "${rawName}" -> "${cleaned}"`);
    return rawName.trim();
  }

  return normalized;
}

/**
 * Parse game time and extract date
 * @param {string} rawTime - Raw time string or ISO timestamp from scraper
 * @returns {object} - {date: 'YYYY-MM-DD', time: ISO string}
 */
function parseGameTime(rawTime) {
  if (!rawTime) {
    return { date: null, time: null };
  }

  try {
    const dt = new Date(rawTime);
    
    // Check if valid date
    if (isNaN(dt.getTime())) {
      console.warn(`⚠️  Invalid game time: ${rawTime}`);
      return { date: null, time: null };
    }
    
    const dateStr = dt.toISOString().split('T')[0]; // YYYY-MM-DD

    return {
      date: dateStr,
      time: dt.toISOString()
    };
  } catch (error) {
    console.warn(`⚠️  Error parsing game time: ${rawTime}`, error.message);
    return { date: null, time: null };
  }
}

/**
 * Check if two game times are within tolerance
 * @param {string} time1 - ISO time string
 * @param {string} time2 - ISO time string
 * @param {number} toleranceMinutes - Allowable difference in minutes
 * @returns {boolean}
 */
function matchGameTimes(time1, time2, toleranceMinutes = 10) {
  if (!time1 || !time2) return true; // If either missing, match by teams only
  
  try {
    const diff = Math.abs(new Date(time1) - new Date(time2));
    const diffMinutes = diff / (1000 * 60);
    return diffMinutes <= toleranceMinutes;
  } catch (error) {
    console.warn('⚠️  Error comparing game times:', error.message);
    return true; // Default to match if parsing fails
  }
}

/**
 * Create event ID with date for uniqueness
 * @param {string} awayTeam - Normalized away team
 * @param {string} homeTeam - Normalized home team
 * @param {string} gameDate - Date in YYYY-MM-DD format (or null)
 * @returns {string} - Unique event ID
 */
function createEventId(awayTeam, homeTeam, gameDate = null) {
  const teams = [awayTeam, homeTeam].sort();
  // If no game date provided, use today as fallback (maintains backward compatibility)
  const datePrefix = gameDate || new Date().toISOString().split('T')[0];
  return `${datePrefix}_${teams[0]}_vs_${teams[1]}`.replace(/\s+/g, '_');
}

/**
 * Match events across multiple books with multi-market support
 * @param {array} dkOdds - DraftKings odds
 * @param {array} fdOdds - FanDuel odds  
 * @param {array} betmgmOdds - BetMGM odds
 * @param {array} espnbetOdds - ESPN Bet odds
 * @param {array} bovadaOdds - Bovada odds (disabled)
 * @param {array} mybookieOdds - MyBookie odds (disabled)
 * @returns {array} - Matched events with all markets
 */
function matchEvents(
  dkOdds,
  fdOdds,
  betmgmOdds = [],
  espnbetOdds = [],
  bovadaOdds = [],
  mybookieOdds = []
) {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 ENHANCED NORMALIZER - MULTI-MARKET MATCHING');
  console.log('='.repeat(60));

  console.log('\n📊 Input Summary:');
  console.log(`  DK: ${dkOdds.length} games`);
  console.log(`  FD: ${fdOdds.length} games`);
  console.log(`  BetMGM: ${betmgmOdds.length} games`);
  console.log(`  ESPN: ${espnbetOdds.length} games`);

  // Event map: eventId -> {teams, date, markets: {marketKey -> {book -> data}}}
  const eventMap = new Map();

  /**
   * Process odds from a book and add to event map
   */
  function processBookOdds(oddsArray, bookName) {
    oddsArray.forEach((game, idx) => {
      const awayTeam = normalizeTeam(game.awayTeam);
      const homeTeam = normalizeTeam(game.homeTeam);
      const gameTimeData = parseGameTime(game.gameTime);
      const eventId = createEventId(awayTeam, homeTeam, gameTimeData.date);

      if (idx < 2) {
        console.log(`\n  ${bookName.toUpperCase()} Game: "${game.awayTeam}" @ "${game.homeTeam}"`);
        console.log(`    → Normalized: "${awayTeam}" @ "${homeTeam}"`);
        console.log(`    → EventID: ${eventId}`);
        console.log(`    → Markets: ${game.markets ? Object.keys(game.markets).join(', ') : 'none'}`);
      }

      // Get or create event
      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          eventId,
          awayTeam,
          homeTeam,
          gameDate: gameTimeData.date,
          gameTime: gameTimeData.time,
          markets: {} // marketKey -> {book -> marketData}
        });
      }

      const event = eventMap.get(eventId);

      // Extract all markets from this game
      const markets = extractMarkets(game);
      
      markets.forEach(({ marketKey, marketType, marketData }) => {
        if (!event.markets[marketKey]) {
          event.markets[marketKey] = {
            marketType,
            books: {}
          };
        }

        event.markets[marketKey].books[bookName] = {
          ...marketData,
          url: game.url,
          timestamp: game.timestamp
        };
      });
    });
  }

  // Process all books
  processBookOdds(dkOdds, 'draftkings');
  processBookOdds(fdOdds, 'fanduel');
  processBookOdds(betmgmOdds, 'betmgm');
  processBookOdds(espnbetOdds, 'espnbet');
  // bovada and mybookie disabled

  // Convert to array and filter to events with 2+ books for at least one market
  const matched = Array.from(eventMap.values()).filter(event => {
    // Check if at least one market has 2+ books
    return Object.values(event.markets).some(market => 
      Object.keys(market.books).length >= 2
    );
  });

  // Count total market opportunities
  let totalMarkets = 0;
  matched.forEach(event => {
    totalMarkets += Object.keys(event.markets).length;
  });

  console.log(`\n📊 Matching Summary:`);
  console.log(`  Total unique events: ${eventMap.size}`);
  console.log(`  Events with 2+ books: ${matched.length}`);
  console.log(`  Total market opportunities: ${totalMarkets}`);

  if (matched.length > 0) {
    const first = matched[0];
    console.log(`\n  First matched event:`);
    console.log(`    ${first.awayTeam} @ ${first.homeTeam}`);
    console.log(`    Markets: ${Object.keys(first.markets).join(', ')}`);
    
    Object.entries(first.markets).forEach(([marketKey, market]) => {
      console.log(`      ${marketKey}: ${Object.keys(market.books).join(', ')}`);
    });
  }

  return matched;
}

module.exports = {
  normalizeTeam,
  createEventId,
  matchEvents,
  parseGameTime,
  matchGameTimes
};