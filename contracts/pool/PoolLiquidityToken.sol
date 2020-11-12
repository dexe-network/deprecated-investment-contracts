pragma solidity 0.6.6;

import "../token/ERC20/ERC20.sol";
import "../token/ERC20/ERC20Burnable.sol";
import "../token/ERC20/ERC20Mintable.sol";

contract PoolLiquidityToken is ERC20, ERC20Burnable, ERC20Mintable {
    constructor() ERC20("_pool liquidity token", "_plt") public {}
}