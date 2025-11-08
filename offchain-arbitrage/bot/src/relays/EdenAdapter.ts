/**
 * Eden Network Relay Adapter
 *
 * Implements private transaction publishing via Eden Network
 * Documentation: https://docs.edennetwork.io/
 */

import axios, { AxiosInstance } from 'axios';
import { BaseRelayAdapter, BundleResult, RelaySimResult } from './BaseRelayAdapter';
import { relayLogger } from '../utils/logger';

export class EdenAdapter extends BaseRelayAdapter {
  readonly name = 'Eden';

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
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    relayLogger.info(`[${this.name}] Initialized`, { relayUrl });
  }

  /**
   * Send bundle to Eden Network
   */
  async sendBundle(txs: string[], targetBlock?: number): Promise<BundleResult> {
    const startTime = Date.now();

    try {
      relayLogger.debug(`[${this.name}] Sending bundle`, {
        txCount: txs.length,
        targetBlock
      });

      // Eden Network uses JSON-RPC format
      const response = await this.client.post('', {
        jsonrpc: '2.0',
        method: 'eth_sendBundle',
        params: [
          {
            txs,
            blockNumber: targetBlock ? `0x${targetBlock.toString(16)}` : undefined,
            minTimestamp: 0,
            maxTimestamp: 0
          }
        ],
        id: Date.now()
      });

      const latency = Date.now() - startTime;

      // Check for JSON-RPC error
      if (response.data.error) {
        relayLogger.warn(`[${this.name}] Bundle rejected`, {
          error: response.data.error.message,
          latency
        });

        return {
          success: false,
          error: response.data.error.message,
          timestamp: Date.now()
        };
      }

      relayLogger.info(`[${this.name}] Bundle sent successfully`, {
        bundleHash: response.data.result,
        latency
      });

      return {
        success: true,
        bundleHash: response.data.result,
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
        error: error.response?.data?.error?.message || error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Simulate bundle execution on Eden
   */
  async simulateBundle(txs: string[]): Promise<RelaySimResult> {
    const startTime = Date.now();

    try {
      relayLogger.debug(`[${this.name}] Simulating bundle`, {
        txCount: txs.length
      });

      // Eden simulation endpoint (adjust if different)
      const response = await this.client.post('', {
        jsonrpc: '2.0',
        method: 'eth_callBundle',
        params: [
          {
            txs,
            blockNumber: 'latest',
            stateBlockNumber: 'latest'
          }
        ],
        id: Date.now()
      });

      const latency = Date.now() - startTime;

      // Check for JSON-RPC error
      if (response.data.error) {
        relayLogger.debug(`[${this.name}] Simulation reverted`, {
          reason: response.data.error.message,
          latency
        });

        return {
          revert: true,
          reason: response.data.error.message,
          gasUsed: 0,
          timestamp: Date.now()
        };
      }

      const result = response.data.result;

      // Check if any transaction reverted
      const hasRevert = result.results?.some((r: any) => r.error || r.revert);

      if (hasRevert) {
        const revertReason = result.results?.find((r: any) => r.error)?.error || 'Transaction reverted';

        relayLogger.debug(`[${this.name}] Simulation reverted`, {
          reason: revertReason,
          latency
        });

        return {
          revert: true,
          reason: revertReason,
          gasUsed: 0,
          timestamp: Date.now()
        };
      }

      const totalGasUsed = result.results?.reduce((sum: number, r: any) => sum + (r.gasUsed || 0), 0) || 0;

      relayLogger.debug(`[${this.name}] Simulation successful`, {
        gasUsed: totalGasUsed,
        latency
      });

      return {
        revert: false,
        gasUsed: totalGasUsed,
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
        reason: error.response?.data?.error?.message || error.message,
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
      // Simple JSON-RPC call to check connectivity
      const response = await this.client.post('', {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      }, { timeout: 3000 });

      return response.data.result !== undefined;
    } catch {
      return false;
    }
  }
}
