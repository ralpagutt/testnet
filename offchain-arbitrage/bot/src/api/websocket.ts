/**
 * WebSocket Server
 *
 * Provides real-time updates to dashboard
 */

import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { ArbitrageEngine } from '../core/ArbitrageEngine';
import { PriceMonitor } from '../core/PriceMonitor';

export function createWebSocketServer(
  port: number,
  engine: ArbitrageEngine,
  priceMonitor: PriceMonitor
) {
  const wss = new WebSocketServer({ port });
  const clients = new Set<WebSocket>();

  logger.info(`🔌 WebSocket server listening on port ${port}`);

  // Handle new connections
  wss.on('connection', (ws: WebSocket) => {
    logger.info('🔌 WebSocket client connected');
    clients.add(ws);

    // Send initial status
    send(ws, 'status', engine.getStatus());
    send(ws, 'stats', engine.getStats());

    // Handle client disconnect
    ws.on('close', () => {
      clients.delete(ws);
      logger.info('🔌 WebSocket client disconnected');
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { error: error.message });
    });
  });

  // Register event listeners
  priceMonitor.onPriceUpdate((update) => {
    broadcast('price_update', update);
  });

  engine.onOpportunity((opportunity) => {
    broadcast('opportunity', opportunity);
  });

  engine.onExecution((result) => {
    broadcast('execution', result);
    // Also send updated stats
    broadcast('stats', engine.getStats());
  });

  // Broadcast to all clients
  function broadcast(type: string, data: any) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: Date.now()
    });

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error: any) {
          logger.error('Failed to send WebSocket message', {
            error: error.message
          });
        }
      }
    });
  }

  // Send to single client
  function send(client: WebSocket, type: string, data: any) {
    if (client.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type,
        data,
        timestamp: Date.now()
      });

      try {
        client.send(message);
      } catch (error: any) {
        logger.error('Failed to send WebSocket message', {
          error: error.message
        });
      }
    }
  }

  return { wss, broadcast };
}
