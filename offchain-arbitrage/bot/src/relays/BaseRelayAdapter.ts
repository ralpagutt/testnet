/**
 * Base Relay Adapter Interface
 *
 * All relay providers must implement this interface
 */

export interface BundleResult {
  success: boolean;
  bundleHash?: string;
  error?: string;
  timestamp?: number;
}

export interface RelaySimResult {
  revert: boolean;
  reason?: string;
  gasUsed: number;
  profit?: bigint;
  timestamp?: number;
}

export interface RelayStats {
  successCount: number;
  failCount: number;
  lastSuccess: number;      // timestamp
  avgLatency: number;        // ms
  lastError?: string;
  totalRequests: number;
}

/**
 * Abstract base class for relay adapters
 *
 * Each relay provider (bloXroute, Eden, Beaver) extends this
 */
export abstract class BaseRelayAdapter {
  abstract readonly name: string;
  protected enabled: boolean = true;

  /**
   * Send bundle to relay
   * @param txs - Array of signed transaction hex strings
   * @param targetBlock - Optional target block number
   */
  abstract sendBundle(
    txs: string[],
    targetBlock?: number
  ): Promise<BundleResult>;

  /**
   * Simulate bundle execution
   * @param txs - Array of signed transaction hex strings
   */
  abstract simulateBundle(
    txs: string[]
  ): Promise<RelaySimResult>;

  /**
   * Check if relay is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable/disable relay
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get relay name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Health check - override if relay has health endpoint
   */
  async healthCheck(): Promise<boolean> {
    return this.enabled;
  }
}
