/**
 * PriceMonitor - Real-time Pool Price Monitoring
 *
 * Uses WebSocket to listen for Swap events and track prices
 *
 * Features:
 * - WebSocket connection for low latency
 * - Event-driven price updates
 * - Automatic reconnection
 * - Multiple pool monitoring
 */

import { ethers } from 'ethers';
import { priceLogger } from '../utils/logger';
import { PriceUpdate, PoolConfig } from '../../../shared/types';
import { ABIS } from '../config/constants';

export type PriceUpdateCallback = (update: PriceUpdate) => void;

export class PriceMonitor {
  private provider: ethers.WebSocketProvider;
  private pools: Map<string, PoolConfig> = new Map(); // address (lowercase) -> config
  private priceCache: Map<string, number> = new Map(); // address -> price
  private callbacks: PriceUpdateCallback[] = [];

  // Swap event topic
  private swapTopic = ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)');

  private reconnectDelay = 5000;
  private isRunning = false;

  constructor(wsRpcUrl: string) {
    this.provider = new ethers.WebSocketProvider(wsRpcUrl);

    // Handle WebSocket errors
    this.provider.websocket.on('error', (error) => {
      priceLogger.error('WebSocket error', { error: error.message });
    });

    // Handle WebSocket close
    this.provider.websocket.on('close', () => {
      if (this.isRunning) {
        priceLogger.warn('WebSocket closed, reconnecting...');
        setTimeout(() => this.reconnect(), this.reconnectDelay);
      }
    });

    priceLogger.info('✅ PriceMonitor initialized');
  }

  /**
   * Add a pool to monitor
   */
  addPool(poolConfig: PoolConfig): void {
    const address = poolConfig.address.toLowerCase();
    this.pools.set(address, poolConfig);

    priceLogger.info('📊 Pool added', {
      name: poolConfig.name,
      dex: poolConfig.dex,
      address: poolConfig.address
    });
  }

  /**
   * Add multiple pools
   */
  addPools(poolConfigs: PoolConfig[]): void {
    poolConfigs.forEach(config => this.addPool(config));
  }

  /**
   * Register callback for price updates
   */
  onPriceUpdate(callback: PriceUpdateCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      priceLogger.warn('⚠️  PriceMonitor already running');
      return;
    }

    this.isRunning = true;

    priceLogger.info('🔄 Starting price monitoring', {
      poolCount: this.pools.size,
      callbackCount: this.callbacks.length
    });

    // Initial price fetch for all pools
    await this.fetchInitialPrices();

    // Subscribe to Swap events
    this.subscribeToSwapEvents();

    priceLogger.info('✅ Price monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Remove all listeners
    this.provider.removeAllListeners();

    // Close WebSocket
    this.provider.websocket.close();

    priceLogger.info('⏹️  Price monitoring stopped');
  }

  /**
   * Fetch initial prices for all pools
   */
  private async fetchInitialPrices(): Promise<void> {
    priceLogger.info('📥 Fetching initial prices...');

    const promises = Array.from(this.pools.entries()).map(async ([address, config]) => {
      try {
        const price = await this.getPoolPrice(address);
        this.priceCache.set(address, price);

        priceLogger.debug(`[${config.dex}] Initial price`, {
          pool: config.name,
          price: price.toFixed(6)
        });

        // Emit initial price update
        this.emitPriceUpdate({
          poolAddress: address,
          dex: config.dex,
          price,
          timestamp: Date.now()
        });

      } catch (error: any) {
        priceLogger.error(`Failed to fetch initial price for ${config.name}`, {
          error: error.message
        });
      }
    });

    await Promise.all(promises);

    priceLogger.info('✅ Initial prices fetched', {
      count: this.priceCache.size
    });
  }

  /**
   * Subscribe to Swap events on all pools
   */
  private subscribeToSwapEvents(): void {
    // Create filter for Swap events
    const filter = {
      topics: [this.swapTopic]
    };

    priceLogger.info('🎧 Subscribing to Swap events');

    // Listen for all Swap events
    this.provider.on(filter, async (log) => {
      const poolAddress = log.address.toLowerCase();

      // Check if we're monitoring this pool
      if (!this.pools.has(poolAddress)) {
        return;
      }

      const poolConfig = this.pools.get(poolAddress)!;

      try {
        // Fetch updated price
        const price = await this.getPoolPrice(poolAddress);

        // Update cache
        const oldPrice = this.priceCache.get(poolAddress);
        this.priceCache.set(poolAddress, price);

        // Calculate price change
        const priceChange = oldPrice ? ((price - oldPrice) / oldPrice) * 100 : 0;

        priceLogger.debug(`[${poolConfig.dex}] Price update`, {
          pool: poolConfig.name,
          price: price.toFixed(6),
          change: `${priceChange.toFixed(4)}%`,
          blockNumber: log.blockNumber
        });

        // Emit price update
        this.emitPriceUpdate({
          poolAddress,
          dex: poolConfig.dex,
          price,
          timestamp: Date.now(),
          blockNumber: log.blockNumber
        });

      } catch (error: any) {
        priceLogger.error(`Error processing Swap event for ${poolConfig.name}`, {
          error: error.message
        });
      }
    });
  }

  /**
   * Get current price from pool
   */
  private async getPoolPrice(poolAddress: string): Promise<number> {
    const poolContract = new ethers.Contract(
      poolAddress,
      ABIS.UNISWAP_V3_POOL,
      this.provider
    );

    // Get slot0 (contains sqrtPriceX96)
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0[0]; // sqrtPriceX96 is the first return value

    // Calculate price from sqrtPriceX96
    // price = (sqrtPriceX96 / 2^96)^2
    const Q96 = 2n ** 96n;
    const priceRaw = (sqrtPriceX96 * sqrtPriceX96) / Q96;

    // Adjust for decimals (USDC = 6, WETH = 18)
    // This gives price in USDC per WETH
    const price = Number(priceRaw) / Number(Q96) * (10 ** 12); // 10^12 = 10^18 / 10^6

    return price;
  }

  /**
   * Emit price update to all callbacks
   */
  private emitPriceUpdate(update: PriceUpdate): void {
    this.callbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error: any) {
        priceLogger.error('Error in price update callback', {
          error: error.message
        });
      }
    });
  }

  /**
   * Get current cached prices
   */
  getCurrentPrices(): Map<string, number> {
    return new Map(this.priceCache);
  }

  /**
   * Get price for specific pool
   */
  getPrice(poolAddress: string): number | undefined {
    return this.priceCache.get(poolAddress.toLowerCase());
  }

  /**
   * Reconnect WebSocket
   */
  private async reconnect(): Promise<void> {
    priceLogger.info('🔄 Reconnecting WebSocket...');

    try {
      // Create new WebSocket provider
      this.provider = new ethers.WebSocketProvider(this.provider.websocket.url);

      // Re-subscribe
      await this.start();

      priceLogger.info('✅ Reconnected successfully');

    } catch (error: any) {
      priceLogger.error('Reconnection failed', { error: error.message });

      // Retry after delay
      setTimeout(() => this.reconnect(), this.reconnectDelay);
    }
  }

  /**
   * Get monitored pool count
   */
  getPoolCount(): number {
    return this.pools.size;
  }

  /**
   * Get provider
   */
  getProvider(): ethers.WebSocketProvider {
    return this.provider;
  }
}
