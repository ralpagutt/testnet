import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { PoolConfig, ArbitrageConfig, RelayProvider } from '../../../shared/types';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export interface AppConfig {
  network: {
    chainId: number;
    rpcWss: string;
    rpcHttps: string;
  };
  flashLoan: {
    poolAddress: string;
    receiverAddress: string;
    fee: number;
  };
  relay: {
    enabled: boolean;
    providers: RelayProvider[];
  };
  arbitrage: ArbitrageConfig;
  pools: PoolConfig[];
  api: {
    port: number;
    wsPort: number;
  };
  wallet: {
    privateKey?: string;
    keystorePath?: string;
    password?: string;
  };
}

class ConfigLoader {
  private config: AppConfig | null = null;
  private configPath: string;

  constructor() {
    this.configPath = path.join(__dirname, '../../../config/arbitrage.config.json');
  }

  /**
   * Load configuration from JSON file and environment variables
   */
  load(): AppConfig {
    if (this.config) {
      return this.config;
    }

    // Load JSON config
    const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));

    // Override with environment variables
    this.config = {
      network: {
        chainId: parseInt(process.env.CHAIN_ID || '42161'),
        rpcWss: process.env.ARBITRUM_RPC_WSS || configData.network.rpcWss,
        rpcHttps: process.env.ARBITRUM_RPC_HTTPS || configData.network.rpcHttps
      },
      flashLoan: {
        poolAddress: process.env.AAVE_POOL_ADDRESS || configData.flashLoan.poolAddress,
        receiverAddress: process.env.FLASH_LOAN_RECEIVER_ADDRESS || configData.flashLoan.receiverAddress || '',
        fee: configData.flashLoan.fee
      },
      relay: {
        enabled: configData.relay.enabled,
        providers: configData.relay.providers.map((p: any) => ({
          ...p,
          apiKey: process.env[`${p.name.toUpperCase()}_API_KEY`] || p.apiKey
        }))
      },
      arbitrage: {
        minProfitUSD: parseFloat(process.env.MIN_PROFIT_USD || configData.arbitrage.minProfitUSD),
        minSpreadPercent: parseFloat(process.env.MIN_SPREAD_PERCENT || configData.arbitrage.minSpreadPercent),
        maxSlippage: parseFloat(process.env.MAX_SLIPPAGE_PERCENT || configData.arbitrage.maxSlippage),
        maxGasPrice: parseFloat(process.env.MAX_GAS_PRICE_GWEI || configData.arbitrage.maxGasPrice),
        tradeSize: parseInt(process.env.TRADE_SIZE_USDC || configData.arbitrage.tradeSize)
      },
      pools: configData.pools.filter((p: PoolConfig) => p.enabled),
      api: {
        port: parseInt(process.env.API_PORT || '3001'),
        wsPort: parseInt(process.env.WS_PORT || '3002')
      },
      wallet: {
        privateKey: process.env.PRIVATE_KEY,
        keystorePath: process.env.WALLET_KEYSTORE_PATH,
        password: process.env.WALLET_PASSWORD
      }
    };

    return this.config;
  }

  /**
   * Reload configuration (hot-reload support)
   */
  reload(): AppConfig {
    this.config = null;
    return this.load();
  }

  /**
   * Get current configuration
   */
  get(): AppConfig {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.get();

    // Validate RPC endpoints
    if (!config.network.rpcWss || !config.network.rpcWss.startsWith('wss://')) {
      errors.push('Invalid WebSocket RPC endpoint');
    }

    if (!config.network.rpcHttps || !config.network.rpcHttps.startsWith('https://')) {
      errors.push('Invalid HTTPS RPC endpoint');
    }

    // Validate wallet
    if (!config.wallet.privateKey && !config.wallet.keystorePath) {
      errors.push('No wallet configuration found (need PRIVATE_KEY or WALLET_KEYSTORE_PATH)');
    }

    // Validate flash loan receiver (warning only)
    if (!config.flashLoan.receiverAddress) {
      console.warn('⚠️  Flash loan receiver address not set. Deploy contract first.');
    }

    // Validate pools
    if (config.pools.length === 0) {
      errors.push('No pools configured');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
export const configLoader = new ConfigLoader();

// Export helper function
export function getConfig(): AppConfig {
  return configLoader.get();
}

export function validateConfig() {
  return configLoader.validate();
}
