pragma solidity 0.6.6;



import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";


import "./assets/AssetManagerUpgradeable.sol";
import "./assets/IPositionManager.sol";
import "./ParamKeeper.sol";
import "./pool/PoolUpgradeable.sol";
import "./math/ABDKMath64x64.sol";
import "./interfaces/ITraderPoolInitializable.sol";


contract TraderPoolUpgradeable 
    is 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    PoolUpgradeable,
    AssetManagerUpgradeable,
    IParamStorage,
    ITraderPoolInitializable
    {

    using ABDKMath64x64 for int128;

    //ACL
    //Manager is the person allowed to manage funds
    bytes32 public TRADER_ROLE;

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


    function version() public view returns (uint256){
        //version in format aaa.bbb.ccc => aaa*1E6+bbb*1E3+ccc;
        return 1000000;
    }
    
    function initialize(address[9] memory iaddr, uint[2] memory iuint, bool _actual) public override initializer{
        /**
        address[] iaddr = [
            0... _admin,
            1... _traderWallet,
            2... _basicToken,
            3... _weth,
            4... _paramkeeper,
            5... _positiontoolmanager,
            6... _dexeComm,
            7... _insurance,
            8... _pltTokenAddress,
            ]
        uint256[] iuint = [
            0... _maxPoolTotalSupply,
            1... _tcNom,
            2... _tcDenom,
            ]
         */

        // address _basicToken, address _pltTokenAddress, address _weth
        __Pool_init(iaddr[2],iaddr[8],iaddr[3]);
        __ReentrancyGuard_init_unchained();
        __Pausable_init_unchained();
        __AccessControl_init_unchained();
        // address _paramstorage, address _positiontoolmanager
        __AssetManagerUpgradeable_init_unchained(address(this), iaddr[5]);

        // address _dexeComm, address _insurance, address _paramkeeper, address _positiontoolmanager
        // address _traderWallet, address _basicToken, address _pltAddress, bool _isFixedSupply, uint8 _tcNom, uint8 _tcDenom, bool _actual
        
        TRADER_ROLE = keccak256("TRADER_ROLE");

        //access control initial setup
        _setupRole(DEFAULT_ADMIN_ROLE, iaddr[0]);
        _setupRole(TRADER_ROLE, iaddr[1]);

        //safe mode "on" with commissions
        traderCommissionAddress = iaddr[1];
        traderCommissionPercentNom = uint8(iuint[0]);
        traderCommissionPercentDenom = uint8(iuint[1]);
        require (iuint[1]>0, "Incorrect traderCommissionPercentDenom");

        isActualOn = _actual;

        traderFundAddresses[iaddr[1]] = true;

        dexeCommissionAddress = iaddr[6];
        insuranceContractAddress = iaddr[7];
        paramkeeper = ParamKeeper(iaddr[4]);  
    
    }

    /**
    * @dev Throws if called by any account other than the one with the Admin role granted.
    */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not the Admin");
        _;
    }

    /**
    * @dev Throws if called by any account other than the one with the Trader role granted.
    */
    modifier onlyTrader() {
        require(hasRole(TRADER_ROLE, msg.sender), "Caller is not the Trader");
        _;
    }

    /**
    * adds new trader address (tokens received from this address considered to be the traders' tokens)
     */
    function addTraderAddress (address _traderAddress) public onlyTrader {
        traderFundAddresses[_traderAddress] = true;
    }

    /**
    * removes trader address (tokens received from trader address considered to be the traders' tokens)
    */
    function removeTraderAddress (address _traderAddress) public onlyTrader {
        delete traderFundAddresses[_traderAddress];
    }

    /**
    * Prepare position for trade (not actually used, stays here for back compatibility.)
    */
    function preparePosition(uint8 _manager, address _toToken, uint256 _amount, uint256 _deadline) public onlyTrader returns (uint256) {
        require(paramkeeper.isWhitelisted(_toToken) || traderWhitelist[_toToken],"Position token address to be whitelisted");
        return _praparePosition(_manager, address(basicToken), _toToken, _amount, _deadline);
    }

    /**
    * Opens trading position. Swaps a specified amount of Basic Token to Destination Token. 
    *
    * @param _manager - the ID of the Position Manager contract that will execute trading operation
    * @param _index - the index of the Position in the positions array. (closed positions can be overwritten by new positions to save some storage)
    * @param _toToken - the address of the ERC20 token (destination token) to swap BasicToken to. 
    * @param _amount - the amount of Basic Token to be swapped to destination token. 
    * @param _deadline - the timestamp of the deadline an operation have to complete before. Another way transaction will be reverted.
    */
    function openPosition(uint8 _manager, uint16 _index, address _toToken, uint256 _amount, uint256 _deadline) public onlyTrader returns (uint256, uint256) {
        //apply whitelist
        require(paramkeeper.isWhitelisted(_toToken) || traderWhitelist[_toToken],"Position token address to be whitelisted");
        return _openPosition(_manager, _index, address(basicToken), _toToken, _amount, _deadline);
        // return 0;
    }

    /**
    * get Reward from the position (not actually used, stays here for back compatibility). Can be used in future
     */
    function rewardPosition(uint16 _index, uint256 _ltAmount, uint256 _deadline) public onlyTrader returns (uint256) {
        return _rewardPosition(_index, address(basicToken), _ltAmount, _deadline);
    }

    /**
    * Exit trading position. Swaps a specified amount of Destination Token back to Basic Token and calculates finacial result (profit or loss), that affects pool totalCap param. 
    *
    * @param _index - the index of the Position in the positions array. 
    * @param _ltAmount - the amount of Destination token to be swapped back (position can be partially closed, so this might not equal full LT amount of the position)
    * @param _deadline - the timestamp of the deadline an operation have to complete before. Another way transaction will be reverted.
    */
    function exitPosition(uint16 _index, uint256 _ltAmount, uint256 _deadline) public onlyTrader returns (uint256) {
        return _exitPosition(_index, address(basicToken), _ltAmount, _deadline);
    }

    /**
    * method that adjusts totalCap higher to be equal to actual amount of BasicTokens on the balance of this smart contract. 
     */
    function adjustTotalCap() public onlyTrader returns (uint256){
        return _adjustTotalCap();
    }

    /**
    * returns address of the PositionManager contract implementation. The functional contract that is used to operate positions. 
    */
    function getPositionTool(uint8 _index) external view returns (address) {
        paramkeeper.getPositionTool(_index);
    }

    /**
    * initiates withdraw of the Trader commission onto the Trader Commission address. Used by Trader to get his commission out from this contract. 
     */
    function withdrawTraderCommission(uint256 amount) public onlyTrader {
        require(amount <= traderCommissionBalance, "Amount to be less then external commission available to withdraw");
        basicToken.safeTransfer(traderCommissionAddress, amount);
        traderCommissionBalance = traderCommissionBalance.sub(amount);
    }
    
    /**
    * initiates withdraw of the Dexe commission onto the Trader Commission address. Used by Trader to get his commission out from this contract. 
     */
    function withdrawDexeCommission(uint256 amount) public {
        require(amount <= dexeCommissionBalance, "Amount to be less then external commission available to withdraw");
        basicToken.safeTransfer(dexeCommissionAddress, amount);
        dexeCommissionBalance = dexeCommissionBalance.sub(amount);
    }


    /**
    * Set new traderCommission address. The address that trader receives his commission out from this contract. 
     */
    function setTraderCommissionAddress(address _traderCommissionAddress) public onlyTrader {
        traderCommissionAddress = _traderCommissionAddress;
    }

    //TODO: apply governance here
    /**
    * set external commission percent in a form of natural fraction: _nom/_denom. 
    */
    function setExternalCommissionPercent(uint8 _nom, uint8 _denom) public onlyAdmin {
        require (_nom <= _denom, "Commission to be a natural fraction less then 1");
        traderCommissionPercentNom = _nom;
        traderCommissionPercentDenom = _denom;
    }

    /**
    * set contract on hold. Paused contract doesn't accepts Deposits but allows to withdraw funds. 
     */
    function pause() onlyAdmin public {
        super._pause();
    }
    /**
    * unpause the contract (enable deposit operations)
     */
    function unpause() onlyAdmin public {
        super._unpause();
    }

    /**
    * returns address parameter from central parameter storage operated by the platform. Used by PositionManager contracts to receive settings required for performing operations. 
    * @param key - ID of address parameter;
    */
    function getAddress(uint16 key) external override view returns (address){
        return paramkeeper.getAddress(key);
    }
    /**
    * returns uint256 parameter from central parameter storage operated by the platform. Used by PositionManager contracts to receive settings required for performing operations. 
    * @param key - ID of uint256 parameter;
    */
    function getUInt256(uint16 key) external override view returns (uint256){
        return paramkeeper.getUInt256(key);
    }
    
    /**
    * returns the data of the User:
    *    1) total amount of BasicTokens deposited (historical value)
    *    2) total amount of BasicTokens withdrawn (historical value)
    *    3) current amount of TraderPool liquidity tokens that User has on the balance. 
    * @param holder - address of the User's wallet. 
     */
    function getUserData(address holder) public view returns (uint256, uint256, uint256) {
        return (deposits[holder], withdrawals[holder], IERC20Token(plt).balanceOf(holder));
    }

    /**
    * returns total cap values for this contract: 
    * 1) totalCap value - total capitalization, including profits and losses, denominated in BasicTokens. i.e. total amount of BasicTokens that porfolio is worhs of.
    * 2) totalSupply of the TraderPool liquidity tokens (or total amount of trader tokens sold to Users). 
    * Trader token current price = totalCap/totalSupply;
    */
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
