// SPDX-License-Identifier: MIT

pragma solidity >=0.6.2 <0.8.0;

interface IParamStorage{
    function getAddress(uint16 key) external view returns (address);
    function getUInt256(uint16 key) external view returns (uint256);
}