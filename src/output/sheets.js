// src/output/sheets.js
// Google Sheets integration for logging arbitrages

const { google } = require('googleapis');
const config = require('../../config');

class SheetsLogger {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.SPREADSHEET_ID || '1TTJUezJJnpIYLsX5wnAkwOFDXqBkGvaaXsUWSEktRwc';
  }

  async initialize() {
    try {
      // Check if credentials path is configured
      const credentialsPath = config.sheetsCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (!credentialsPath) {
        console.warn('⚠️  Google Sheets credentials not configured');
        console.warn('   Set GOOGLE_APPLICATION_CREDENTIALS in .env or sheetsCredentials in config.js');
        return;
      }

      const credentials = require(credentialsPath);
      
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      
      console.log('✅ Google Sheets connected');
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets:', error.message);
      throw error;
    }
  }

  async logArbitrage(arb) {
    if (!this.sheets) {
      console.warn('⚠️  Sheets not initialized, skipping log');
      return;
    }

    const row = [
      arb.detectedAt,
      arb.event,
      arb.gameTime,
      arb.marketType,
      arb.profitMargin + '%',
      arb.leg1.book,
      arb.leg1.selection,
      arb.leg1.odds,
      arb.leg1.stake,
      arb.leg1.url,
      arb.leg2.book,
      arb.leg2.selection,
      arb.leg2.odds,
      arb.leg2.stake,
      arb.leg2.url,
      arb.profit,
      'DETECTED'
    ];

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Arbitrages!A:Q',
        valueInputOption: 'RAW',
        resource: { values: [row] }
      });

      console.log(`📊 Logged to Sheets: ${arb.event} (${arb.profitMargin}%)`);
    } catch (error) {
      console.error('❌ Failed to log to Sheets:', error.message);
    }
  }
}

module.exports = SheetsLogger;