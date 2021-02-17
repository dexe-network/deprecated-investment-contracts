pragma solidity 0.6.6;


import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../interfaces/IPoolLiquidityToken.sol";

contract PoolLiquidityTokenUpgradeable is ERC20Upgradeable, OwnableUpgradeable, IPoolLiquidityToken {

    uint256 public maxPoolTotalSupply;

    function initialize(address _owner, uint256 _maxPoolTotalSupply) public override initializer {
        __ERC20_init("_tlt", "DeXe Trader Pool Liquidity Token");
        __Ownable_init_unchained();
        __PoolLiquidityTokenUpgradeable_init_unchained(_owner, _maxPoolTotalSupply);
    }

    function __PoolLiquidityTokenUpgradeable_init_unchained(address _owner, uint256 _maxPoolTotalSupply) internal initializer {
        transferOwnership(_owner);
        maxPoolTotalSupply = _maxPoolTotalSupply;
    }

    function mint(address to, uint256 amount) public override onlyOwner{
        _mint(to, amount);
        require (maxPoolTotalSupply == 0 || totalSupply() <= maxPoolTotalSupply, "Pool reached its max allowed liquidity");   
    }

    function burn(address from, uint256 amountLiquidity) public override onlyOwner{
        _burn(from, amountLiquidity);
    } 
}