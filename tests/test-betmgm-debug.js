// tests/test-betmgm-debug.js
// Debug BetMGM text extraction

const puppeteer = require('puppeteer');

async function debug() {
  console.log('🔍 BetMGM Text Debug\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('Loading BetMGM...');
    await page.goto('https://sports.il.betmgm.com/en/sports/football-11/betting/usa-9/nfl-35', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await new Promise(resolve => setTimeout(resolve, 12000));

    console.log('Extracting text from all frames...\n');

    const frames = page.frames();
    console.log(`Found ${frames.length} frames\n`);

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        const frameData = await frame.evaluate(() => {
          const text = document.body?.innerText || '';
          const lines = text.split('\n').filter(line => line.trim().length > 0);
          
          // Find lines with team names
          const nflTeams = [
            '49ers', 'Bears', 'Bengals', 'Bills', 'Broncos', 'Browns', 'Buccaneers',
            'Cardinals', 'Chargers', 'Chiefs', 'Colts', 'Commanders', 'Cowboys',
            'Dolphins', 'Eagles', 'Falcons', 'Giants', 'Jaguars', 'Jets', 'Lions',
            'Packers', 'Panthers', 'Patriots', 'Raiders', 'Rams', 'Ravens', 'Saints',
            'Seahawks', 'Steelers', 'Texans', 'Titans', 'Vikings'
          ];
          
          const teamLinesFound = lines.filter(line => {
            const trimmed = line.trim();
            return nflTeams.includes(trimmed);
          });
          
          return {
            hasContent: text.length > 1000,
            teamCount: teamLinesFound.length,
            teams: teamLinesFound
          };
        });
        
        if (frameData.hasContent && frameData.teamCount > 0) {
          console.log(`=== FRAME ${i} ===`);
          console.log(`Found ${frameData.teamCount} team names (should be 24 for 12 games)`);
          console.log(`Teams found: ${frameData.teams.join(', ')}`);
          console.log('\n');
        }
      } catch (e) {
        // Skip frames we can't access
      }
    }

    console.log('\nPress Ctrl+C to close browser');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debug();