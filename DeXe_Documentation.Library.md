# Library

[UniswapV2Library.sol](https://github.com/Uniswap/uniswap-v2-periphery/blob/master/contracts/libraries/UniswapV2Library.sol)

## Internal Functions

### sortTokens

```solidity
function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1);
```

Sorts token addresses.

### pairFor

```solidity
function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair);
```

Calculates the address for a pair without making any external calls (see Pair Addresses).

### getReserves

```solidity
function getReserves(address factory, address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB);
```

Calls `getReserves` on the pair for the passed tokens, and returns the results sorted in the order that the parameters were passed in.

### quote

```solidity
function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB);
```

Given some asset amount and reserves, returns an amount of the other asset representing equivalent value.

Useful for calculating optimal token amounts before calling mint.

### getAmountOut

```solidity
function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut);
```

Given an input asset amount, returns the maximum output amount of the other asset (accounting for fees) given reserves.

Used in getAmountsOut.


### getAmountIn

```solidity
function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn);
```

Returns the minimum input asset amount required to buy the given output asset amount (accounting for fees) given reserves.

Used in getAmountsIn.

### getAmountsOut

```solidity
function getAmountsOut(uint amountIn, address[] memory path) internal view returns (uint[] memory amounts);
```

Given an input asset amount and an array of token addresses, calculates all subsequent maximum output token amounts by calling getReserves for each pair of token addresses in the path in turn, and using these to call getAmountOut.

Useful for calculating optimal token amounts before calling swap.


### getAmountsIn

```solidity
function getAmountsIn(uint amountOut, address[] memory path) internal view returns (uint[] memory amounts);
```

Given an output asset amount and an array of token addresses, calculates all preceding minimum input token amounts by calling getReserves for each pair of token addresses in the path in turn, and using these to call getAmountIn.

Useful for calculating optimal token amounts before calling swap.