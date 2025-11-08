// Shared TypeScript types across workspaces

export interface PoolConfig {
  name: string;
  address: string;
  dex: string;
  token0: string;
  token0Symbol: string;
  token1: string;
  token1Symbol: string;
  feeTier: number;
  enabled: boolean;
  note?: string;
}

export interface ArbitrageConfig {
  minProfitUSD: number;
  minSpreadPercent: number;
  maxSlippage: number;
  maxGasPrice: number;
  tradeSize: number;
}

export interface RelayProvider {
  name: string;
  enabled: boolean;
  apiKey: string;
  relayUrl: string;
  simulationRequired: boolean;
}

export interface PriceUpdate {
  poolAddress: string;
  dex: string;
  price: number;
  timestamp: number;
  blockNumber?: number;
}

export interface ArbitrageOpportunity {
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
}

export interface BotStatus {
  running: boolean;
  startTime?: number;
  totalExecutions: number;
  successfulExecutions: number;
  totalProfit: number;
  lastUpdate: number;
}
