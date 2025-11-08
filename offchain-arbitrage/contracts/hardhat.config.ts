import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true // Enable IR-based code generation for better optimization
    }
  },

  networks: {
    // Arbitrum Mainnet
    arbitrum: {
      url: process.env.ARBITRUM_RPC_HTTPS || 'https://arb1.arbitrum.io/rpc',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161,
      gasPrice: 100000000 // 0.1 Gwei
    },

    // Arbitrum Sepolia Testnet
    arbitrumSepolia: {
      url: 'https://sepolia-rollup.arbitrum.io/rpc',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 421614
    },

    // Local Hardhat Network (for testing)
    hardhat: {
      chainId: 31337,
      forking: process.env.ARBITRUM_RPC_HTTPS
        ? {
            url: process.env.ARBITRUM_RPC_HTTPS,
            enabled: true
          }
        : undefined
    }
  },

  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || '',
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || ''
    },
    customChains: [
      {
        network: 'arbitrumSepolia',
        chainId: 421614,
        urls: {
          apiURL: 'https://api-sepolia.arbiscan.io/api',
          browserURL: 'https://sepolia.arbiscan.io'
        }
      }
    ]
  },

  paths: {
    sources: './src',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },

  mocha: {
    timeout: 60000 // 60 seconds for tests
  }
};

export default config;
