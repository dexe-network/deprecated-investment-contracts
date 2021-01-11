pragma solidity 0.6.6;

import "./access/Ownable.sol";
import "./access/AccessControl.sol";
import "./math/SafeMath.sol";
import "./math/ABDKMath64x64.sol";
import "./utils/Pausable.sol";
import "./token/ERC20/IERC20.sol";
import "./token/ERC20/ERC20Mintable.sol";
import "./token/ERC20/ERC20Burnable.sol";
import "./token/ERC20/SafeERC20.sol";
import "./pool/Pool.sol";
import "./assets/AssetManagerAB.sol";
import "./assets/IPositionManager.sol";
import "./ParamKeeper.sol";



contract TraderPool 
    is 
    Ownable, 
    AccessControl, 
    Pausable, 
    Pool,
    AssetManagerAB,
    IParamStorage
    {

    using SafeMath for uint256;
    using ABDKMath64x64 for int128;
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

    bool public isActualOn;

    address public insuranceContractAddress;

    ParamKeeper private paramkeeper;

    //addresses that trader may fund from (funded from these addresses considered as a trader funds)
    mapping (address => bool) traderFundAddresses;

    //trader token address whitelist
    mapping (address => bool) public traderWhitelist;

    //funds on the contract that belongs to trader
    uint256 public traderLiquidityBalance;

    //max traderTokenPrice that any investor ever bought
    int128 public maxDepositedTokenPrice;
    

    constructor() public {
    
    }

    function init(address _traderWallet, address _basicToken, address _pltAddress, bool _isFixedSupply, uint8 _tcNom, uint8 _tcDenom, bool _actual) public onlyOwner 
    {
        _poolInit(_basicToken, _pltAddress, _isFixedSupply) ;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(TRADER_ROLE, _traderWallet);

        //safe mode "on" with commissions
        traderCommissionAddress = _traderWallet;
        traderCommissionPercentNom = _tcNom;
        traderCommissionPercentDenom = _tcDenom;

        isActualOn = _actual;

        traderFundAddresses[_traderWallet] = true;

    }

    function init2(address _dexeComm, address _insurance, address _paramkeeper, address _positiontoolmanager) public onlyOwner {
        dexeCommissionAddress = _dexeComm;
        insuranceContractAddress = _insurance;
        paramkeeper = ParamKeeper(_paramkeeper);  
        _assetManagerInit(address(this), _positiontoolmanager);      
    }

    /**
    * @dev Throws if called by any account other than the one with the Manager role granted.
    */
    modifier onlyTrader() {
        require(hasRole(TRADER_ROLE, msg.sender), "Caller is not the Trader");
        _;
    }

    function addTraderAddress (address _traderAddress) public onlyTrader {
        traderFundAddresses[_traderAddress] = true;
    }

    function removeTraderAddress (address _traderAddress) public onlyTrader {
        delete traderFundAddresses[_traderAddress];
    }

    //AssetManager
    function preparePosition(uint8 _manager, address _toToken, uint256 _amount, uint256 _deadline) public onlyTrader returns (uint256) {
        require(paramkeeper.isWhitelisted(_toToken) || traderWhitelist[_toToken],"Position token address to be whitelisted");
        return _praparePosition(_manager, address(basicToken), _toToken, _amount, _deadline);
    }

    function openPosition(uint8 _manager, uint16 _index, address _toToken, uint256 _amount, uint256 _deadline) public onlyTrader returns (uint256, uint256) {
        //apply whitelist
        require(paramkeeper.isWhitelisted(_toToken) || traderWhitelist[_toToken],"Position token address to be whitelisted");
        return _openPosition(_manager, _index, address(basicToken), _toToken, _amount, _deadline);
        // return 0;
    }

    function rewardPosition(uint16 _index, uint256 _ltAmount, uint256 _deadline) public onlyTrader returns (uint256) {
        return _rewardPosition(_index, address(basicToken), _ltAmount, _deadline);
    }

    function exitPosition(uint16 _index, uint256 _ltAmount, uint256 _deadline) public onlyTrader returns (uint256) {
        return _exitPosition(_index, address(basicToken), _ltAmount, _deadline);
    }

    function adjustTotalCap() public onlyTrader returns (uint256){
        return _adjustTotalCap();
    }

    //interfaces IPositionToolManager
    function getPositionTool(uint8 _index) external view returns (address) {
        paramkeeper.getPositionTool(_index);
    }

    //external commissions operations
    function withdrawTraderCommission(uint256 amount) public onlyTrader {
        require(amount <= traderCommissionBalance, "Amount to be less then external commission available to withdraw");
        basicToken.safeTransfer(traderCommissionAddress, amount);
        traderCommissionBalance = traderCommissionBalance.sub(amount);
    }

    function setTraderCommissionAddress(address _traderCommissionAddress) public onlyTrader {
        traderCommissionAddress = _traderCommissionAddress;
    }

    //TODO: apply governance here
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

    //interface IParamStorage 
    function getAddress(uint16 key) external override view returns (address){
        return paramkeeper.getAddress(key);
    }

    function getUInt256(uint16 key) external override view returns (uint256){
        return paramkeeper.getUInt256(key);
    }

    //Views

    function getUserData(address holder) public view returns (uint256, uint256, uint256) {
        return (deposits[holder], withdrawals[holder], IERC20(plt).balanceOf(holder));
    }

    function getTotalValueLocked() public view returns (uint256, uint256){
        return (totalCap, totalSupply());
    }


    //distribute profit between all users
    function _callbackFinRes(uint16 index, uint256 ltAmount, uint256 receivedAmountB, bool isProfit, uint256 finResB) internal override {
        //apply operation fin res to totalcap and calculate commissions
        if(isProfit){

            uint256 operationTraderCommission = finResB.mul(traderCommissionPercentNom).div(traderCommissionPercentDenom);

            int128 currentTokenPrice = ABDKMath64x64.divu(totalCap, totalSupply());
            //apply trader commision fine if required
            if (currentTokenPrice < maxDepositedTokenPrice) {
                int128 traderFine = currentTokenPrice.div(maxDepositedTokenPrice);
                traderFine = traderFine.mul(traderFine);// ^2
                operationTraderCommission = traderFine.mulu(operationTraderCommission);
            }

            uint256 operationDeXeCommission = operationTraderCommission.mul(3).div(10);
            dexeCommissionBalance = dexeCommissionBalance.add(operationDeXeCommission);
            traderCommissionBalance = traderCommissionBalance.add(operationTraderCommission.sub(operationDeXeCommission));

            totalCap = totalCap.add(finResB.sub(operationTraderCommission));
        }else{
            //decrease totalCap by operation loss result
            //set totalCap to 1wei in case things went so bad... 
            totalCap = (totalCap > finResB)?totalCap.sub(finResB):1;
        }

    }

    function _beforeDeposit(uint256 amountTokenSent, address sender, address holder) internal override {
        require(!paused(), "Cannot deposit when paused");
    }

    function _afterDeposit(uint256 amountTokenSent, uint256 amountLiquidityGot, address sender, address holder) internal override {
        // check if that was a trader who put a deposit
        if(traderFundAddresses[holder])
            traderLiquidityBalance = traderLiquidityBalance.add(amountLiquidityGot);
        // store max traderTokenPrice that any investor got in
        int128 currentTokenPrice = ABDKMath64x64.divu(totalCap, totalSupply());
        maxDepositedTokenPrice = (maxDepositedTokenPrice<currentTokenPrice)?currentTokenPrice:maxDepositedTokenPrice;
        //TODO: for active position - distribute funds between positions.
        if(isActualOn && positions.length > 0){
            uint256 totalOpened=0;
            for(uint i=0;i<positions.length;i++){
                totalOpened = totalOpened.add(positions[i].amountOpened);
            }
            //fund
            uint256 amoutTokenLeft = amountTokenSent;
            uint256 deadline = block.timestamp + 5*60;
            uint256 liquidity;
            for(uint16 i=0;i<positions.length;i++){
                uint256 fundPositionAmt = amountTokenSent.mul(positions[i].amountOpened).div(totalOpened);
                if(fundPositionAmt < amoutTokenLeft)//underflow with division
                    fundPositionAmt = amoutTokenLeft;
                (fundPositionAmt, liquidity) = _openPosition(positions[i].manager, i, address(basicToken), positions[i].token, fundPositionAmt, deadline);
                amoutTokenLeft = amoutTokenLeft.sub(fundPositionAmt);
            }
        }

    }

    function _beforeWithdraw(uint256 amountLiquidity, address holder, address receiver) internal override {
        //TODO: release funds from positions
    }

    function _afterWithdraw(uint256 amountTokenReceived, address holder, address receiver) internal override {
        //TODO: aquire commission from user for withdrawal in case of protit
    }


}
