// SPDX-License-Identifier: MIT
pragma solidity 0.6.6;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "./uniswap/RouterInterface.sol";
import "./uniswap/UniswapV2Library.sol";
import "./interfaces/IPriceFeeder.sol";

contract PriceFeederUpgradeable is IPriceFeeder, Initializable{


  function initialize() public initializer {
  }

  function evaluate(address basicToken, address assetToken, uint256 assetTokenAmt) public override view returns (uint256) {
    //welldone dummies. 
    if(basicToken == assetToken)
      return assetTokenAmt;

    uint256 evaluation;
    evaluation = uniswapPositionCap(basicToken, assetToken, assetTokenAmt);
    if(evaluation > 0) return evaluation;
    //default 
    return 0;
  }

  function getAssetUSDValuation(address assetToken, uint256 assetTokenAmt) public override view returns (uint256) {
    address usdcAddress = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    return evaluate(usdcAddress, assetToken, assetTokenAmt);
  }

   function uniswapPositionCap(address basicToken, address toToken, uint256 liquidity) internal view returns (uint256){
        (uint reserveB, uint reserveA) = UniswapV2Library.getReserves(IUniswapV2Router01(uniswapRouter()).factory(), basicToken, toToken);
        return UniswapV2Library.getAmountOut(liquidity, reserveA, reserveB);
    }

  function uniswapRouter() internal view returns (address){
      return 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
  }



}
