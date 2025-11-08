/**
 * bloXroute Relay Adapter
 *
 * Implements private transaction publishing via bloXroute
 * Documentation: https://docs.bloxroute.com/
 */

import axios, { AxiosInstance } from 'axios';
import { BaseRelayAdapter, BundleResult, RelaySimResult } from './BaseRelayAdapter';
import { relayLogger } from '../utils/logger';

export class BloXrouteAdapter extends BaseRelayAdapter {
  readonly name = 'bloXroute';

  private apiKey: string;
  private relayUrl: string;
  private client: AxiosInstance;

  constructor(apiKey: string, relayUrl: string) {
    super();

    this.apiKey = apiKey;
    this.relayUrl = relayUrl;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: relayUrl,
      timeout: 10000,
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });

    relayLogger.info(`[${this.name}] Initialized`, { relayUrl });
  }

  /**
   * Send bundle to bloXroute
   */
  async sendBundle(txs: string[], targetBlock?: number): Promise<BundleResult> {
    const startTime = Date.now();

    try {
      relayLogger.debug(`[${this.name}] Sending bundle`, {
        txCount: txs.length,
        targetBlock
      });

      // bloXroute bundle submission
      // Note: Actual API may differ - adjust based on documentation
      const response = await this.client.post('/bundle', {
        txs,
        blockNumber: targetBlock,
        minTimestamp: 0,
        maxTimestamp: 0,
        revertingTxHashes: [] // Don't allow reverting txs
      });

      const latency = Date.now() - startTime;

      if (response.data.error) {
        relayLogger.warn(`[${this.name}] Bundle rejected`, {
          error: response.data.error,
          latency
        });

        return {
          success: false,
          error: response.data.error,
          timestamp: Date.now()
        };
      }

      relayLogger.info(`[${this.name}] Bundle sent successfully`, {
        bundleHash: response.data.bundleHash,
        latency
      });

      return {
        success: true,
        bundleHash: response.data.bundleHash,
        timestamp: Date.now()
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;

      relayLogger.error(`[${this.name}] Send bundle failed`, {
        error: error.message,
        latency
      });

      return {
        success: false,
        error: error.response?.data?.error || error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Simulate bundle execution on bloXroute
   */
  async simulateBundle(txs: string[]): Promise<RelaySimResult> {
    const startTime = Date.now();

    try {
      relayLogger.debug(`[${this.name}] Simulating bundle`, {
        txCount: txs.length
      });

      // bloXroute simulation endpoint
      const response = await this.client.post('/simulate', {
        txs,
        blockNumber: 'latest',
        stateBlockNumber: 'latest'
      });

      const latency = Date.now() - startTime;

      // Check if simulation reverted
      const hasError = response.data.error !== null && response.data.error !== undefined;

      if (hasError) {
        relayLogger.debug(`[${this.name}] Simulation reverted`, {
          reason: response.data.error,
          latency
        });

        return {
          revert: true,
          reason: response.data.error,
          gasUsed: 0,
          timestamp: Date.now()
        };
      }

      relayLogger.debug(`[${this.name}] Simulation successful`, {
        gasUsed: response.data.gasUsed,
        latency
      });

      return {
        revert: false,
        gasUsed: response.data.gasUsed || 0,
        profit: response.data.profit ? BigInt(response.data.profit) : undefined,
        timestamp: Date.now()
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;

      relayLogger.error(`[${this.name}] Simulation failed`, {
        error: error.message,
        latency
      });

      return {
        revert: true,
        reason: error.response?.data?.error || error.message,
        gasUsed: 0,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple ping to check if relay is accessible
      const response = await this.client.get('/health', { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
