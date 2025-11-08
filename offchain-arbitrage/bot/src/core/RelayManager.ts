/**
 * RelayManager - Dynamic Relay Selection
 *
 * Manages multiple relay providers with intelligent selection
 * based on success rate, latency, and recency.
 *
 * Key Features:
 * - Dynamic weighting (best-first selection)
 * - Performance tracking per relay
 * - Automatic failover
 * - Health monitoring
 */

import { BaseRelayAdapter, RelayStats } from '../relays/BaseRelayAdapter';
import { relayLogger } from '../utils/logger';

export class RelayManager {
  private relays: BaseRelayAdapter[] = [];
  private stats: Map<string, RelayStats> = new Map();

  constructor() {
    relayLogger.info('✅ RelayManager initialized');
  }

  /**
   * Add a relay provider
   */
  addRelay(relay: BaseRelayAdapter): void {
    if (!relay.isEnabled()) {
      relayLogger.warn(`⚠️  Relay ${relay.getName()} is disabled, skipping`);
      return;
    }

    this.relays.push(relay);

    // Initialize stats for this relay
    this.stats.set(relay.getName(), {
      successCount: 0,
      failCount: 0,
      lastSuccess: 0,
      avgLatency: 0,
      totalRequests: 0
    });

    relayLogger.info(`✅ Relay added: ${relay.getName()}`);
  }

  /**
   * Calculate score for a relay based on performance
   * Higher score = better relay
   *
   * Scoring formula:
   * - Base: Success rate (0-1)
   * - Bonus: Recent success (+0.1 if successful in last 60s)
   * - Penalty: High latency (-0.1 if avg latency > 1000ms)
   * - Penalty: Recent failure (-0.2 if last attempt failed)
   */
  private calculateScore(stats: RelayStats): number {
    const total = stats.successCount + stats.failCount;

    // New relay gets neutral score
    if (total === 0) {
      return 0.5;
    }

    // Base score: success rate (0-1)
    const successRate = stats.successCount / total;

    // Recency bonus: Recent success is valuable
    const now = Date.now();
    const recencyBonus = (now - stats.lastSuccess) < 60000 ? 0.1 : 0;

    // Latency penalty: Slow relays are penalized
    const latencyPenalty = stats.avgLatency > 1000 ? -0.1 : 0;

    // Recent failure penalty
    const recentFailurePenalty = stats.lastError && (now - stats.lastSuccess) > 60000 ? -0.2 : 0;

    const score = successRate + recencyBonus + latencyPenalty + recentFailurePenalty;

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get relays sorted by score (best first)
   * This is the KEY method for dynamic selection
   */
  getSortedRelays(): BaseRelayAdapter[] {
    if (this.relays.length === 0) {
      relayLogger.warn('⚠️  No relays available');
      return [];
    }

    // Calculate scores and sort
    const scored = this.relays.map(relay => {
      const stats = this.stats.get(relay.getName())!;
      const score = this.calculateScore(stats);

      return { relay, score };
    });

    // Sort by score DESC (highest first)
    scored.sort((a, b) => b.score - a.score);

    relayLogger.debug('📊 Relay ranking', {
      relays: scored.map(s => ({
        name: s.relay.getName(),
        score: s.score.toFixed(3)
      }))
    });

    return scored.map(s => s.relay);
  }

  /**
   * Get best relay (highest score)
   */
  getBestRelay(): BaseRelayAdapter | null {
    const sorted = this.getSortedRelays();
    return sorted.length > 0 ? sorted[0] : null;
  }

  /**
   * Record successful relay operation
   */
  recordSuccess(relayName: string, latency: number): void {
    const stats = this.stats.get(relayName);
    if (!stats) {
      relayLogger.warn(`⚠️  Unknown relay: ${relayName}`);
      return;
    }

    stats.successCount++;
    stats.lastSuccess = Date.now();
    stats.totalRequests++;

    // Update moving average latency
    stats.avgLatency = stats.avgLatency === 0
      ? latency
      : (stats.avgLatency * (stats.successCount - 1) + latency) / stats.successCount;

    relayLogger.debug(`✅ [${relayName}] Success recorded`, {
      latency: `${latency}ms`,
      successRate: `${((stats.successCount / stats.totalRequests) * 100).toFixed(1)}%`
    });
  }

  /**
   * Record failed relay operation
   */
  recordFailure(relayName: string, error: string): void {
    const stats = this.stats.get(relayName);
    if (!stats) {
      relayLogger.warn(`⚠️  Unknown relay: ${relayName}`);
      return;
    }

    stats.failCount++;
    stats.lastError = error;
    stats.totalRequests++;

    relayLogger.debug(`❌ [${relayName}] Failure recorded`, {
      error,
      successRate: `${((stats.successCount / stats.totalRequests) * 100).toFixed(1)}%`
    });
  }

  /**
   * Get statistics for all relays
   * Used by dashboard
   */
  getStats(): Map<string, RelayStats> {
    return new Map(this.stats);
  }

  /**
   * Get statistics for a specific relay
   */
  getRelayStats(relayName: string): RelayStats | undefined {
    return this.stats.get(relayName);
  }

  /**
   * Reset statistics for a relay
   */
  resetStats(relayName: string): void {
    const stats = this.stats.get(relayName);
    if (!stats) return;

    stats.successCount = 0;
    stats.failCount = 0;
    stats.lastSuccess = 0;
    stats.avgLatency = 0;
    stats.lastError = undefined;
    stats.totalRequests = 0;

    relayLogger.info(`🔄 [${relayName}] Stats reset`);
  }

  /**
   * Reset all statistics
   */
  resetAllStats(): void {
    this.stats.forEach((_, relayName) => {
      this.resetStats(relayName);
    });

    relayLogger.info('🔄 All relay stats reset');
  }

  /**
   * Get total relay count
   */
  getRelayCount(): number {
    return this.relays.length;
  }

  /**
   * Check health of all relays
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const healthMap = new Map<string, boolean>();

    const promises = this.relays.map(async (relay) => {
      const healthy = await relay.healthCheck();
      healthMap.set(relay.getName(), healthy);
      return { name: relay.getName(), healthy };
    });

    const results = await Promise.all(promises);

    relayLogger.info('🏥 Health check complete', {
      results: results.map(r => ({ name: r.name, healthy: r.healthy }))
    });

    return healthMap;
  }

  /**
   * Disable a relay
   */
  disableRelay(relayName: string): void {
    const relay = this.relays.find(r => r.getName() === relayName);
    if (relay) {
      relay.setEnabled(false);
      relayLogger.info(`🔒 Relay disabled: ${relayName}`);
    }
  }

  /**
   * Enable a relay
   */
  enableRelay(relayName: string): void {
    const relay = this.relays.find(r => r.getName() === relayName);
    if (relay) {
      relay.setEnabled(true);
      relayLogger.info(`🔓 Relay enabled: ${relayName}`);
    }
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRelays: number;
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    overallSuccessRate: number;
  } {
    let totalRequests = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;

    this.stats.forEach(stats => {
      totalRequests += stats.totalRequests;
      totalSuccesses += stats.successCount;
      totalFailures += stats.failCount;
    });

    return {
      totalRelays: this.relays.length,
      totalRequests,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalRequests > 0 ? (totalSuccesses / totalRequests) : 0
    };
  }
}
