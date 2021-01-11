pragma solidity 0.6.6;

import "../token/ERC20/ERC20.sol";

contract PoolLiquidityTokenFixed is ERC20 {

    bool private inited;

    constructor() ERC20("_trader liquidity token", "_tlt") public {
    }

    function init(uint256 _totalSupply, address to) public {
        require(!inited,"Already inited");
        _mint(to, _totalSupply);
        inited = true;
    }

}