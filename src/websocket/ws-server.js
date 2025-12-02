// src/dashboard/ws-server.js
const WebSocket = require('ws');
const config = require('../../config');

let wss = null;
let isInitialized = false;

/**
 * Initialize WebSocket server for dashboard
 */
function initialize() {
  if (isInitialized) {
    console.log('⚠️  WebSocket server already initialized');
    return;
  }

  if (!config.dashboard?.enabled) {
    console.log('⚠️  Dashboard disabled in config');
    return;
  }

  const port = config.dashboard.port || 8787;

  try {
    wss = new WebSocket.Server({ port });
    isInitialized = true;

    wss.on('connection', (ws) => {
      console.log('📱 Dashboard client connected');

      ws.on('close', () => {
        console.log('📱 Dashboard client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket client error:', error.message);
      });
    });

    wss.on('error', (error) => {
      console.error('WebSocket server error:', error.message);
    });

    console.log(`📊 Dashboard WebSocket server running on port ${port}`);
  } catch (error) {
    console.error('Failed to start WebSocket server:', error.message);
  }
}

/**
 * Broadcast message to all connected clients
 */
function sendMessage(type, data) {
  if (!wss || !isInitialized) return;

  const message = JSON.stringify({
    type,
    data,
    ts: Date.now()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending to client:', error.message);
      }
    }
  });
}

/**
 * Shutdown WebSocket server
 */
function shutdown() {
  if (wss) {
    wss.close();
    isInitialized = false;
    console.log('📊 WebSocket server closed');
  }
}

module.exports = {
  initialize,
  sendMessage,
  shutdown
};