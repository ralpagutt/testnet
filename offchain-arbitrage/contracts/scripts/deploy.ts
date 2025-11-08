/**
 * Deploy FlashLoanReceiver Contract
 *
 * Usage:
 * - Testnet: npx hardhat run scripts/deploy.ts --network arbitrumSepolia
 * - Mainnet: npx hardhat run scripts/deploy.ts --network arbitrum
 */

import { ethers } from 'hardhat';

async function main() {
  console.log('\n🚀 ===== DEPLOYING FLASHLOANRECEIVER =====\n');

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log('📋 Deployment Info:');
  console.log('   Deployer:', deployer.address);
  console.log('   Balance:', ethers.formatEther(balance), 'ETH');
  console.log('   Network:', (await ethers.provider.getNetwork()).name);
  console.log('   ChainID:', (await ethers.provider.getNetwork()).chainId);
  console.log();

  // Aave V3 AddressesProvider on Arbitrum
  const AAVE_ADDRESSES_PROVIDER = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';

  console.log('⚙️  Contract Parameters:');
  console.log('   Aave AddressesProvider:', AAVE_ADDRESSES_PROVIDER);
  console.log();

  // Deploy contract
  console.log('📦 Deploying contract...');

  const FlashLoanReceiver = await ethers.getContractFactory('FlashLoanReceiver');
  const contract = await FlashLoanReceiver.deploy(AAVE_ADDRESSES_PROVIDER);

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log('✅ Contract deployed successfully!');
  console.log();

  // Deployment details
  console.log('📝 Deployment Details:');
  console.log('   Contract Address:', address);
  console.log('   Owner:', await contract.owner());
  console.log('   Aave Pool:', await contract.POOL());
  console.log();

  // Save to .env instructions
  console.log('📋 Next Steps:');
  console.log('   1. Update .env file:');
  console.log(`      FLASH_LOAN_RECEIVER_ADDRESS=${address}`);
  console.log();

  // Verification command
  console.log('   2. Verify contract on Arbiscan:');
  console.log(`      npx hardhat verify --network arbitrum ${address} ${AAVE_ADDRESSES_PROVIDER}`);
  console.log();

  // Test transaction
  console.log('   3. Test contract (optional):');
  console.log(`      - Check balance: await contract.getBalance("0xaf88d065e77c8cC2239327C5EDb3A432268e5831")`);
  console.log(`      - View on Arbiscan: https://arbiscan.io/address/${address}`);
  console.log();

  console.log('🎉 ===== DEPLOYMENT COMPLETE =====\n');
}

// Execute deployment
main()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exitCode = 1;
  });
