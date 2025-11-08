/**
 * Express API Server
 *
 * Provides REST API for bot control and monitoring
 */

import express, { Request, Response } from 'express';
import { ArbitrageEngine } from '../core/ArbitrageEngine';
import { RelayManager } from '../core/RelayManager';
import { logger } from '../utils/logger';

export function createAPIServer(
  engine: ArbitrageEngine,
  relayManager: RelayManager
) {
  const app = express();

  // Middleware
  app.use(express.json());

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    next();
  });

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Bot status
  app.get('/api/bot/status', (req: Request, res: Response) => {
    const status = engine.getStatus();
    res.json({ success: true, data: status });
  });

  // Start bot
  app.post('/api/bot/start', async (req: Request, res: Response) => {
    try {
      await engine.start();
      logger.info('🎮 Bot started via API');
      res.json({ success: true, message: 'Bot started' });
    } catch (error: any) {
      logger.error('Failed to start bot', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Stop bot
  app.post('/api/bot/stop', (req: Request, res: Response) => {
    engine.stop();
    logger.info('🎮 Bot stopped via API');
    res.json({ success: true, message: 'Bot stopped' });
  });

  // Get stats
  app.get('/api/bot/stats', (req: Request, res: Response) => {
    const stats = engine.getStats();
    res.json({ success: true, data: stats });
  });

  // Get relay stats
  app.get('/api/relays/stats', (req: Request, res: Response) => {
    const stats = relayManager.getStats();
    const statsObj = Object.fromEntries(stats);
    res.json({ success: true, data: statsObj });
  });

  // Get relay summary
  app.get('/api/relays/summary', (req: Request, res: Response) => {
    const summary = relayManager.getSummary();
    res.json({ success: true, data: summary });
  });

  // Update config
  app.post('/api/config/update', (req: Request, res: Response) => {
    const config = req.body;
    engine.updateConfig(config);
    logger.info('⚙️  Config updated via API', config);
    res.json({ success: true, message: 'Config updated' });
  });

  return app;
}
