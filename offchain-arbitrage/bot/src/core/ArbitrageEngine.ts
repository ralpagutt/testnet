/**
 * ArbitrageEngine - Main Orchestrator
 *
 * Coordinates all components to execute arbitrage opportunities:
 * 1. Price Monitor detects price changes
 * 2. Engine evaluates opportunities
 * 3. PreflightSimulator validates profitability
 * 4. FlashLoanExecutor builds transaction
 * 5. PrivatePublisher sends via relay
 *
 * This is the HEART of the bot
 */

import { PreflightSimulator } from './PreflightSimulator';
import { PrivatePublisher } from './PrivatePublisher';
import { FlashLoanExecutor } from './FlashLoanExecutor';
import { PriceMonitor } from './PriceMonitor';
import { logger, logOpportunity, logExecution } from '../utils/logger';
import { ArbitrageOpportunity, ExecutionResult, PoolConfig } from '../../../shared/types';
import { TOKENS } from '../config/constants';

export interface ArbitrageConfig {
  minProfitUSD: number;
  minSpreadPercent: number;
  maxSlippage: number;
  tradeSize: number;
  enablePrivatePublishing: boolean;
}

export class ArbitrageEngine {
  private simulator: PreflightSimulator;
  private publisher: PrivatePublisher;
  private executor: FlashLoanExecutor;
  private monitor: PriceMonitor;
  private config: ArbitrageConfig;

  private isRunning = false;
  private pools: PoolConfig[] = [];

  // Statistics
  private stats = {
    opportunitiesDetected: 0,
    opportunitiesExecuted: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalProfit: 0
  };

  // Event callbacks
  private onOpportunityCallbacks: Array<(opp: ArbitrageOpportunity) => void> = [];
  private onExecutionCallbacks: Array<(result: ExecutionResult) => void> = [];

  constructor(
    simulator: PreflightSimulator,
    publisher: PrivatePublisher,
    executor: FlashLoanExecutor,
    monitor: PriceMonitor,
    config: ArbitrageConfig
  ) {
    this.simulator = simulator;
    this.publisher = publisher;
    this.executor = executor;
    this.monitor = monitor;
    this.config = config;

    logger.info('✅ ArbitrageEngine initialized', {
      minProfitUSD: config.minProfitUSD,
      minSpreadPercent: config.minSpreadPercent,
      tradeSize: config.tradeSize
    });
  }

  /**
   * Set monitored pools
   */
  setPools(pools: PoolConfig[]): void {
    this.pools = pools;
    this.monitor.addPools(pools);

    logger.info('📊 Pools configured', {
      count: pools.length,
      pools: pools.map(p => p.name)
    });
  }

  /**
   * Start arbitrage bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️  ArbitrageEngine already running');
      return;
    }

    this.isRunning = true;

    logger.info('🚀 Starting ArbitrageEngine...');

    // Register price update handler
    this.monitor.onPriceUpdate(() => {
      if (this.isRunning) {
        this.checkOpportunities();
      }
    });

    // Start price monitoring
    await this.monitor.start();

    logger.info('✅ ArbitrageEngine started successfully');
  }

  /**
   * Stop arbitrage bot
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.monitor.stop();

    logger.info('⏹️  ArbitrageEngine stopped', {
      stats: this.getStats()
    });
  }

  /**
   * Check for arbitrage opportunities
   */
  private async checkOpportunities(): Promise<void> {
    const prices = this.monitor.getCurrentPrices();

    if (prices.size < 2) {
      return; // Need at least 2 pools
    }

    // Convert to array for easier iteration
    const poolEntries = Array.from(prices.entries());

    // Compare all pool pairs
    for (let i = 0; i < poolEntries.length; i++) {
      for (let j = i + 1; j < poolEntries.length; j++) {
        const [pool1Address, price1] = poolEntries[i];
        const [pool2Address, price2] = poolEntries[j];

        // Calculate spread
        const spread = Math.abs(price1 - price2);
        const spreadPercent = (spread / Math.min(price1, price2)) * 100;

        // Check if spread is significant enough
        if (spreadPercent < this.config.minSpreadPercent) {
          continue;
        }

        // Determine buy/sell pools
        const buyPool = price1 < price2 ? pool1Address : pool2Address;
        const sellPool = price1 < price2 ? pool2Address : pool1Address;
        const buyPrice = Math.min(price1, price2);
        const sellPrice = Math.max(price1, price2);

        // Get pool configs
        const buyPoolConfig = this.pools.find(p => p.address.toLowerCase() === buyPool);
        const sellPoolConfig = this.pools.find(p => p.address.toLowerCase() === sellPool);

        if (!buyPoolConfig || !sellPoolConfig) continue;

        // Create opportunity object
        const opportunity: ArbitrageOpportunity = {
          buyPool,
          sellPool,
          buyDex: buyPoolConfig.dex,
          sellDex: sellPoolConfig.dex,
          buyPrice,
          sellPrice,
          spreadPercent,
          estimatedProfit: 0, // Will be calculated in simulation
          timestamp: Date.now()
        };

        // Log opportunity
        this.stats.opportunitiesDetected++;
        logOpportunity(opportunity);

        // Emit opportunity event
        this.emitOpportunity(opportunity);

        // Execute if profitable
        await this.evaluateAndExecute(opportunity);
      }
    }
  }

  /**
   * Evaluate and execute opportunity
   */
  private async evaluateAndExecute(opportunity: ArbitrageOpportunity): Promise<void> {
    logger.info('🔍 Evaluating opportunity', {
      spread: `${opportunity.spreadPercent.toFixed(2)}%`,
      buyDex: opportunity.buyDex,
      sellDex: opportunity.sellDex
    });

    // Build flash loan parameters
    const tradeAmount = BigInt(this.config.tradeSize) * 10n**6n; // USDC has 6 decimals

    // Calculate expected amounts (simplified - real bot should use actual DEX math)
    const expectedAmountAfterBuy = tradeAmount * BigInt(Math.floor(opportunity.sellPrice / opportunity.buyPrice * 1e6)) / 1000000n;
    const expectedFinalAmount = expectedAmountAfterBuy * BigInt(Math.floor((1 - this.config.maxSlippage / 100) * 1e6)) / 1000000n;

    const flashLoanParams = {
      contractAddress: process.env.FLASH_LOAN_RECEIVER_ADDRESS || '',
      asset: TOKENS.USDC,
      amount: tradeAmount,
      path: [opportunity.buyPool, opportunity.sellPool],
      amountsOut: [expectedAmountAfterBuy, expectedFinalAmount]
    };

    // Step 1: Local preflight simulation
    logger.info('🧪 Running preflight simulation...');
    const simResult = await this.simulator.simulate(flashLoanParams);

    if (!simResult.profitable) {
      logger.warn('❌ Simulation: not profitable', {
        netProfitUSD: simResult.netProfitUSD.toFixed(2),
        reason: simResult.revertReason
      });
      return;
    }

    logger.info('✅ Simulation: profitable!', {
      netProfitUSD: `$${simResult.netProfitUSD.toFixed(2)}`,
      gasEstimate: simResult.gasEstimate.toString()
    });

    // Update opportunity with simulated profit
    opportunity.estimatedProfit = simResult.netProfitUSD;

    // Step 2: Build and sign flash loan transaction
    logger.info('🔧 Building transaction...');

    const executorParams = {
      asset: TOKENS.USDC,
      amount: tradeAmount,
      path: [TOKENS.USDC, TOKENS.WETH, TOKENS.USDC],
      amountsOut: [expectedAmountAfterBuy, expectedFinalAmount]
    };

    let signedTx: string;
    try {
      signedTx = await this.executor.buildAndSign(executorParams);
    } catch (error: any) {
      logger.error('❌ Failed to build transaction', { error: error.message });
      this.recordExecution({ success: false, error: error.message, timestamp: Date.now() });
      return;
    }

    // Step 3: Publish transaction
    this.stats.opportunitiesExecuted++;

    logger.info('📡 Publishing transaction...');

    let publishResult;
    if (this.config.enablePrivatePublishing) {
      // Use private relay
      publishResult = await this.publisher.publishPrivate(signedTx);
    } else {
      // Use public RPC
      try {
        const txResponse = await this.executor.sendTransaction(signedTx);
        publishResult = {
          success: true,
          bundleHash: txResponse.hash
        };
      } catch (error: any) {
        publishResult = {
          success: false,
          error: error.message
        };
      }
    }

    // Record result
    if (publishResult.success) {
      logger.info('✅ Transaction published successfully', {
        hash: publishResult.bundleHash,
        relay: publishResult.relayName || 'public'
      });

      this.stats.successfulExecutions++;
      this.stats.totalProfit += simResult.netProfitUSD;

      this.recordExecution({
        success: true,
        txHash: publishResult.bundleHash,
        profit: simResult.netProfitUSD,
        gasUsed: Number(simResult.gasEstimate),
        timestamp: Date.now()
      });

    } else {
      logger.error('❌ Transaction publication failed', {
        error: publishResult.error
      });

      this.stats.failedExecutions++;

      this.recordExecution({
        success: false,
        error: publishResult.error,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Record execution result
   */
  private recordExecution(result: ExecutionResult): void {
    logExecution(result);
    this.emitExecution(result);
  }

  /**
   * Register opportunity callback
   */
  onOpportunity(callback: (opp: ArbitrageOpportunity) => void): void {
    this.onOpportunityCallbacks.push(callback);
  }

  /**
   * Register execution callback
   */
  onExecution(callback: (result: ExecutionResult) => void): void {
    this.onExecutionCallbacks.push(callback);
  }

  /**
   * Emit opportunity event
   */
  private emitOpportunity(opportunity: ArbitrageOpportunity): void {
    this.onOpportunityCallbacks.forEach(callback => {
      try {
        callback(opportunity);
      } catch (error: any) {
        logger.error('Error in opportunity callback', { error: error.message });
      }
    });
  }

  /**
   * Emit execution event
   */
  private emitExecution(result: ExecutionResult): void {
    this.onExecutionCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error: any) {
        logger.error('Error in execution callback', { error: error.message });
      }
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      successRate: this.stats.opportunitiesExecuted > 0
        ? (this.stats.successfulExecutions / this.stats.opportunitiesExecuted) * 100
        : 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ArbitrageConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.minProfitUSD) {
      this.simulator.setMinProfitUSD(config.minProfitUSD);
    }

    logger.info('⚙️  Configuration updated', this.config);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      poolCount: this.pools.length,
      stats: this.getStats(),
      config: this.config
    };
  }
}
