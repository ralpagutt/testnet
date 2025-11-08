/**
 * PrivatePublisher - Private Transaction Publishing Orchestrator
 *
 * Coordinates private transaction publishing across multiple relays
 * with automatic failover and dynamic relay selection.
 *
 * Flow:
 * 1. Get sorted relays (best-first)
 * 2. For each relay:
 *    a. Simulate bundle
 *    b. If simulation passes, send bundle
 *    c. Record success/failure
 *    d. Return on first success or continue to next relay
 */

import { RelayManager } from './RelayManager';
import { relayLogger, executionLogger } from '../utils/logger';

export interface PublishResult {
  success: boolean;
  relayName?: string;
  bundleHash?: string;
  latency?: number;
  error?: string;
  attemptedRelays: string[];
}

export class PrivatePublisher {
  private relayManager: RelayManager;
  private simulationRequired: boolean;

  constructor(
    relayManager: RelayManager,
    simulationRequired: boolean = true
  ) {
    this.relayManager = relayManager;
    this.simulationRequired = simulationRequired;

    executionLogger.info('✅ PrivatePublisher initialized', {
      simulationRequired,
      relayCount: relayManager.getRelayCount()
    });
  }

  /**
   * Publish transaction privately with automatic relay failover
   *
   * This is the MAIN method - implements smart relay selection
   */
  async publishPrivate(signedTx: string): Promise<PublishResult> {
    const startTime = Date.now();
    const attemptedRelays: string[] = [];

    // Get relays sorted by performance (best-first)
    const sortedRelays = this.relayManager.getSortedRelays();

    if (sortedRelays.length === 0) {
      executionLogger.error('❌ No relays available');
      return {
        success: false,
        error: 'No relays configured',
        attemptedRelays
      };
    }

    executionLogger.info('📡 Starting private publication', {
      relayCount: sortedRelays.length,
      topRelay: sortedRelays[0].getName()
    });

    // Try each relay in order (best-first)
    for (const relay of sortedRelays) {
      const relayName = relay.getName();
      attemptedRelays.push(relayName);

      const relayStartTime = Date.now();

      try {
        relayLogger.info(`[${relayName}] Attempting publication`);

        // Step 1: Simulate bundle (if required)
        if (this.simulationRequired) {
          relayLogger.debug(`[${relayName}] Running simulation`);

          const simResult = await relay.simulateBundle([signedTx]);

          if (simResult.revert) {
            relayLogger.warn(`[${relayName}] Simulation failed`, {
              reason: simResult.reason
            });

            // Record failure and try next relay
            this.relayManager.recordFailure(relayName, simResult.reason || 'Simulation reverted');
            continue;
          }

          relayLogger.info(`[${relayName}] Simulation passed`, {
            gasUsed: simResult.gasUsed
          });
        }

        // Step 2: Send bundle
        relayLogger.info(`[${relayName}] Sending bundle`);

        const sendResult = await relay.sendBundle([signedTx]);

        const latency = Date.now() - relayStartTime;

        if (!sendResult.success) {
          relayLogger.warn(`[${relayName}] Send failed`, {
            error: sendResult.error,
            latency
          });

          // Record failure and try next relay
          this.relayManager.recordFailure(relayName, sendResult.error || 'Send failed');
          continue;
        }

        // SUCCESS!
        const totalLatency = Date.now() - startTime;

        relayLogger.info(`[${relayName}] ✅ Bundle published successfully`, {
          bundleHash: sendResult.bundleHash,
          latency
        });

        executionLogger.info('✅ Private publication successful', {
          relay: relayName,
          bundleHash: sendResult.bundleHash,
          totalLatency,
          attemptedRelays: attemptedRelays.length
        });

        // Record success
        this.relayManager.recordSuccess(relayName, latency);

        return {
          success: true,
          relayName,
          bundleHash: sendResult.bundleHash,
          latency: totalLatency,
          attemptedRelays
        };

      } catch (error: any) {
        const latency = Date.now() - relayStartTime;

        relayLogger.error(`[${relayName}] Exception`, {
          error: error.message,
          latency
        });

        // Record failure and try next relay
        this.relayManager.recordFailure(relayName, error.message);
        continue;
      }
    }

    // All relays failed
    const totalLatency = Date.now() - startTime;

    executionLogger.error('❌ All relays failed', {
      attemptedCount: attemptedRelays.length,
      totalLatency
    });

    return {
      success: false,
      error: 'All relays failed',
      latency: totalLatency,
      attemptedRelays
    };
  }

  /**
   * Publish to a specific relay (bypass dynamic selection)
   */
  async publishToRelay(signedTx: string, relayName: string): Promise<PublishResult> {
    const startTime = Date.now();

    const sortedRelays = this.relayManager.getSortedRelays();
    const relay = sortedRelays.find(r => r.getName() === relayName);

    if (!relay) {
      return {
        success: false,
        error: `Relay not found: ${relayName}`,
        attemptedRelays: []
      };
    }

    try {
      // Simulate if required
      if (this.simulationRequired) {
        const simResult = await relay.simulateBundle([signedTx]);

        if (simResult.revert) {
          this.relayManager.recordFailure(relayName, simResult.reason || 'Simulation reverted');

          return {
            success: false,
            error: `Simulation failed: ${simResult.reason}`,
            attemptedRelays: [relayName]
          };
        }
      }

      // Send bundle
      const sendResult = await relay.sendBundle([signedTx]);
      const latency = Date.now() - startTime;

      if (!sendResult.success) {
        this.relayManager.recordFailure(relayName, sendResult.error || 'Send failed');

        return {
          success: false,
          error: sendResult.error,
          latency,
          attemptedRelays: [relayName]
        };
      }

      this.relayManager.recordSuccess(relayName, latency);

      return {
        success: true,
        relayName,
        bundleHash: sendResult.bundleHash,
        latency,
        attemptedRelays: [relayName]
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.relayManager.recordFailure(relayName, error.message);

      return {
        success: false,
        error: error.message,
        latency,
        attemptedRelays: [relayName]
      };
    }
  }

  /**
   * Get relay statistics
   */
  getRelayStats() {
    return this.relayManager.getStats();
  }

  /**
   * Get relay summary
   */
  getSummary() {
    return this.relayManager.getSummary();
  }

  /**
   * Enable/disable simulation requirement
   */
  setSimulationRequired(required: boolean): void {
    this.simulationRequired = required;
    executionLogger.info('⚙️  Simulation requirement updated', { required });
  }
}
