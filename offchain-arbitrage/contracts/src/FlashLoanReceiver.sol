// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IFlashLoanReceiver} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanReceiver.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FlashLoanReceiver
 * @notice Minimal Aave V3 flash loan callback contract for arbitrage
 * @dev Arbitrage logic is OFF-CHAIN - this only executes the encoded route
 *
 * CRITICAL DESIGN:
 * - Bot calculates optimal route off-chain
 * - Contract executes pre-calculated swaps
 * - No on-chain decision making (gas efficient)
 * - No admin functions (immutable after deployment)
 */
contract FlashLoanReceiver is IFlashLoanReceiver {
    using SafeERC20 for IERC20;

    address public immutable owner;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    address public immutable POOL;

    // Uniswap V3 Router
    address private constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

    // Camelot Router
    address private constant CAMELOT_ROUTER = 0xc873fEcbd354f5A56E00E710B90EF4201db2448d;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyPool() {
        require(msg.sender == address(POOL), "Not Aave pool");
        _;
    }

    constructor(address _addressProvider) {
        owner = msg.sender;
        ADDRESSES_PROVIDER = IPoolAddressesProvider(_addressProvider);
        POOL = IPoolAddressesProvider(_addressProvider).getPool();
    }

    /**
     * @notice Aave V3 flash loan callback
     * @param asset Borrowed asset (USDC)
     * @param amount Borrowed amount
     * @param premium Flash loan fee (0.05%)
     * @param initiator Transaction initiator (must be owner)
     * @param params Encoded route from off-chain bot
     * @return bool Success status
     *
     * @dev This function is called by Aave Pool during flash loan execution
     *
     * Params encoding:
     * - address[] path: Token addresses for swaps
     * - uint256[] amountsOut: Expected minimum outputs
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override onlyPool returns (bool) {
        // Security: Only owner can initiate flash loans
        require(initiator == owner, "Unauthorized initiator");

        // Decode route parameters
        (
            address[] memory path,
            uint256[] memory amountsOut
        ) = abi.decode(params, (address[], uint256[]));

        // Validate inputs
        require(path.length >= 2, "Invalid path length");
        require(path.length == amountsOut.length + 1, "Path/amounts mismatch");

        // Execute arbitrage swaps
        uint256 currentAmount = amount;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];
            uint256 minAmountOut = amountsOut[i];

            // Determine which DEX to use (simplified - bot should encode this)
            // In production, bot should pass router addresses
            address router = i == 0 ? UNISWAP_V3_ROUTER : CAMELOT_ROUTER;

            // Execute swap
            currentAmount = _executeSwap(
                router,
                tokenIn,
                tokenOut,
                currentAmount,
                minAmountOut
            );
        }

        // Calculate total debt
        uint256 totalDebt = amount + premium;

        // Ensure we made profit
        require(currentAmount >= totalDebt, "Insufficient profit");

        // Approve Aave pool to pull back the debt
        IERC20(asset).safeApprove(address(POOL), totalDebt);

        // Profit remains in contract (withdraw later)
        emit ArbitrageExecuted(
            asset,
            amount,
            currentAmount,
            currentAmount - totalDebt
        );

        return true;
    }

    /**
     * @notice Execute swap on specified DEX
     * @dev This is a simplified version - real implementation needs DEX-specific logic
     */
    function _executeSwap(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) private returns (uint256) {
        // Approve router
        IERC20(tokenIn).safeApprove(router, amountIn);

        // For Uniswap V3
        if (router == UNISWAP_V3_ROUTER) {
            return _swapUniswapV3(tokenIn, tokenOut, amountIn, minAmountOut);
        }

        // For Camelot (uses Uniswap V2 style)
        if (router == CAMELOT_ROUTER) {
            return _swapCamelot(tokenIn, tokenOut, amountIn, minAmountOut);
        }

        revert("Unknown router");
    }

    /**
     * @notice Swap on Uniswap V3
     */
    function _swapUniswapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) private returns (uint256 amountOut) {
        // Uniswap V3 SwapRouter interface
        ISwapRouter swapRouter = ISwapRouter(UNISWAP_V3_ROUTER);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: 500, // 0.05%
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });

        amountOut = swapRouter.exactInputSingle(params);
    }

    /**
     * @notice Swap on Camelot
     */
    function _swapCamelot(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) private returns (uint256 amountOut) {
        // Camelot uses Uniswap V2 style router
        ICamelotRouter camelotRouter = ICamelotRouter(CAMELOT_ROUTER);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = camelotRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            address(0), // referrer
            block.timestamp
        );

        amountOut = amounts[amounts.length - 1];
    }

    /**
     * @notice Withdraw profits to owner
     * @param token Token to withdraw
     */
    function withdrawProfit(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No profit");

        IERC20(token).safeTransfer(owner, balance);

        emit ProfitWithdrawn(token, balance);
    }

    /**
     * @notice Emergency withdraw any token
     * @param token Token to withdraw
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner, balance);
        }
    }

    /**
     * @notice Get contract balance for a token
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Events
    event ArbitrageExecuted(
        address indexed asset,
        uint256 borrowAmount,
        uint256 finalAmount,
        uint256 profit
    );

    event ProfitWithdrawn(address indexed token, uint256 amount);
}

/**
 * @notice Uniswap V3 SwapRouter interface (minimal)
 */
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/**
 * @notice Camelot Router interface (Uniswap V2 style)
 */
interface ICamelotRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        address referrer,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
