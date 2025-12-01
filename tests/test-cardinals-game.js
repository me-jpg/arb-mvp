// tests/test-cardinals-game.js
require('dotenv').config();
const DraftKingsScraper = require('../src/scrapers/draftkings');
const FanDuelScraper = require('../src/scrapers/fanduel');
const BovadaScraper = require('../src/scrapers/bovada');

async function test() {
  console.log('🔍 Comparing Cardinals @ Buccaneers across books\n');
  
  const dkScraper = new DraftKingsScraper();
  const fdScraper = new FanDuelScraper();
  const bovadaScraper = new BovadaScraper();
  
  const [dkOdds, fdOdds, bovadaOdds] = await Promise.all([
    dkScraper.scrape(),
    fdScraper.scrape(),
    bovadaScraper.scrape()
  ]);
  
  // Find Cardinals game in each book
  const dkCard = dkOdds.find(g => 
    (g.awayTeam.includes('Cardinal') || g.awayTeam.includes('ARI')) &&
    (g.homeTeam.includes('Buccaneer') || g.homeTeam.includes('TB'))
  );
  
  const fdCard = fdOdds.find(g => 
    (g.awayTeam.includes('Cardinal') || g.awayTeam.includes('Arizona')) &&
    (g.homeTeam.includes('Buccaneer') || g.homeTeam.includes('Tampa'))
  );
  
  const bovCard = bovadaOdds.find(g => 
    (g.awayTeam.includes('Cardinal') || g.awayTeam.includes('Arizona')) &&
    (g.homeTeam.includes('Buccaneer') || g.homeTeam.includes('Tampa'))
  );
  
  console.log('DraftKings:');
  if (dkCard) {
    console.log(`  ${dkCard.awayTeam} @ ${dkCard.homeTeam}`);
    console.log(`  Away: ${dkCard.awayOdds > 0 ? '+' : ''}${dkCard.awayOdds}`);
    console.log(`  Home: ${dkCard.homeOdds > 0 ? '+' : ''}${dkCard.homeOdds}`);
  } else {
    console.log('  NOT FOUND');
  }
  
  console.log('\nFanDuel:');
  if (fdCard) {
    console.log(`  ${fdCard.awayTeam} @ ${fdCard.homeTeam}`);
    console.log(`  Away: ${fdCard.awayOdds > 0 ? '+' : ''}${fdCard.awayOdds}`);
    console.log(`  Home: ${fdCard.homeOdds > 0 ? '+' : ''}${fdCard.homeOdds}`);
  } else {
    console.log('  NOT FOUND');
  }
  
  console.log('\nBovada:');
  if (bovCard) {
    console.log(`  ${bovCard.awayTeam} @ ${bovCard.homeTeam}`);
    console.log(`  Away: ${bovCard.awayOdds > 0 ? '+' : ''}${bovCard.awayOdds}`);
    console.log(`  Home: ${bovCard.homeOdds > 0 ? '+' : ''}${bovCard.homeOdds}`);
  } else {
    console.log('  NOT FOUND');
  }
  
  console.log('\n🔍 Analysis:');
  if (dkCard && fdCard && bovCard) {
    if (dkCard.awayOdds < 0 && fdCard.awayOdds > 0 && bovCard.homeOdds > 0) {
      console.log('❌ DIFFERENT GAMES! Cardinals are favorite in DK but underdog in FD/Bovada');
      console.log('   This means different weeks or one book has teams flipped!');
    } else if (Math.abs(dkCard.awayOdds - fdCard.awayOdds) < 50) {
      console.log('✅ Same game - odds are similar');
    }
  }
}

test();