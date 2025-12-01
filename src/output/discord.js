// src/output/discord.js
// Send alerts to Discord webhook

const axios = require('axios');
const config = require('../../config');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Color codes for embeds
const COLORS = {
  GREEN: 0x00ff00,   // High profit (2%+)
  YELLOW: 0xffff00,  // Medium profit (1-2%)
  ORANGE: 0xff8800,  // Low profit (0.5-1%)
  RED: 0xff0000,     // Very low profit (<0.5%)
  BLUE: 0x0099ff,    // Info messages
  GRAY: 0x808080     // Summaries
};

function getColorForProfit(profitMargin) {
  if (profitMargin >= 2) return COLORS.GREEN;
  if (profitMargin >= 1) return COLORS.YELLOW;
  if (profitMargin >= 0.5) return COLORS.ORANGE;
  return COLORS.RED;
}

async function sendWebhook(payload) {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('⚠️  Discord webhook URL not configured');
    return;
  }

  try {
    await axios.post(DISCORD_WEBHOOK_URL, payload);
  } catch (error) {
    console.error('Failed to send Discord webhook:', error.message);
  }
}

/**
 * Send arbitrage alert
 */
async function sendArbitrage(arb) {
  const embed = {
    embeds: [{
      title: `🚨 ARBITRAGE DETECTED`,
      description: `**${arb.event}**`,
      color: getColorForProfit(arb.profitMargin),
      fields: [
        {
          name: '💰 Profit',
          value: `**${arb.profitMargin.toFixed(2)}%** ($${arb.profitAmount.toFixed(2)})`,
          inline: false
        },
        {
          name: `📘 ${arb.book1.toUpperCase()} - Leg 1`,
          value: `${arb.selection1}\nOdds: **${arb.americanOdds1 > 0 ? '+' : ''}${arb.americanOdds1}**\nStake: $${arb.stake1.toFixed(2)}\n[Place Bet](${arb.url1})`,
          inline: true
        },
        {
          name: `📗 ${arb.book2.toUpperCase()} - Leg 2`,
          value: `${arb.selection2}\nOdds: **${arb.americanOdds2 > 0 ? '+' : ''}${arb.americanOdds2}**\nStake: $${arb.stake2.toFixed(2)}\n[Place Bet](${arb.url2})`,
          inline: true
        }
      ],
      footer: {
        text: `Detected: ${new Date(arb.detected).toLocaleTimeString()}`
      },
      timestamp: new Date(arb.detected).toISOString()
    }]
  };

  await sendWebhook(embed);
}

/**
 * Send periodic summary
 */
async function sendSummary(summary) {
  const embed = {
    embeds: [{
      title: '📊 System Summary',
      color: COLORS.GRAY,
      fields: [
        {
          name: 'Cycle',
          value: `#${summary.cycle}`,
          inline: true
        },
        {
          name: 'Uptime',
          value: summary.uptime,
          inline: true
        },
        {
          name: 'Matched Events',
          value: `${summary.matched}`,
          inline: true
        },
        {
          name: 'This Cycle',
          value: `${summary.arbitragesThisCycle} arbs`,
          inline: true
        },
        {
          name: 'Total Found',
          value: `${summary.totalArbitrages} arbs`,
          inline: true
        },
        {
          name: 'Book Health',
          value: `✅ ${summary.healthyBooks.join(', ')}\n${summary.unhealthyBooks.length > 0 ? '❌ ' + summary.unhealthyBooks.join(', ') : 'All healthy'}`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  await sendWebhook(embed);
}

/**
 * Send error alert
 */
async function sendError(error, cycle) {
  const embed = {
    embeds: [{
      title: '❌ System Error',
      description: `Error in cycle ${cycle}`,
      color: COLORS.RED,
      fields: [
        {
          name: 'Error Message',
          value: `\`\`\`${error.message}\`\`\``,
          inline: false
        },
        {
          name: 'Component',
          value: error.component || 'Unknown',
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  await sendWebhook(embed);
}

/**
 * Send startup notification
 */
async function sendStartup(config) {
  const embed = {
    embeds: [{
      title: '🚀 ARB MVP Started',
      color: COLORS.BLUE,
      fields: [
        {
          name: 'Min Profit Threshold',
          value: `${config.minProfit}%`,
          inline: true
        },
        {
          name: 'Total Stake',
          value: `$${config.totalStake}`,
          inline: true
        },
        {
          name: 'Scrape Interval',
          value: `${config.interval}s`,
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  await sendWebhook(embed);
}

/**
 * Send shutdown notification
 */
async function sendShutdown(totalCycles, totalArbitrages, stats) {
  const embed = {
    embeds: [{
      title: '🛑 ARB MVP Stopped',
      color: COLORS.GRAY,
      fields: [
        {
          name: 'Total Cycles',
          value: `${totalCycles}`,
          inline: true
        },
        {
          name: 'Total Arbitrages',
          value: `${totalArbitrages}`,
          inline: true
        },
        {
          name: 'Breakdown',
          value: `Moneyline: ${stats.totalMoneylineArbs}\nSpread: ${stats.totalSpreadArbs}\nTotal: ${stats.totalTotalArbs}`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  await sendWebhook(embed);
}

module.exports = {
  sendArbitrage,
  sendSummary,
  sendError,
  sendStartup,
  sendShutdown
};