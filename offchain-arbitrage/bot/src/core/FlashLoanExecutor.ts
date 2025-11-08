/**
 * FlashLoanExecutor - Flash Loan Transaction Builder
 *
 * Builds and signs flash loan transactions for Aave V3
 */

import { ethers } from 'ethers';
import { executionLogger } from '../utils/logger';
import { ABIS, AAVE } from '../config/constants';

export interface FlashLoanParams {
  asset: string;           // Token to borrow (USDC)
  amount: bigint;          // Amount to borrow
  path: string[];          // Swap path [token0, token1, token2...]
  amountsOut: bigint[];    // Expected outputs from each swap
}

export class FlashLoanExecutor {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private flashLoanReceiverAddress: string;
  private aavePoolAddress: string;

  constructor(
    rpcUrl: string,
    privateKey: string,
    flashLoanReceiverAddress: string,
    aavePoolAddress: string = AAVE.POOL
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.flashLoanReceiverAddress = flashLoanReceiverAddress;
    this.aavePoolAddress = aavePoolAddress;

    executionLogger.info('✅ FlashLoanExecutor initialized', {
      walletAddress: this.wallet.address,
      receiverAddress: flashLoanReceiverAddress,
      aavePool: aavePoolAddress
    });
  }

  /**
   * Build flash loan transaction
   */
  async buildFlashLoanTx(params: FlashLoanParams): Promise<ethers.TransactionRequest> {
    executionLogger.debug('🔧 Building flash loan transaction', {
      asset: params.asset,
      amount: params.amount.toString(),
      pathLength: params.path.length
    });

    // Validate inputs
    if (params.path.length < 2) {
      throw new Error('Path must have at least 2 addresses');
    }

    if (params.amountsOut.length !== params.path.length - 1) {
      throw new Error('amountsOut length must be path.length - 1');
    }

    // Create Aave Pool contract interface
    const aavePool = new ethers.Contract(
      this.aavePoolAddress,
      ABIS.AAVE_POOL,
      this.wallet
    );

    // Encode params for flash loan callback
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address[]', 'uint256[]'],
      [params.path, params.amountsOut]
    );

    // Build transaction
    const tx = await aavePool.flashLoanSimple.populateTransaction(
      this.flashLoanReceiverAddress,  // receiverAddress
      params.asset,                    // asset
      params.amount,                   // amount
      encodedParams,                   // params
      0                                // referralCode
    );

    executionLogger.debug('✅ Transaction built', {
      to: tx.to,
      data: tx.data?.substring(0, 66) + '...'
    });

    return tx;
  }

  /**
   * Sign and serialize transaction
   */
  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    executionLogger.debug('✍️  Signing transaction');

    try {
      // Get current gas price
      const feeData = await this.provider.getFeeData();

      // Set gas parameters
      tx.gasLimit = tx.gasLimit || 500000n; // Conservative gas limit
      tx.gasPrice = feeData.gasPrice;
      tx.chainId = (await this.provider.getNetwork()).chainId;
      tx.nonce = await this.provider.getTransactionCount(this.wallet.address);

      // Sign transaction
      const signedTx = await this.wallet.signTransaction(tx);

      executionLogger.debug('✅ Transaction signed', {
        hash: ethers.keccak256(signedTx).substring(0, 10) + '...',
        gasPrice: feeData.gasPrice?.toString(),
        gasLimit: tx.gasLimit.toString()
      });

      return signedTx;

    } catch (error: any) {
      executionLogger.error('❌ Failed to sign transaction', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Build AND sign flash loan transaction (convenience method)
   */
  async buildAndSign(params: FlashLoanParams): Promise<string> {
    const tx = await this.buildFlashLoanTx(params);
    return await this.signTransaction(tx);
  }

  /**
   * Send transaction directly (without relay)
   */
  async sendTransaction(signedTx: string): Promise<ethers.TransactionResponse> {
    executionLogger.info('📤 Sending transaction directly');

    try {
      const txResponse = await this.provider.broadcastTransaction(signedTx);

      executionLogger.info('✅ Transaction sent', {
        hash: txResponse.hash
      });

      return txResponse;

    } catch (error: any) {
      executionLogger.error('❌ Failed to send transaction', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    txHash: string,
    confirmations: number = 1
  ): Promise<ethers.TransactionReceipt | null> {
    executionLogger.info('⏳ Waiting for confirmation', {
      hash: txHash,
      confirmations
    });

    try {
      const receipt = await this.provider.waitForTransaction(
        txHash,
        confirmations,
        60000 // 60 second timeout
      );

      if (receipt) {
        executionLogger.info('✅ Transaction confirmed', {
          hash: txHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status === 1 ? 'success' : 'failed'
        });
      }

      return receipt;

    } catch (error: any) {
      executionLogger.error('❌ Confirmation timeout or error', {
        hash: txHash,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Calculate flash loan fee
   */
  calculateFlashLoanFee(amount: bigint): bigint {
    // Aave V3 flash loan fee: 0.05% = 5 basis points
    return (amount * 5n) / 10000n;
  }

  /**
   * Calculate minimum profit needed to cover costs
   */
  calculateMinProfit(borrowAmount: bigint, gasPrice: bigint, gasLimit: bigint): bigint {
    const flashLoanFee = this.calculateFlashLoanFee(borrowAmount);
    const gasCost = gasPrice * gasLimit;

    return flashLoanFee + gasCost;
  }

  /**
   * Estimate gas for flash loan transaction
   */
  async estimateGas(params: FlashLoanParams): Promise<bigint> {
    try {
      const tx = await this.buildFlashLoanTx(params);
      const gasEstimate = await this.provider.estimateGas({
        ...tx,
        from: this.wallet.address
      });

      executionLogger.debug('📊 Gas estimate', {
        estimate: gasEstimate.toString()
      });

      return gasEstimate;

    } catch (error: any) {
      executionLogger.warn('⚠️  Gas estimation failed, using default', {
        error: error.message
      });
      return 500000n; // Conservative fallback
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<bigint> {
    return await this.provider.getBalance(this.wallet.address);
  }

  /**
   * Get current nonce
   */
  async getNonce(): Promise<number> {
    return await this.provider.getTransactionCount(this.wallet.address);
  }
}
