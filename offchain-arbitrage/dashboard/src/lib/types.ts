// Dashboard TypeScript types

export interface BotStatus {
	isRunning: boolean;
	poolCount: number;
	stats: BotStats;
	config: ArbitrageConfig;
}

export interface BotStats {
	opportunitiesDetected: number;
	opportunitiesExecuted: number;
	successfulExecutions: number;
	failedExecutions: number;
	totalProfit: number;
	isRunning: boolean;
	successRate: number;
}

export interface ArbitrageConfig {
	minProfitUSD: number;
	minSpreadPercent: number;
	maxSlippage: number;
	tradeSize: number;
	enablePrivatePublishing: boolean;
}

export interface PriceUpdate {
	poolAddress: string;
	dex: string;
	price: number;
	timestamp: number;
	blockNumber?: number;
}

export interface Opportunity {
	buyPool: string;
	sellPool: string;
	buyDex: string;
	sellDex: string;
	buyPrice: number;
	sellPrice: number;
	spreadPercent: number;
	estimatedProfit: number;
	timestamp: number;
}

export interface ExecutionResult {
	success: boolean;
	txHash?: string;
	profit?: number;
	gasUsed?: number;
	error?: string;
	timestamp: number;
}

export interface RelayStats {
	successCount: number;
	failCount: number;
	lastSuccess: number;
	avgLatency: number;
	lastError?: string;
	totalRequests: number;
}

export interface RelayStatsMap {
	[relayName: string]: RelayStats;
}

export interface WSMessage {
	type: 'status' | 'stats' | 'price_update' | 'opportunity' | 'execution';
	data: any;
	timestamp: number;
}

export interface ChartData {
	time: number;
	value: number;
}

export interface PoolInfo {
	name: string;
	address: string;
	dex: string;
	currentPrice?: number;
	lastUpdate?: number;
}
