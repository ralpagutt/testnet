import { ethers } from 'ethers';
import { simLogger } from '../utils/logger';

export interface SimResult {
  success: boolean;
  profitable: boolean;
  estimatedProfit: bigint;
  netProfitUSD: number;
  gasEstimate: bigint;
  gasCostUSD: number;
  revertReason?: string;
  executionTime?: number;
}

export interface SimParams {
  contractAddress: string;
  asset: string;           // USDC address
  amount: bigint;          // Flash loan amount
  path: string[];          // [pool1, pool2]
  amountsOut: bigint[];    // Expected outputs from each swap
}

/**
 * PreflightSimulator - Local simulation engine
 *
 * This is the MOST CRITICAL component. It performs local simulations
 * using eth_call to determine profitability WITHOUT spending gas.
 *
 * Key Features:
 * - Zero gas cost (uses eth_call)
 * - Fast execution (<100ms)
 * - Accurate profit estimation
 * - Batch simulation support
 */
export class PreflightSimulator {
  private provider: ethers.JsonRpcProvider;
  private minProfitUSD: number;
  private usdcDecimals = 6; // USDC has 6 decimals

  constructor(rpcUrl: string, minProfitUSD: number = 5.0) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.minProfitUSD = minProfitUSD;

    simLogger.info('✅ PreflightSimulator initialized', {
      minProfitUSD,
      rpcUrl: rpcUrl.replace(/\/[^\/]+$/, '/***') // Hide API key
    });
  }

  /**
   * Main simulation method - performs local eth_call
   * Returns detailed profitability analysis
   */
  async simulate(params: SimParams): Promise<SimResult> {
    const startTime = Date.now();

    try {
      simLogger.debug('🔍 Starting simulation', {
        amount: params.amount.toString(),
        pools: params.path.length
      });

      // Validate inputs
      if (!params.contractAddress || params.contractAddress === ethers.ZeroAddress) {
        return this.failResult('Contract address not set');
      }

      if (params.amountsOut.length !== params.path.length) {
        return this.failResult('Path and amountsOut length mismatch');
      }

      // Build flash loan callback interface
      const iface = new ethers.Interface([
        'function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool)'
      ]);

      // Calculate Aave flash loan premium (0.05%)
      const premium = (params.amount * 5n) / 10000n;

      // Encode route parameters
      const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address[]', 'uint256[]'],
        [params.path, params.amountsOut]
      );

      // Build calldata for executeOperation
      const calldata = iface.encodeFunctionData('executeOperation', [
        params.asset,
        params.amount,
        premium,
        ethers.ZeroAddress, // initiator (will be our wallet in real tx)
        encodedParams
      ]);

      // CRITICAL: Static call - NO GAS SPENT, NO STATE CHANGE
      simLogger.debug('📞 Executing eth_call');

      let result: string;
      try {
        result = await this.provider.call({
          to: params.contractAddress,
          data: calldata
        });
      } catch (error: any) {
        // Extract revert reason if available
        const reason = this.extractRevertReason(error);
        simLogger.debug('❌ Call reverted', { reason });
        return this.failResult(reason);
      }

      // Decode result
      const decoded = iface.decodeFunctionResult('executeOperation', result);
      const success = decoded[0] as boolean;

      if (!success) {
        return this.failResult('Contract returned false');
      }

      simLogger.debug('✅ Call succeeded');

      // Estimate gas for actual execution
      let gasEstimate: bigint;
      try {
        gasEstimate = await this.provider.estimateGas({
          to: params.contractAddress,
          data: calldata,
          value: 0
        });
      } catch (error) {
        // If gas estimation fails, use conservative estimate
        gasEstimate = 500000n;
        simLogger.warn('⚠️  Gas estimation failed, using conservative estimate');
      }

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 100000000n; // 0.1 Gwei fallback for Arbitrum

      // Calculate costs and profit
      const gasCost = gasEstimate * gasPrice;

      // Calculate gross profit (final output - borrowed amount - premium)
      const finalAmount = params.amountsOut[params.amountsOut.length - 1];
      const totalDebt = params.amount + premium;
      const grossProfit = finalAmount > totalDebt ? finalAmount - totalDebt : 0n;

      // Net profit = gross profit - gas cost
      const netProfit = grossProfit > gasCost ? grossProfit - gasCost : 0n;

      // Convert to USD (USDC has 6 decimals)
      const netProfitUSD = Number(netProfit) / Math.pow(10, this.usdcDecimals);
      const gasCostUSD = Number(gasCost) / Math.pow(10, this.usdcDecimals);

      // Check profitability threshold
      const profitable = netProfitUSD >= this.minProfitUSD;

      const executionTime = Date.now() - startTime;

      simLogger.info(profitable ? '✅ Profitable simulation' : '⚠️  Unprofitable simulation', {
        netProfitUSD: netProfitUSD.toFixed(2),
        gasCostUSD: gasCostUSD.toFixed(2),
        gasEstimate: gasEstimate.toString(),
        executionTime: `${executionTime}ms`
      });

      return {
        success: true,
        profitable,
        estimatedProfit: netProfit,
        netProfitUSD,
        gasEstimate,
        gasCostUSD,
        executionTime
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      simLogger.error('❌ Simulation error', {
        error: error.message,
        executionTime: `${executionTime}ms`
      });

      return this.failResult(error.message || 'Unknown error', executionTime);
    }
  }

  /**
   * Batch simulation - test multiple opportunities in parallel
   * This is faster than sequential simulations
   */
  async simulateBatch(paramsList: SimParams[]): Promise<SimResult[]> {
    const startTime = Date.now();

    simLogger.info('🔄 Starting batch simulation', {
      count: paramsList.length
    });

    // Run all simulations in parallel
    const promises = paramsList.map(params => this.simulate(params));
    const results = await Promise.all(promises);

    const executionTime = Date.now() - startTime;
    const profitable = results.filter(r => r.profitable).length;

    simLogger.info('✅ Batch simulation complete', {
      total: results.length,
      profitable,
      executionTime: `${executionTime}ms`,
      avgTime: `${(executionTime / results.length).toFixed(0)}ms per sim`
    });

    return results;
  }

  /**
   * Quick profitability check - faster version for rapid screening
   * Skips gas estimation for speed
   */
  async quickCheck(params: SimParams): Promise<boolean> {
    try {
      const iface = new ethers.Interface([
        'function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool)'
      ]);

      const premium = (params.amount * 5n) / 10000n;
      const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address[]', 'uint256[]'],
        [params.path, params.amountsOut]
      );

      const calldata = iface.encodeFunctionData('executeOperation', [
        params.asset,
        params.amount,
        premium,
        ethers.ZeroAddress,
        encodedParams
      ]);

      // Just check if call succeeds
      const result = await this.provider.call({
        to: params.contractAddress,
        data: calldata
      });

      const decoded = iface.decodeFunctionResult('executeOperation', result);
      return decoded[0] as boolean;

    } catch {
      return false;
    }
  }

  /**
   * Extract revert reason from error
   */
  private extractRevertReason(error: any): string {
    // Try to extract custom error or revert reason
    if (error.reason) {
      return error.reason;
    }

    if (error.data) {
      try {
        // Try to decode error data
        const errorData = error.data;
        if (typeof errorData === 'string' && errorData.startsWith('0x08c379a0')) {
          // Standard Error(string) selector
          const reason = ethers.AbiCoder.defaultAbiCoder().decode(
            ['string'],
            '0x' + errorData.slice(10)
          );
          return reason[0];
        }
      } catch {
        // Ignore decode errors
      }
    }

    if (error.message) {
      return error.message;
    }

    return 'Unknown revert reason';
  }

  /**
   * Helper to create failed result
   */
  private failResult(reason: string, executionTime?: number): SimResult {
    return {
      success: false,
      profitable: false,
      estimatedProfit: 0n,
      netProfitUSD: 0,
      gasEstimate: 0n,
      gasCostUSD: 0,
      revertReason: reason,
      executionTime
    };
  }

  /**
   * Update minimum profit threshold
   */
  setMinProfitUSD(minProfit: number): void {
    this.minProfitUSD = minProfit;
    simLogger.info('⚙️  Min profit threshold updated', { minProfitUSD: minProfit });
  }

  /**
   * Get current provider
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
}
