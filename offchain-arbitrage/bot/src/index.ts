/**
 * Off-Chain Arbitrage Bot - Main Entry Point
 *
 * This file initializes and starts the arbitrage bot with all components
 */

import { PreflightSimulator } from './core/PreflightSimulator';
import { PrivatePublisher } from './core/PrivatePublisher';
import { FlashLoanExecutor } from './core/FlashLoanExecutor';
import { PriceMonitor } from './core/PriceMonitor';
import { ArbitrageEngine } from './core/ArbitrageEngine';
import { RelayManager } from './core/RelayManager';
import { BloXrouteAdapter } from './relays/BloXrouteAdapter';
import { EdenAdapter } from './relays/EdenAdapter';
import { BeaverAdapter } from './relays/BeaverAdapter';
import { createAPIServer } from './api/server';
import { createWebSocketServer } from './api/websocket';
import { getConfig, validateConfig } from './config/config';
import { getPrivateKey } from './utils/encryption';
import { logger } from './utils/logger';

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         OFF-CHAIN ARBITRAGE BOT - ARBITRUM MAINNET           ║
║                                                               ║
║  🎯 Target: USDC-WETH Pools (Uniswap V3 + Camelot)          ║
║  🔒 MEV Protection: Private Transaction Publishing           ║
║  ⚡ Execution: Flash Loans via Aave V3                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  logger.info('🚀 Initializing Off-Chain Arbitrage Bot...');

  // Load configuration
  logger.info('📋 Loading configuration...');
  const config = getConfig();

  // Validate configuration
  const validation = validateConfig();
  if (!validation.valid) {
    logger.error('❌ Invalid configuration:', { errors: validation.errors });
    process.exit(1);
  }

  logger.info('✅ Configuration validated');

  // Get private key
  logger.info('🔑 Loading wallet...');
  let privateKey: string;
  try {
    privateKey = getPrivateKey(config);
    logger.info('✅ Wallet loaded successfully');
  } catch (error: any) {
    logger.error('❌ Failed to load wallet:', { error: error.message });
    logger.error('💡 Tip: Set PRIVATE_KEY in .env or create encrypted keystore');
    process.exit(1);
  }

  // Initialize components
  logger.info('⚙️  Initializing components...');

  // 1. PreflightSimulator (Priority #1)
  const simulator = new PreflightSimulator(
    config.network.rpcHttps,
    config.arbitrage.minProfitUSD
  );

  // 2. RelayManager + Adapters
  const relayManager = new RelayManager();

  // Add relay providers if enabled
  config.relay.providers.forEach((providerConfig) => {
    if (!providerConfig.enabled || !providerConfig.apiKey) {
      logger.info(`⏭️  Skipping ${providerConfig.name} (not configured)`);
      return;
    }

    let adapter;
    switch (providerConfig.name.toLowerCase()) {
      case 'bloxroute':
        adapter = new BloXrouteAdapter(providerConfig.apiKey, providerConfig.relayUrl);
        break;
      case 'eden':
        adapter = new EdenAdapter(providerConfig.apiKey, providerConfig.relayUrl);
        break;
      case 'beaver':
        adapter = new BeaverAdapter(providerConfig.apiKey, providerConfig.relayUrl);
        break;
      default:
        logger.warn(`⚠️  Unknown relay provider: ${providerConfig.name}`);
        return;
    }

    relayManager.addRelay(adapter);
  });

  // 3. PrivatePublisher
  const publisher = new PrivatePublisher(
    relayManager,
    config.relay.enabled
  );

  // 4. FlashLoanExecutor
  const executor = new FlashLoanExecutor(
    config.network.rpcHttps,
    privateKey,
    config.flashLoan.receiverAddress
  );

  // 5. PriceMonitor
  const priceMonitor = new PriceMonitor(config.network.rpcWss);

  // 6. ArbitrageEngine
  const engine = new ArbitrageEngine(
    simulator,
    publisher,
    executor,
    priceMonitor,
    {
      minProfitUSD: config.arbitrage.minProfitUSD,
      minSpreadPercent: config.arbitrage.minSpreadPercent,
      maxSlippage: config.arbitrage.maxSlippage,
      tradeSize: config.arbitrage.tradeSize,
      enablePrivatePublishing: config.relay.enabled
    }
  );

  // Set pools
  engine.setPools(config.pools);

  logger.info('✅ All components initialized');

  // Start API server
  logger.info('🌐 Starting API server...');
  const apiServer = createAPIServer(engine, relayManager);
  apiServer.listen(config.api.port, () => {
    logger.info(`✅ API server listening on http://localhost:${config.api.port}`);
  });

  // Start WebSocket server
  logger.info('🔌 Starting WebSocket server...');
  createWebSocketServer(config.api.wsPort, engine, priceMonitor);
  logger.info(`✅ WebSocket server listening on ws://localhost:${config.api.wsPort}`);

  // Print configuration summary
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    CONFIGURATION SUMMARY                      ║
╠═══════════════════════════════════════════════════════════════╣
║ Network:          ${config.network.chainId} (Arbitrum)
║ Wallet:           ${executor.getWalletAddress()}
║
║ Flash Loan:
║   Provider:       Aave V3
║   Receiver:       ${config.flashLoan.receiverAddress || '⚠️  NOT DEPLOYED'}
║
║ Arbitrage:
║   Min Profit:     $${config.arbitrage.minProfitUSD}
║   Min Spread:     ${config.arbitrage.minSpreadPercent}%
║   Trade Size:     ${config.arbitrage.tradeSize} USDC
║
║ Pools:            ${config.pools.length} pools
${config.pools.map(p => `║   - ${p.name}`).join('\n')}
║
║ Relays:           ${relayManager.getRelayCount()} configured
║   Private Mode:   ${config.relay.enabled ? '✅ ENABLED' : '❌ DISABLED'}
║
║ API:
║   REST:           http://localhost:${config.api.port}
║   WebSocket:      ws://localhost:${config.api.wsPort}
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Warning if contract not deployed
  if (!config.flashLoan.receiverAddress) {
    logger.warn('⚠️  ═════════════════════════════════════════════════════');
    logger.warn('⚠️  WARNING: Flash loan receiver contract not deployed!');
    logger.warn('⚠️  Deploy contract first:');
    logger.warn('⚠️    cd contracts && npx hardhat run scripts/deploy.ts --network arbitrum');
    logger.warn('⚠️  Then update .env with FLASH_LOAN_RECEIVER_ADDRESS');
    logger.warn('⚠️  ═════════════════════════════════════════════════════');
  }

  // Auto-start option
  const autoStart = process.env.AUTO_START === 'true';

  if (autoStart) {
    logger.info('🚀 AUTO_START enabled, starting bot...');
    await engine.start();
  } else {
    logger.info('💡 Bot ready. Start via:');
    logger.info('   - API: POST http://localhost:3001/api/bot/start');
    logger.info('   - Dashboard: Open http://localhost:3000 (after starting dashboard)');
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n📴 Received SIGINT, shutting down gracefully...');
    engine.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\n📴 Received SIGTERM, shutting down gracefully...');
    engine.stop();
    process.exit(0);
  });
}

// Start the bot
main().catch((error) => {
  logger.error('❌ Fatal error:', error);
  process.exit(1);
});
