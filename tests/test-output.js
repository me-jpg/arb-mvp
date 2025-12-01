const SheetsLogger = require('../src/output/sheets');
const DiscordAlerter = require('../src/output/discord');

async function testOutput() {
  console.log('🧪 Testing output systems...\n');

  // Test Discord
  console.log('Testing Discord...');
  const discord = new DiscordAlerter();
  
  const testArb = {
    eventId: 'test',
    event: 'Test Team A @ Test Team B',
    gameTime: new Date().toISOString(),
    profitMargin: 2.5,
    profit: 25.00,
    leg1: { book: 'draftkings', selection: 'Team A', odds: 2.10, stake: 485, url: 'https://draftkings.com' },
    leg2: { book: 'fanduel', selection: 'Team B', odds: 2.05, stake: 515, url: 'https://fanduel.com' },
    totalStake: 1000,
    expectedReturn: 1025,
    detectedAt: new Date().toISOString()
  };

  await discord.sendArbitrage(testArb);
  console.log('✅ Discord alert sent\n');

  // Test Sheets
  console.log('Testing Google Sheets...');
  const sheets = new SheetsLogger();
  await sheets.initialize();
  await sheets.logArbitrage(testArb);
  console.log('✅ Sheets logged\n');
}

testOutput();