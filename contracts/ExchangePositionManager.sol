
pragma solidity 0.6.6;

// import "./math/SafeMath.sol";
import "./token/ERC20/IERC20.sol";
import "./token/ERC20/SafeERC20.sol";
import "./assets/IPositionManager.sol";
import "./uniswap/RouterInterface.sol";
import "./uniswap/UniswapV2Library.sol";

/**
    UNISWAP based example. To be changed to 1inch later... 
 */
contract ExchangePositionManager is IPositionTool {
    
    //using SafeMath for uint256;
    using SafeERC20 for IERC20;

    constructor() public {
    }

    function preparePosition(address paramStorage, address basicToken, address toToken, uint256 amount, uint256 deadline) override external returns (uint256){
        return 0;
    }

    function openPosition(address paramStorage, address basicToken, address toToken, uint256 amount, uint256 deadline) override external returns (uint256, uint256){
        
        address router = IParamStorage(paramStorage).getAddress(1000);
        require (router != address(0), "Router parameter to be defined");
        uint[] memory out = _swapTokens(router, basicToken, amount, toToken, deadline);
        return (out[0],out[1]);
    }

    function splitPosition(address paramStorage, address basicToken, address toToken, uint256 amount, uint256 deadline) override external returns (uint256, uint256) {
        return (0,0);
    }

    function rewardPosition(address paramStorage, address basicToken, address toToken, uint256 liquidity, uint256 deadline) override external returns (uint256,uint256){
        return (0,0);
    }

    function exitPosition(address paramStorage, address basicToken, address toToken, uint256 liquidity, uint256 deadline) override external returns (uint256, uint256){
        address router = IParamStorage(paramStorage).getAddress(1000);
        require (router != address(0), "Router parameter to be defined");
        uint[] memory out = _swapTokens(router, toToken, liquidity, basicToken, deadline);
        return (out[1],out[0]);
    }

    function positionCap(address paramStorage, address basicToken, address toToken, uint256 liquidity) external override view returns (uint256){
        address router = IParamStorage(paramStorage).getAddress(1000);
        require (router != address(0), "Router parameter to be defined");
        (uint reserveB, uint reserveA) = UniswapV2Library.getReserves(IUniswapV2Router01(router).factory(), basicToken, toToken);
        return UniswapV2Library.getAmountOut(liquidity, reserveA, reserveB);
    }

    function _swapTokens(
        address router,
        address fromToken,
        uint256 fromAmount,
        address toToken,
        uint256 deadline
    ) private returns (uint[] memory) {
        address[] memory token_address = new address[](2);
        token_address[0] = fromToken;
        token_address[1] = toToken;
        IERC20(fromToken).safeIncreaseAllowance(router, fromAmount);
        uint[] memory out = IUniswapV2Router01(router).swapExactTokensForTokens(
            fromAmount,
            uint256(0),
            token_address,
            address(this),
            deadline
        );
        return out;
    }

     // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function _pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        pair = address(uint(keccak256(abi.encodePacked(
                hex'ff',
                factory,
                keccak256(abi.encodePacked(token0, token1)),
                hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' // init code hash
            ))));
    }
}
