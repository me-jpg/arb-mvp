// src/highfreq/wsServer.js
// WebSocket server for real-time HF tracker broadcasts

const WebSocket = require('ws');

class HFWebSocketServer {
  constructor(port = 8080) {
    this.port = port;
    this.wss = null;
    this.clients = new Set();
    this.messageCount = 0;
  }

  /**
   * Initialize WebSocket server
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port: this.port });

        this.wss.on('connection', (ws, req) => {
          const clientIp = req.socket.remoteAddress;
          console.log(`📡 WebSocket client connected: ${clientIp}`);
          this.clients.add(ws);

          // Send welcome message
          ws.send(JSON.stringify({
            type: 'connected',
            timestamp: new Date().toISOString(),
            message: 'Connected to HF Tracker WebSocket'
          }));

          ws.on('close', () => {
            console.log(`📡 WebSocket client disconnected: ${clientIp}`);
            this.clients.delete(ws);
          });

          ws.on('error', (error) => {
            console.error(`📡 WebSocket error: ${error.message}`);
            this.clients.delete(ws);
          });

          // Handle incoming messages (for future use)
          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              this.handleMessage(ws, data);
            } catch (e) {
              // Ignore invalid JSON
            }
          });
        });

        this.wss.on('listening', () => {
          console.log(`📡 WebSocket server listening on port ${this.port}`);
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error(`📡 WebSocket server error: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming client messages
   */
  handleMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
      case 'subscribe':
        // Future: handle topic subscriptions
        break;
      default:
        // Ignore unknown message types
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    if (!this.wss || this.clients.size === 0) return;

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.messageCount++;

    let sent = 0;
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
          sent++;
        } catch (error) {
          console.error('WebSocket send error:', error.message);
          this.clients.delete(client);
        }
      }
    }

    return sent;
  }

  /**
   * Broadcast line changes
   */
  broadcastLineChanges(changes) {
    if (!changes || changes.length === 0) return;

    this.broadcast({
      type: 'line_changes',
      timestamp: new Date().toISOString(),
      count: changes.length,
      changes: changes.map(c => ({
        eventId: c.eventId,
        book: c.book,
        marketType: c.marketType,
        side: c.side,
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
        oldLine: c.oldLine,
        newLine: c.newLine,
        changeType: c.changeType
      }))
    });
  }

  /**
   * Broadcast arbitrage opportunity
   */
  broadcastArbitrage(arbMessage) {
    if (!arbMessage) return;
    this.broadcast(arbMessage);
  }

  /**
   * Broadcast cycle summary
   */
  broadcastCycleSummary(stats) {
    this.broadcast({
      type: 'cycle_summary',
      timestamp: new Date().toISOString(),
      cycle: stats.cycle,
      oddsRecords: stats.oddsRecords,
      changesDetected: stats.changesDetected,
      arbitragesFound: stats.arbitragesFound || 0,
      cacheSize: stats.cacheSize,
      durationMs: stats.durationMs
    });
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      port: this.port,
      clients: this.clients.size,
      messagesSent: this.messageCount,
      isRunning: this.wss !== null
    };
  }

  /**
   * Shutdown server
   */
  async close() {
    if (this.wss) {
      // Close all client connections
      for (const client of this.clients) {
        client.close(1001, 'Server shutting down');
      }
      this.clients.clear();

      // Close server
      return new Promise((resolve) => {
        this.wss.close(() => {
          console.log('📡 WebSocket server closed');
          this.wss = null;
          resolve();
        });
      });
    }
  }
}

// Singleton instance
let instance = null;

function createServer(port) {
  if (!instance) {
    instance = new HFWebSocketServer(port);
  }
  return instance;
}

function getServer() {
  return instance;
}

module.exports = {
  HFWebSocketServer,
  createServer,
  getServer
};

