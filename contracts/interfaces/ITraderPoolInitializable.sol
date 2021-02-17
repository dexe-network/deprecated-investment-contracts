// SPDX-License-Identifier: MIT

pragma solidity >=0.6.2 <0.8.0;

interface ITraderPoolInitializable{
  function initialize(address[9] calldata iaddr, uint[2] calldata iuint, bool _actual) external;
}