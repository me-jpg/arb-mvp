const DraftKingsScraper = require('../scrapers/draftkings');
const FanDuelV2Scraper = require('../scrapers/fanduel-v2');
const db = require('../utils/db');
const Helpers = require('../utils/helpers');

// Map scraper keys to clear book names for DB
const BOOKS = {
    DRAFTKINGS: 'draftkings',
    FANDUEL: 'fanduel'
};

async function runScraper(ScraperClass, bookName, sport = 'nfl') {
    console.log(`\nStarting ${bookName} scraper for ${sport}...`);
    const start = Date.now();
    let scraper = null;
    let games = [];

    try {
        scraper = new ScraperClass();
        const rawGames = await scraper.scrape(); // Note: scrape() might take parameters in future

        // Transform and filter games if needed
        // Existing scrapers return array of game objects
        games = rawGames.filter(g => g.awayTeam && g.homeTeam);

        console.log(`✅ ${bookName} scraped ${games.length} games in ${Date.now() - start}ms`);
        return { success: true, games, book: bookName };

    } catch (error) {
        console.error(`❌ ${bookName} failed:`, error.message);
        return { success: false, error, book: bookName, games: [] };
    } finally {
        if (scraper && scraper.close) {
            await scraper.close().catch(e => console.error('Error closing scraper:', e));
        }
    }
}

async function saveToDatabase(results) {
    if (!results || results.length === 0) return;

    console.log('Saving results to database...');
    let eventsCount = 0;
    let oddsCount = 0;

    for (const result of results) {
        if (!result.success || !result.games.length) continue;

        for (const game of result.games) {
            // 1. Construct Event ID (simple composite key for now)
            // Standardize team names would happen here in a real production system
            // For MVP, we'll just squash spaces and lowercase
            const home = game.homeTeam.toLowerCase().replace(/\s+/g, '');
            const away = game.awayTeam.toLowerCase().replace(/\s+/g, '');
            const eventId = `nfl-${away}-${home}`; // Assumptions: NFL only for now

            // 2. Upsert Event
            await db.upsertEvent({
                eventId,
                sport: 'nfl',
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                startTime: game.gameTime
            });
            eventsCount++;

            // 3. Prepare Odds Snapshots
            const snapshots = [];
            const now = new Date();

            // Flatten the 'markets' object from DraftKings
            // DK structure: { moneyline: { awayOdds, homeOdds }, spread: { ... }, total: { ... } }
            if (result.book === BOOKS.DRAFTKINGS && game.markets) {
                if (game.markets.moneyline) {
                    snapshots.push(
                        createSnapshot(eventId, result.book, 'moneyline', 'away', null, game.markets.moneyline.awayOdds, now),
                        createSnapshot(eventId, result.book, 'moneyline', 'home', null, game.markets.moneyline.homeOdds, now)
                    );
                }
                if (game.markets.spread) {
                    snapshots.push(
                        createSnapshot(eventId, result.book, 'spread', 'away', game.markets.spread.awayLine, game.markets.spread.awayOdds, now),
                        createSnapshot(eventId, result.book, 'spread', 'home', game.markets.spread.homeLine, game.markets.spread.homeOdds, now)
                    );
                }
                if (game.markets.total) {
                    snapshots.push(
                        createSnapshot(eventId, result.book, 'total', 'over', game.markets.total.line, game.markets.total.overOdds, now),
                        createSnapshot(eventId, result.book, 'total', 'under', game.markets.total.line, game.markets.total.underOdds, now)
                    );
                }
            }

            // Flatten the 'odds' array from FanDuel
            // FD structure: odds: [ { marketType, side, line, price }, ... ]
            else if (result.book === BOOKS.FANDUEL && Array.isArray(game.odds)) {
                for (const odd of game.odds) {
                    // Normalize prices (remove + if present, parse int)
                    let price = parseInt(odd.price);
                    if (isNaN(price)) continue;

                    snapshots.push(
                        createSnapshot(eventId, result.book, odd.marketType, odd.side, odd.line, price, now)
                    );
                }
            }

            if (snapshots.length > 0) {
                await db.insertOddsSnapshots(snapshots);
                oddsCount += snapshots.length;
            }
        }
    }

    console.log(`💾 DB Update: ${eventsCount} events processing, ${oddsCount} odds snapshots inserted.`);
}

function createSnapshot(eventId, book, marketType, side, line, price, now) {
    return {
        eventId,
        book,
        marketType,
        side,
        line,
        price,
        scrapedAt: now,
        detectedAt: now
    };
}

async function main() {
    console.log(`[${new Date().toISOString()}] Starting Scrape Job`);

    try {
        // 1. Connect to DB
        if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
            console.warn('⚠️  No DATABASE_URL or DB config found. Running in dry-run mode (no DB saves).');
        } else {
            await db.connect();
        }

        // 2. Run Scrapers Sequentially
        const results = [];

        // DraftKings
        results.push(await runScraper(DraftKingsScraper, BOOKS.DRAFTKINGS));

        // Short delay between scrapers
        await Helpers.delay(2000, 5000);

        // FanDuel
        results.push(await runScraper(FanDuelV2Scraper, BOOKS.FANDUEL));

        // 3. Save Results
        if (db.connected) {
            await saveToDatabase(results);
        } else {
            console.log('Dry run complete. Sample data:', JSON.stringify(results[0]?.games?.[0], null, 2));
        }

        console.log('✅ Job completed successfully');
        process.exit(0);

    } catch (error) {
        console.error('❌ Job failed:', error);
        process.exit(1);
    } finally {
        if (db.connected) await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}
