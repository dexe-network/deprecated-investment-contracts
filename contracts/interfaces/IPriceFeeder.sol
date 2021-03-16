// SPDX-License-Identifier: MIT

pragma solidity >=0.6.2 <0.8.0;

interface IPriceFeeder{
    
    function evaluate(address basicToken, address assetToken, uint256 assetTokenAmt) external view returns (uint256);
    function getAssetUSDValuation(address assetToken, uint256 assetTokenAmt) external view returns (uint256);
}