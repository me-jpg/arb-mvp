// tests/test-current-odds.js
// Check current live odds and show which games are closest to being arbitrages

require('dotenv').config();
const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');
const { matchEvents } = require('../src/core/normalizer');
const { americanToDecimal } = require('../src/utils/helpers');

async function analyzeLiveOdds() {
  console.log('🔍 LIVE ODDS ANALYSIS\n');
  console.log('Scraping current odds and analyzing for arbitrage opportunities...\n');
  console.log('='.repeat(80));

  try {
    // Scrape both books
    console.log('\n📡 Scraping sportsbooks...');
    const dkScraper = new DraftKingsScraper();
    const fdScraper = new FanDuelScraper();

    const [dkOdds, fdOdds] = await Promise.all([
      dkScraper.scrape(),
      fdScraper.scrape()
    ]);

    console.log(`✅ DraftKings: ${dkOdds.length} games`);
    console.log(`✅ FanDuel: ${fdOdds.length} games`);

    // Match events
    console.log('\n🔄 Matching events...');
    const matchedEvents = matchEvents(dkOdds, fdOdds);
    console.log(`✅ Matched: ${matchedEvents.length} games\n`);

    if (matchedEvents.length === 0) {
      console.log('❌ No matched games found! Check team name normalizer.');
      return;
    }

    // Analyze each matched game
    console.log('='.repeat(80));
    console.log('ARBITRAGE ANALYSIS FOR ALL MATCHED GAMES');
    console.log('='.repeat(80));

    const opportunities = [];

    matchedEvents.forEach((event, idx) => {
      // Convert all odds to decimal
      const dkAwayDec = americanToDecimal(event.dk.awayOdds);
      const dkHomeDec = americanToDecimal(event.dk.homeOdds);
      const fdAwayDec = americanToDecimal(event.fd.awayOdds);
      const fdHomeDec = americanToDecimal(event.fd.homeOdds);

      // Check all 4 combinations
      const combos = [
        {
          desc: 'DK Away + FD Home',
          odds1: dkAwayDec,
          odds2: fdHomeDec,
          book1: 'DK',
          sel1: event.awayTeam,
          am1: event.dk.awayOdds,
          book2: 'FD',
          sel2: event.homeTeam,
          am2: event.fd.homeOdds
        },
        {
          desc: 'DK Home + FD Away',
          odds1: dkHomeDec,
          odds2: fdAwayDec,
          book1: 'DK',
          sel1: event.homeTeam,
          am1: event.dk.homeOdds,
          book2: 'FD',
          sel2: event.awayTeam,
          am2: event.fd.awayOdds
        },
        {
          desc: 'FD Away + DK Home',
          odds1: fdAwayDec,
          odds2: dkHomeDec,
          book1: 'FD',
          sel1: event.awayTeam,
          am1: event.fd.awayOdds,
          book2: 'DK',
          sel2: event.homeTeam,
          am2: event.dk.homeOdds
        },
        {
          desc: 'FD Home + DK Away',
          odds1: fdHomeDec,
          odds2: dkAwayDec,
          book1: 'FD',
          sel1: event.homeTeam,
          am1: event.fd.homeOdds,
          book2: 'DK',
          sel2: event.awayTeam,
          am2: event.dk.awayOdds
        }
      ];

      // Find best opportunity for this game
      let bestCombo = null;
      let bestProfit = -100;

      combos.forEach(combo => {
        const totalProb = (1 / combo.odds1) + (1 / combo.odds2);
        const profitMargin = ((1 / totalProb) - 1) * 100;
        
        if (profitMargin > bestProfit) {
          bestProfit = profitMargin;
          bestCombo = combo;
        }
      });

      opportunities.push({
        event: event.event || `${event.awayTeam} @ ${event.homeTeam}`,
        awayTeam: event.awayTeam,
        homeTeam: event.homeTeam,
        dkAway: event.dk.awayOdds,
        dkHome: event.dk.homeOdds,
        fdAway: event.fd.awayOdds,
        fdHome: event.fd.homeOdds,
        bestProfit,
        bestCombo
      });
    });

    // Sort by profit margin (best first)
    opportunities.sort((a, b) => b.bestProfit - a.bestProfit);

    // Display all games
    opportunities.forEach((opp, idx) => {
      const isArb = opp.bestProfit > 0;
      const prefix = isArb ? '🚨 ARB!' : '💤';
      
      console.log(`\n${prefix} GAME ${idx + 1}: ${opp.awayTeam} @ ${opp.homeTeam}`);
      console.log(`   DraftKings: Away ${opp.dkAway > 0 ? '+' : ''}${opp.dkAway} | Home ${opp.dkHome > 0 ? '+' : ''}${opp.dkHome}`);
      console.log(`   FanDuel:    Away ${opp.fdAway > 0 ? '+' : ''}${opp.fdAway} | Home ${opp.fdHome > 0 ? '+' : ''}${opp.fdHome}`);
      console.log(`   Best Combo: ${opp.bestCombo.desc}`);
      console.log(`   Profit: ${opp.bestProfit.toFixed(2)}% ${isArb ? '✅ ARBITRAGE!' : '❌'}`);
    });

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const arbCount = opportunities.filter(o => o.bestProfit > 0).length;
    const closeCount = opportunities.filter(o => o.bestProfit > -0.5 && o.bestProfit <= 0).length;
    
    console.log(`\n📊 Total games analyzed: ${opportunities.length}`);
    console.log(`🚨 Arbitrages found (>0%): ${arbCount}`);
    console.log(`⚠️  Close calls (-0.5% to 0%): ${closeCount}`);
    console.log(`💤 No opportunity: ${opportunities.length - arbCount - closeCount}`);
    
    if (arbCount > 0) {
      console.log('\n🎉 ARBITRAGES DETECTED! Your system would catch these!');
    } else if (closeCount > 0) {
      console.log('\n💡 Some games are close! Odds might shift to create arbitrages.');
    } else {
      console.log('\n😴 No arbitrages right now. This is normal - keep monitoring!');
    }

  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    console.error(error.stack);
  }
}

analyzeLiveOdds();