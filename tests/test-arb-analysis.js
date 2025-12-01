// tests/test-arb-analysis.js
// Detailed analysis with lower threshold to see near-arbs
const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');
const BetMGMScraper = require('../src/scrapers/betmgm');
const ESPNBetScraper = require('../src/scrapers/espnbet');
const { matchEvents } = require('../src/core/normalizer');
const { americanToDecimal } = require('../src/core/detector');

async function analyzeMarkets() {
  console.log('============================================================');
  console.log('🔬 DETAILED MARKET ANALYSIS');
  console.log('============================================================\n');

  try {
    // Scrape all books
    console.log('📊 Scraping all sportsbooks...\n');
    
    const dkScraper = new DraftKingsScraper();
    const fdScraper = new FanDuelScraper();
    const mgmScraper = new BetMGMScraper();
    const espnScraper = new ESPNBetScraper();
    
    const [dkData, fdData, mgmData, espnData] = await Promise.all([
      dkScraper.scrape(),
      fdScraper.scrape(),
      mgmScraper.scrape(),
      espnScraper.scrape()
    ]);
    
    console.log(`✅ Scraped: DK(${dkData.length}) FD(${fdData.length}) MGM(${mgmData.length}) ESPN(${espnData.length})\n`);
    
    // Match events
    const matched = matchEvents(dkData, fdData, mgmData, espnData);
    
    console.log('\n============================================================');
    console.log('🎯 ANALYZING MARKET EFFICIENCY');
    console.log('============================================================\n');
    
    const opportunities = [];
    
    matched.forEach(event => {
      Object.entries(event.markets).forEach(([marketKey, market]) => {
        const books = Object.keys(market.books);
        
        if (books.length < 2) return;
        
        // Analyze based on market type
        if (market.marketType === 'moneyline') {
          // Find best odds for each side
          let bestAway = null;
          let bestHome = null;
          
          books.forEach(book => {
            const data = market.books[book];
            if (!bestAway || data.awayOdds > bestAway.odds) {
              bestAway = { book, odds: data.awayOdds, decimal: americanToDecimal(data.awayOdds) };
            }
            if (!bestHome || data.homeOdds > bestHome.odds) {
              bestHome = { book, odds: data.homeOdds, decimal: americanToDecimal(data.homeOdds) };
            }
          });
          
          if (bestAway && bestHome) {
            const impliedProb = 1/bestAway.decimal + 1/bestHome.decimal;
            const margin = (1 - impliedProb) * 100;
            
            opportunities.push({
              event: `${event.awayTeam} @ ${event.homeTeam}`,
              marketType: 'Moneyline',
              margin,
              leg1: `${event.awayTeam} ${bestAway.odds} (${bestAway.book})`,
              leg2: `${event.homeTeam} ${bestHome.odds} (${bestHome.book})`,
              impliedProb: (impliedProb * 100).toFixed(2) + '%'
            });
          }
        }
        
        else if (market.marketType === 'spread') {
          // Find best odds for each side
          let bestAway = null;
          let bestHome = null;
          
          books.forEach(book => {
            const data = market.books[book];
            if (!bestAway || data.awayOdds > bestAway.odds) {
              bestAway = { 
                book, 
                odds: data.awayOdds, 
                line: data.awayLine,
                decimal: americanToDecimal(data.awayOdds) 
              };
            }
            if (!bestHome || data.homeOdds > bestHome.odds) {
              bestHome = { 
                book, 
                odds: data.homeOdds, 
                line: data.homeLine,
                decimal: americanToDecimal(data.homeOdds) 
              };
            }
          });
          
          if (bestAway && bestHome) {
            const impliedProb = 1/bestAway.decimal + 1/bestHome.decimal;
            const margin = (1 - impliedProb) * 100;
            
            opportunities.push({
              event: `${event.awayTeam} @ ${event.homeTeam}`,
              marketType: 'Spread',
              margin,
              leg1: `${event.awayTeam} ${bestAway.line} @ ${bestAway.odds} (${bestAway.book})`,
              leg2: `${event.homeTeam} ${bestHome.line} @ ${bestHome.odds} (${bestHome.book})`,
              impliedProb: (impliedProb * 100).toFixed(2) + '%'
            });
          }
        }
        
        else if (market.marketType === 'total') {
          // Find best odds for over/under
          let bestOver = null;
          let bestUnder = null;
          
          books.forEach(book => {
            const data = market.books[book];
            if (!bestOver || data.overOdds > bestOver.odds) {
              bestOver = { 
                book, 
                odds: data.overOdds, 
                line: data.line,
                decimal: americanToDecimal(data.overOdds) 
              };
            }
            if (!bestUnder || data.underOdds > bestUnder.odds) {
              bestUnder = { 
                book, 
                odds: data.underOdds, 
                line: data.line,
                decimal: americanToDecimal(data.underOdds) 
              };
            }
          });
          
          if (bestOver && bestUnder) {
            const impliedProb = 1/bestOver.decimal + 1/bestUnder.decimal;
            const margin = (1 - impliedProb) * 100;
            
            opportunities.push({
              event: `${event.awayTeam} @ ${event.homeTeam}`,
              marketType: 'Total',
              margin,
              leg1: `Over ${bestOver.line} @ ${bestOver.odds} (${bestOver.book})`,
              leg2: `Under ${bestUnder.line} @ ${bestUnder.odds} (${bestUnder.book})`,
              impliedProb: (impliedProb * 100).toFixed(2) + '%'
            });
          }
        }
      });
    });
    
    // Sort by margin (best to worst)
    opportunities.sort((a, b) => b.margin - a.margin);
    
    console.log('📊 TOP 20 BEST OPPORTUNITIES:\n');
    
    opportunities.slice(0, 20).forEach((opp, i) => {
      const status = opp.margin > 0 ? '🎯 ARB!' : opp.margin > -0.5 ? '🔥 CLOSE' : '📊';
      console.log(`${i + 1}. ${status} ${opp.event} - ${opp.marketType}`);
      console.log(`   Margin: ${opp.margin.toFixed(3)}% (Implied: ${opp.impliedProb})`);
      console.log(`   📘 ${opp.leg1}`);
      console.log(`   📕 ${opp.leg2}\n`);
    });
    
    // Statistics
    const arbs = opportunities.filter(o => o.margin > 0);
    const nearArbs = opportunities.filter(o => o.margin > -0.5 && o.margin <= 0);
    
    console.log('============================================================');
    console.log('📈 STATISTICS');
    console.log('============================================================');
    console.log(`Total Markets Analyzed: ${opportunities.length}`);
    console.log(`True Arbitrages (>0%): ${arbs.length}`);
    console.log(`Near Arbitrages (-0.5% to 0%): ${nearArbs.length}`);
    
    if (opportunities.length > 0) {
      const avgMargin = opportunities.reduce((sum, o) => sum + o.margin, 0) / opportunities.length;
      const bestMargin = opportunities[0].margin;
      const worstMargin = opportunities[opportunities.length - 1].margin;
      
      console.log(`\nMargin Distribution:`);
      console.log(`  Best: ${bestMargin.toFixed(3)}%`);
      console.log(`  Average: ${avgMargin.toFixed(3)}%`);
      console.log(`  Worst: ${worstMargin.toFixed(3)}%`);
    }
    
    console.log('============================================================\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

analyzeMarkets();