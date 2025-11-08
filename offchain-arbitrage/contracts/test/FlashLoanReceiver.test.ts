/**
 * FlashLoanReceiver Tests
 *
 * Run with: npx hardhat test
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FlashLoanReceiver } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('FlashLoanReceiver', function () {
  let flashLoanReceiver: FlashLoanReceiver;
  let owner: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const AAVE_ADDRESSES_PROVIDER = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';
  const AAVE_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
  const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

  before(async function () {
    [owner, otherAccount] = await ethers.getSigners();

    console.log('    Deploying FlashLoanReceiver...');
    const FlashLoanReceiverFactory = await ethers.getContractFactory('FlashLoanReceiver');
    flashLoanReceiver = await FlashLoanReceiverFactory.deploy(AAVE_ADDRESSES_PROVIDER);
    await flashLoanReceiver.waitForDeployment();

    console.log('    Contract deployed at:', await flashLoanReceiver.getAddress());
  });

  describe('Deployment', function () {
    it('Should set the correct owner', async function () {
      expect(await flashLoanReceiver.owner()).to.equal(owner.address);
    });

    it('Should set the correct Aave pool', async function () {
      expect(await flashLoanReceiver.POOL()).to.equal(AAVE_POOL);
    });

    it('Should set the correct AddressesProvider', async function () {
      expect(await flashLoanReceiver.ADDRESSES_PROVIDER()).to.equal(AAVE_ADDRESSES_PROVIDER);
    });
  });

  describe('Access Control', function () {
    it('Only owner should be able to withdraw profits', async function () {
      await expect(
        flashLoanReceiver.connect(otherAccount).withdrawProfit(USDC)
      ).to.be.revertedWith('Not owner');
    });

    it('Only owner should be able to emergency withdraw', async function () {
      await expect(
        flashLoanReceiver.connect(otherAccount).emergencyWithdraw(USDC)
      ).to.be.revertedWith('Not owner');
    });
  });

  describe('View Functions', function () {
    it('Should get balance for a token', async function () {
      const balance = await flashLoanReceiver.getBalance(USDC);
      expect(balance).to.equal(0); // No balance initially
    });
  });

  // Note: Full integration testing requires forking mainnet and simulating flash loans
  // This would require significant USDC balance and is better done in a separate integration test suite
});
