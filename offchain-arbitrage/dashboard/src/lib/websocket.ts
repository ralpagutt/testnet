/**
 * WebSocket Client for Real-time Updates
 *
 * Connects to bot WebSocket server and provides reactive stores
 */

import { writable, derived, type Writable } from 'svelte/store';
import type { WSMessage, PriceUpdate, Opportunity, ExecutionResult, BotStats, BotStatus } from './types';

const WS_URL = 'ws://localhost:3002';
const RECONNECT_DELAY = 3000;

// Stores
export const connected: Writable<boolean> = writable(false);
export const botStatus: Writable<BotStatus | null> = writable(null);
export const botStats: Writable<BotStats | null> = writable(null);
export const priceUpdates: Writable<PriceUpdate[]> = writable([]);
export const opportunities: Writable<Opportunity[]> = writable([]);
export const executions: Writable<ExecutionResult[]> = writable([]);

// Derived stores
export const isRunning = derived(botStatus, $status => $status?.isRunning || false);
export const latestPrices = derived(priceUpdates, $updates => {
	const priceMap = new Map<string, PriceUpdate>();
	$updates.forEach(update => {
		priceMap.set(update.poolAddress, update);
	});
	return priceMap;
});

class WebSocketClient {
	private ws: WebSocket | null = null;
	private reconnectTimeout: number | null = null;
	private shouldReconnect = true;

	connect() {
		if (this.ws?.readyState === WebSocket.OPEN) {
			console.log('WebSocket already connected');
			return;
		}

		console.log('🔌 Connecting to WebSocket:', WS_URL);

		try {
			this.ws = new WebSocket(WS_URL);

			this.ws.onopen = () => {
				console.log('✅ WebSocket connected');
				connected.set(true);

				if (this.reconnectTimeout) {
					clearTimeout(this.reconnectTimeout);
					this.reconnectTimeout = null;
				}
			};

			this.ws.onmessage = (event) => {
				try {
					const message: WSMessage = JSON.parse(event.data);
					this.handleMessage(message);
				} catch (error) {
					console.error('Failed to parse WebSocket message:', error);
				}
			};

			this.ws.onerror = (error) => {
				console.error('❌ WebSocket error:', error);
			};

			this.ws.onclose = () => {
				console.log('🔌 WebSocket disconnected');
				connected.set(false);

				if (this.shouldReconnect) {
					this.scheduleReconnect();
				}
			};

		} catch (error) {
			console.error('Failed to create WebSocket:', error);
			this.scheduleReconnect();
		}
	}

	private handleMessage(message: WSMessage) {
		const { type, data } = message;

		switch (type) {
			case 'status':
				botStatus.set(data);
				break;

			case 'stats':
				botStats.set(data);
				break;

			case 'price_update':
				priceUpdates.update(updates => {
					const newUpdates = [...updates, data];
					// Keep only last 100 updates
					return newUpdates.slice(-100);
				});
				break;

			case 'opportunity':
				opportunities.update(opps => {
					const newOpps = [data, ...opps];
					// Keep only last 50 opportunities
					return newOpps.slice(0, 50);
				});
				break;

			case 'execution':
				executions.update(execs => {
					const newExecs = [data, ...execs];
					// Keep only last 100 executions
					return newExecs.slice(0, 100);
				});
				break;

			default:
				console.warn('Unknown message type:', type);
		}
	}

	private scheduleReconnect() {
		if (this.reconnectTimeout) return;

		console.log(`🔄 Reconnecting in ${RECONNECT_DELAY / 1000}s...`);

		this.reconnectTimeout = window.setTimeout(() => {
			this.reconnectTimeout = null;
			this.connect();
		}, RECONNECT_DELAY);
	}

	disconnect() {
		this.shouldReconnect = false;

		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		connected.set(false);
	}

	reconnect() {
		this.disconnect();
		this.shouldReconnect = true;
		this.connect();
	}
}

// Singleton instance
export const wsClient = new WebSocketClient();

// Auto-connect on module load (browser only)
if (typeof window !== 'undefined') {
	wsClient.connect();
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		wsClient.disconnect();
	});
}
