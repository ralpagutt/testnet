// Contract addresses and ABIs

export const ARBITRUM_CHAIN_ID = 42161;

// Token Addresses on Arbitrum
export const TOKENS = {
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548'
};

// Aave V3 Addresses
export const AAVE = {
  POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  ADDRESSES_PROVIDER: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb'
};

// DEX Router Addresses
export const ROUTERS = {
  UNISWAP_V3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  CAMELOT: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d'
};

// Pool Addresses
export const POOLS = {
  UNISWAP_V3_USDC_WETH_005: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
  CAMELOT_USDC_WETH: '0x84652bb2539513BAf36e225c930Fdd8eaa63CE27'
};

// Minimal ABIs (only needed functions)
export const ABIS = {
  // Aave V3 Pool
  AAVE_POOL: [
    'function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external'
  ],

  // Uniswap V3 Pool
  UNISWAP_V3_POOL: [
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'function fee() external view returns (uint24)',
    'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
  ],

  // ERC20
  ERC20: [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
  ],

  // Flash Loan Receiver
  FLASH_LOAN_RECEIVER: [
    'function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool)',
    'function withdrawProfit(address token) external',
    'function owner() external view returns (address)'
  ]
};

// Event Topics
export const EVENT_TOPICS = {
  SWAP: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67' // keccak256("Swap(address,address,int256,int256,uint160,uint128,int24)")
};

// Gas Configuration
export const GAS_CONFIG = {
  MAX_GAS_PRICE_GWEI: 0.1,
  GAS_LIMIT_FLASH_LOAN: 500000,
  PRIORITY_FEE_GWEI: 0.01
};

// Flash Loan Configuration
export const FLASH_LOAN_CONFIG = {
  AAVE_FEE_BPS: 5, // 0.05% = 5 basis points
  MIN_LOAN_AMOUNT_USDC: 100,
  MAX_LOAN_AMOUNT_USDC: 100000
};

// Timing Configuration
export const TIMING = {
  WS_RECONNECT_DELAY_MS: 5000,
  PRICE_UPDATE_THROTTLE_MS: 100,
  OPPORTUNITY_CHECK_DEBOUNCE_MS: 50,
  MAX_EXECUTION_TIME_MS: 10000
};
