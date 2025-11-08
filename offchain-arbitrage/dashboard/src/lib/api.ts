/**
 * REST API Client
 *
 * Provides functions to interact with bot API
 */

import type { BotStatus, BotStats, RelayStatsMap, ArbitrageConfig } from './types';

const API_BASE = 'http://localhost:3001';

interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

class ApiClient {
	private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
		try {
			const response = await fetch(`${API_BASE}${endpoint}`, {
				headers: {
					'Content-Type': 'application/json',
					...options?.headers
				},
				...options
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const json: ApiResponse<T> = await response.json();

			if (!json.success) {
				throw new Error(json.error || 'API request failed');
			}

			return json.data as T;

		} catch (error) {
			console.error(`API Error [${endpoint}]:`, error);
			throw error;
		}
	}

	// Health check
	async health(): Promise<{ status: string; timestamp: number }> {
		return this.request('/health');
	}

	// Bot status
	async getStatus(): Promise<BotStatus> {
		return this.request('/api/bot/status');
	}

	// Bot stats
	async getStats(): Promise<BotStats> {
		return this.request('/api/bot/stats');
	}

	// Start bot
	async startBot(): Promise<void> {
		await this.request('/api/bot/start', { method: 'POST' });
	}

	// Stop bot
	async stopBot(): Promise<void> {
		await this.request('/api/bot/stop', { method: 'POST' });
	}

	// Relay stats
	async getRelayStats(): Promise<RelayStatsMap> {
		return this.request('/api/relays/stats');
	}

	// Relay summary
	async getRelaySummary(): Promise<{
		totalRelays: number;
		totalRequests: number;
		totalSuccesses: number;
		totalFailures: number;
		overallSuccessRate: number;
	}> {
		return this.request('/api/relays/summary');
	}

	// Update config
	async updateConfig(config: Partial<ArbitrageConfig>): Promise<void> {
		await this.request('/api/config/update', {
			method: 'POST',
			body: JSON.stringify(config)
		});
	}
}

// Singleton instance
export const api = new ApiClient();

// Helper functions
export async function startBot(): Promise<boolean> {
	try {
		await api.startBot();
		return true;
	} catch (error) {
		console.error('Failed to start bot:', error);
		return false;
	}
}

export async function stopBot(): Promise<boolean> {
	try {
		await api.stopBot();
		return true;
	} catch (error) {
		console.error('Failed to stop bot:', error);
		return false;
	}
}

export async function updateConfig(config: Partial<ArbitrageConfig>): Promise<boolean> {
	try {
		await api.updateConfig(config);
		return true;
	} catch (error) {
		console.error('Failed to update config:', error);
		return false;
	}
}
