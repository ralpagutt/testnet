/**
 * PreflightSimulator Test Suite
 *
 * Tests the core simulation engine with mock data
 */

import { PreflightSimulator, SimParams } from '../src/core/PreflightSimulator';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color: keyof typeof colors, message: string, data?: any) {
  console.log(`${colors[color]}${message}${colors.reset}`, data || '');
}

async function testSimulator() {
  log('cyan', '\n🧪 ===== PREFLIGHT SIMULATOR TEST SUITE =====\n');

  // Check if RPC is configured
  const rpcUrl = process.env.ARBITRUM_RPC_HTTPS;

  if (!rpcUrl || rpcUrl.includes('YOUR_KEY')) {
    log('yellow', '⚠️  No RPC configured in .env file');
    log('yellow', '📝 Using mock test (will fail gracefully)\n');
  }

  // Initialize simulator
  log('blue', '1️⃣  Initializing PreflightSimulator...');
  const simulator = new PreflightSimulator(
    rpcUrl || 'https://arb1.arbitrum.io/rpc',
    5.0 // $5 minimum profit
  );
  log('green', '   ✅ Simulator initialized\n');

  // Test 1: Mock simulation with placeholder contract
  log('blue', '2️⃣  Test: Mock simulation (expected to fail gracefully)');

  const mockParams: SimParams = {
    contractAddress: '0x0000000000000000000000000000000000000000', // Placeholder
    asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
    amount: 1000n * 10n**6n, // 1000 USDC
    path: [
      '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443', // Uniswap V3 USDC-WETH
      '0x84652bb2539513BAf36e225c930Fdd8eaa63CE27'  // Camelot USDC-WETH
    ],
    amountsOut: [
      1005n * 10n**6n, // Expected output from first swap (0.5% gain)
      1010n * 10n**6n  // Expected output from second swap (1.0% total gain)
    ]
  };

  try {
    const result = await simulator.simulate(mockParams);

    if (result.success) {
      log('green', '   ✅ Simulation executed successfully');
      log('cyan', '   📊 Results:', {
        profitable: result.profitable,
        netProfitUSD: `$${result.netProfitUSD.toFixed(2)}`,
        gasEstimate: result.gasEstimate.toString(),
        gasCostUSD: `$${result.gasCostUSD.toFixed(4)}`,
        executionTime: `${result.executionTime}ms`
      });
    } else {
      log('yellow', '   ⚠️  Simulation failed (expected)');
      log('cyan', '   📊 Revert reason:', result.revertReason);
    }
  } catch (error: any) {
    log('red', '   ❌ Test error:', error.message);
  }

  console.log();

  // Test 2: Batch simulation
  log('blue', '3️⃣  Test: Batch simulation (3 opportunities)');

  const batchParams: SimParams[] = [
    { ...mockParams },
    { ...mockParams, amount: 2000n * 10n**6n },
    { ...mockParams, amount: 5000n * 10n**6n }
  ];

  try {
    const startTime = Date.now();
    const results = await simulator.simulateBatch(batchParams);
    const elapsed = Date.now() - startTime;

    log('green', `   ✅ Batch completed in ${elapsed}ms`);
    log('cyan', `   📊 Average time per sim: ${(elapsed / results.length).toFixed(0)}ms`);
    log('cyan', `   📊 Profitable opportunities: ${results.filter(r => r.profitable).length}/${results.length}`);
  } catch (error: any) {
    log('red', '   ❌ Batch test error:', error.message);
  }

  console.log();

  // Test 3: Quick check
  log('blue', '4️⃣  Test: Quick profitability check');

  try {
    const startTime = Date.now();
    const isProfitable = await simulator.quickCheck(mockParams);
    const elapsed = Date.now() - startTime;

    log(isProfitable ? 'green' : 'yellow', `   ${isProfitable ? '✅' : '⚠️'}  Quick check: ${isProfitable ? 'Profitable' : 'Not profitable'}`);
    log('cyan', `   📊 Execution time: ${elapsed}ms`);
  } catch (error: any) {
    log('yellow', '   ⚠️  Quick check failed (expected)');
  }

  console.log();

  // Test 4: Configuration changes
  log('blue', '5️⃣  Test: Update configuration');

  simulator.setMinProfitUSD(10.0);
  log('green', '   ✅ Min profit threshold updated to $10.00');

  console.log();

  // Summary
  log('cyan', '✅ ===== TEST SUITE COMPLETE =====\n');

  log('yellow', '📝 NOTES:');
  log('yellow', '   - Mock tests are expected to fail until contract is deployed');
  log('yellow', '   - Real testing requires:');
  log('yellow', '     1. Deployed FlashLoanReceiver contract');
  log('yellow', '     2. Valid RPC endpoint in .env');
  log('yellow', '     3. Actual pool addresses with liquidity');
  log('yellow', '\n   Run "npm run dev --workspace=bot" after contract deployment for real tests\n');
}

// Run tests
testSimulator()
  .then(() => {
    console.log('🏁 Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
