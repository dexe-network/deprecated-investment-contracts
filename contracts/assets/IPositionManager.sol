// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface IParamStorage{
    function getAddress(uint16 key) external view returns (address);
    function getUInt256(uint16 key) external view returns (uint256);

}

interface IPositionTool {
    function preparePosition(address paramStorage, address basicToken, address toToken, uint256 amount, uint256 deadline) external returns (uint256);
    function openPosition(address paramStorage, address basicToken, address toToken, uint256 amount, uint256 deadline) external returns (uint256, uint256);
    function splitPosition(address paramStorage, address basicToken, address toToken, uint256 amount, uint256 deadline) external returns (uint256, uint256);
    function rewardPosition(address paramStorage, address basicToken, address toToken, uint256 liquidity, uint256 deadline) external returns (uint256, uint256);
    function exitPosition(address paramStorage, address basicToken, address toToken, uint256 liquidity, uint256 deadline) external returns (uint256,uint256);
}

interface IPositionToolManager{
    function getPositionTool(uint8 _index) external view returns (address);
}