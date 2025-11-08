/**
 * Beaver Build Relay Adapter
 *
 * Implements private transaction publishing via Beaver Build
 * Note: Beaver Build specifics may vary - adjust based on documentation
 */

import axios, { AxiosInstance } from 'axios';
import { BaseRelayAdapter, BundleResult, RelaySimResult } from './BaseRelayAdapter';
import { relayLogger } from '../utils/logger';

export class BeaverAdapter extends BaseRelayAdapter {
  readonly name = 'Beaver';

  private apiKey: string;
  private relayUrl: string;
  private client: AxiosInstance;

  constructor(apiKey: string, relayUrl: string) {
    super();

    this.apiKey = apiKey;
    this.relayUrl = relayUrl;

    this.client = axios.create({
      baseURL: relayUrl,
      timeout: 10000,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    relayLogger.info(`[${this.name}] Initialized`, { relayUrl });
  }

  /**
   * Send bundle to Beaver Build
   */
  async sendBundle(txs: string[], targetBlock?: number): Promise<BundleResult> {
    const startTime = Date.now();

    try {
      relayLogger.debug(`[${this.name}] Sending bundle`, {
        txCount: txs.length,
        targetBlock
      });

      // Beaver Build bundle format (adjust based on actual API)
      const response = await this.client.post('/bundle', {
        transactions: txs,
        targetBlock: targetBlock || 'latest',
        options: {
          revertingAllowed: false
        }
      });

      const latency = Date.now() - startTime;

      if (!response.data.success) {
        relayLogger.warn(`[${this.name}] Bundle rejected`, {
          error: response.data.error,
          latency
        });

        return {
          success: false,
          error: response.data.error || 'Unknown error',
          timestamp: Date.now()
        };
      }

      relayLogger.info(`[${this.name}] Bundle sent successfully`, {
        bundleId: response.data.bundleId,
        latency
      });

      return {
        success: true,
        bundleHash: response.data.bundleId,
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
   * Simulate bundle execution on Beaver Build
   */
  async simulateBundle(txs: string[]): Promise<RelaySimResult> {
    const startTime = Date.now();

    try {
      relayLogger.debug(`[${this.name}] Simulating bundle`, {
        txCount: txs.length
      });

      // Beaver Build simulation endpoint
      const response = await this.client.post('/simulate', {
        transactions: txs,
        stateOverrides: {}
      });

      const latency = Date.now() - startTime;

      // Check for simulation errors
      if (response.data.error || response.data.revert) {
        relayLogger.debug(`[${this.name}] Simulation reverted`, {
          reason: response.data.error || 'Transaction reverted',
          latency
        });

        return {
          revert: true,
          reason: response.data.error || 'Transaction reverted',
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
      const response = await this.client.get('/status', { timeout: 3000 });
      return response.data.status === 'ok' || response.status === 200;
    } catch {
      return false;
    }
  }
}
