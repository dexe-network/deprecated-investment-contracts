pragma solidity 0.6.6;

import "./access/Ownable.sol";
import "./access/AccessControl.sol";
import "./math/SafeMath.sol";
import "./utils/Pausable.sol";
import "./token/ERC20/IERC20.sol";
import "./token/ERC20/ERC20Mintable.sol";
import "./token/ERC20/ERC20Burnable.sol";
import "./token/ERC20/SafeERC20.sol";
import "./pool/Pool.sol";
import "./assets/AssetManager.sol";



contract TraderPool is Ownable, AccessControl, Pausable, Pool, AssetManager{

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //ACL
    //Manager is the person allowed to manage funds
    bytes32 public constant TRADER_ROLE = keccak256("TRADER_ROLE");

    address public traderCommissionAddress;
    uint256 public traderCommissionBalance;

    address public dexeCommissionAddress;
    uint256 public dexeCommissionBalance;

    uint8 public traderCommissionPercentNom;
    uint8 public traderCommissionPercentDenom;

    // mapping (address => Pair) public inLiquidityPool;

    constructor(address _basicToken) 
        Pool (_basicToken) 
    public {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(TRADER_ROLE, _msgSender());

        //safe mode "on" with commissions
        traderCommissionAddress = msg.sender;
        traderCommissionPercentNom = 2;
        traderCommissionPercentDenom = 10;
    }
    /**
    * @dev Throws if called by any account other than the one with the Manager role granted.
    */
    modifier onlyTrader() {
        require(hasRole(TRADER_ROLE, msg.sender), "Caller is not the Manager");
        _;
    }

    // Asset Management
    function setParamAddress(uint16 _key, address _value) public onlyOwner {
        _setAddress(_key, _value);
    }

    function setParamUInt256(uint16 _key, uint256 _value) public onlyOwner {
        _setUInt256(_key, _value);
    }

    function setPositionManager(uint8 _index, address _manager) public onlyOwner {
        _setPositionManager(_index, _manager);
    }

    function preparePosition(uint8 _manager, address _toToken, uint256 _amount, uint256 _deadline) public onlyTrader returns (uint256) {
        return _praparePosition(_manager, address(basicToken), _toToken, _amount, _deadline);
    }

    function openPosition(uint8 _manager, uint16 _index, address _toToken, uint256 _amount, uint256 _deadline) public onlyTrader returns (uint256) {
        return _openPosition(_manager, _index, address(basicToken), _toToken, _amount, _deadline);
    }

    function closePosition(uint16 _index, uint256 _ltAmount, uint256 _deadline) public onlyTrader returns (uint256) {
        return _closePosition(_index, address(basicToken), _ltAmount, _deadline);
    }

    function exitPosition(uint16 _index, uint256 _ltAmount, uint256 _deadline) public onlyTrader returns (uint256) {
        return _exitPosition(_index, address(basicToken), _ltAmount, _deadline);
    }

    function adjustTotalCap() public onlyTrader returns (uint256){
        return _adjustTotalCap();
    }

    //external commissions operations

    function withdrawCommission(uint256 amount) public onlyTrader {
        require(amount <= traderCommissionBalance, "Amount to be less then external commission available to withdraw");
        basicToken.safeTransfer(traderCommissionAddress, amount);
        traderCommissionBalance = traderCommissionBalance.sub(amount);
    }

    function setTraderCommissionAddress(address _traderCommissionAddress) public onlyOwner {
        traderCommissionAddress = _traderCommissionAddress;
    }

    function setExternalCommissionPercent(uint8 _nom, uint8 _denom) public onlyOwner {
        require (_nom <= _denom, "Commission to be a natural fraction less then 1");
        traderCommissionPercentNom = _nom;
        traderCommissionPercentDenom = _denom;
    }

    function pause() onlyOwner public {
        super._pause();
    }

    function unpause() onlyOwner public {
        super._unpause();
    }

    //Views

    function getUserData(address holder) public view returns (uint256, uint256, uint256) {
        return (deposits[holder], withdrawals[holder], plt.balanceOf(holder));
    }

    function getTotalValueLocked() public view returns (uint256, uint256){
        return (totalCap, plt.totalSupply());
    }


    //distribute profit between all users
    function _callbackFinRes(uint16 index, uint256 ltAmount, uint256 receivedAmountB, bool isProfit, uint256 finResB) internal override {

        //apply operation fin res to totalcap and calculate commissions
        if(isProfit){
            uint256 commision = finResB.mul(traderCommissionPercentNom).div(traderCommissionPercentDenom);
            uint256 dexeCommission = commision.mul(3).div(10);
            dexeCommissionBalance = dexeCommissionBalance.add(dexeCommission);
            traderCommissionBalance = traderCommissionBalance.add(commision.sub(dexeCommission));

            totalCap = totalCap.add(finResB.sub(commision));
        }else{
            //decrease totalCap by operation loss result
            //set totalCap to 1wei in case things went so bad... 
            totalCap = (totalCap > finResB)?totalCap.sub(finResB):1;
        }

    }

    function _beforeDeposit(uint256 amount, address holder, address to) internal override {
        require(!paused(), "Cannot deposit when paused");
    }

}
