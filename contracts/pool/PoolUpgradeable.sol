pragma solidity 0.6.6;

// import "../math/SafeMath.sol";
// import "../token/ERC20/IERC20.sol";
// import "../token/ERC20/ERC20Mintable.sol";
// import "../token/ERC20/ERC20Burnable.sol";
// import "../token/ERC20/SafeERC20.sol";
// import "./PoolLiquidityToken.sol";
// import "./PoolLiquidityTokenFixed.sol";

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import "../interfaces/IERC20Token.sol";
import "../interfaces/IPoolLiquidityToken.sol";
import "../math/ABDKMath64x64.sol";


interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}

abstract contract PoolUpgradeable is Initializable{

    using SafeERC20Upgradeable for IERC20Token;
    using SafeMathUpgradeable for uint256;
    using ABDKMath64x64 for int128;

    address private wETH;
    address public plt;
    // uint256 public totalCap;
    uint256 public availableCap;
    IERC20Token public basicToken;

    mapping (address => InvestorDepositData) public deposits;

    struct InvestorDepositData {
        uint256 amount;
        int128 price;
    }

    modifier isWrappedEth() {
        require(address(basicToken) == wETH,"Not wrapped ETH contract");
        _;
    }

    event Deposit(address indexed who, uint256 amountBT, uint256 liquidity, int128 price);

    event Withdraw(address indexed who, uint256 amountBT, uint256 liquidity, uint256 commision);


    function __Pool_init(address _basicToken, address _pltTokenAddress, address _weth) internal initializer {
        
        __Pool_init_unchained(_basicToken,_pltTokenAddress, _weth);
    }

    function __Pool_init_unchained(address _basicToken, address _pltTokenAddress, address _weth) internal initializer {
        basicToken = IERC20Token(_basicToken);
        plt = _pltTokenAddress;
        wETH = _weth;
    }


    /**
    * Deposit ETH by direct transfer. Converts to WETH immediately for further operations. Liquidity tokens are assigned to msg.sender address.  
     */
    receive() payable external isWrappedEth {
        if(msg.sender != wETH){ //omit re-entrancy
            uint256 amount = msg.value;
            IWETH(wETH).deposit{value: amount}();
            _deposit(amount,msg.sender);
        }
    }

    fallback() payable external isWrappedEth{
        if(msg.sender != wETH){ //omit re-entrancy
            uint256 amount = msg.value;
            IWETH(wETH).deposit{value: amount}();
            _deposit(amount,msg.sender);
        }
    }

    /**
    * deposit ETH, converts to WETH and assigns Liquidity tokens to provided address
    * @param to - address to assign liquidity tokens to
     */
    function depositETHTo(
        address to
    ) payable external isWrappedEth {
        uint256 amount = msg.value;
        IWETH(wETH).deposit{value: amount}();
        _deposit(amount,to);
    }

    
    /**
    * deposit ERC20 tokens function, assigns Liquidity tokens to provided address.
    * @param to - address to assign liquidity tokens to
    */
    function depositTo(
        uint256 amount,
        address to
    ) external {
        basicToken.safeTransferFrom(msg.sender, address(this), amount);
        _deposit(amount,to);
    }

    /**
    * deposit ERC20 tokens function, assigns Liquidity tokens to msg.sender address.
    */
    function deposit(
        uint256 amount
    ) external {
        basicToken.safeTransferFrom(msg.sender, address(this), amount);
        _deposit(amount,msg.sender);
    }

    
    /**
    * converts spefied amount of Liquidity tokens to Basic Token and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of 
    * Liquidity tokens. Resulted amount of tokens are transferred to msg.sender
    * @param amount - amount of liquidity tokens to exchange to Basic token.
     */
    function withdraw(uint256 amount) external{
        _withdraw(amount,msg.sender);
    }

    /**
    * converts spefied amount of Liquidity tokens to Basic Token and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of Liquidity tokens. 
    * Resulted amount of tokens are transferred to specified address
    * @param amount - amount of liquidity tokens to exchange to Basic token.
    * @param to - address to send resulted amount of tokens to
     */
    function withdrawTo(
        uint256 amount,
        address to
    ) external {
        _withdraw(amount,to);
    }

    /**
    * converts spefied amount of Liquidity tokens to WETH, unwraps it and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of 
    * Liquidity tokens specidied. Resulted amount of tokens are transferred to msg.sender
    * @param amount - amount of liquidity tokens to exchange to ETH.
     */
    function withdrawETH(uint256 amount) external isWrappedEth {
        _withdraw(amount, msg.sender);
    }

    /**
    * converts spefied amount of Liquidity tokens to WETH, unwraps it and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of 
    * Liquidity tokens specidied. Resulted amount of tokens are transferred to specified address
    * @param amount - amount of liquidity tokens to exchange to ETH.
    * @param to - address to send resulted amount of ETH to
     */
    function withdrawETHTo(uint256 amount, address payable to) external isWrappedEth {
        _withdraw(amount, to);
    }

    /** Use with caution!
     */
    // function _adjustTotalCap() internal returns (uint256) {
    //     if(basicToken.balanceOf(address(this)) > totalCap)
    //         totalCap = basicToken.balanceOf(address(this));
    //     return totalCap;
    // }

    function _deposit(uint256 amount, address to) private {
        _beforeDeposit(amount, msg.sender, to);
        uint256 totalCap = _totalCap();
        uint256 totalSupply = IPoolLiquidityToken(plt).totalSupply();
        int128 currentTokenPrice = totalSupply>0?ABDKMath64x64.divu(totalCap, totalSupply):ABDKMath64x64.fromUInt(1);

        uint256 liquidity = totalCap != 0 ? amount.mul(totalSupply).div(totalCap) : amount;
        IPoolLiquidityToken(plt).mint(to, liquidity);
        availableCap = availableCap.add(amount);
        
        deposits[to].price = ABDKMath64x64.divu(deposits[to].price.mulu(deposits[to].amount).add(currentTokenPrice.mulu(amount)),amount.add(deposits[to].amount));
        deposits[to].amount = deposits[to].amount.add(amount);
        
        emit Deposit(to, amount, liquidity, currentTokenPrice);
        _afterDeposit(amount, liquidity,  msg.sender, to, currentTokenPrice);
    }

    function _withdraw(uint256 amountLiquidity, address to) private {
        _beforeWithdraw(amountLiquidity, msg.sender, to);
        uint256 totalCap = _totalCap();
        uint256 totalSupply = IPoolLiquidityToken(plt).totalSupply();
        int128 currentTokenPrice = totalSupply>0?ABDKMath64x64.divu(totalCap, totalSupply):ABDKMath64x64.fromUInt(1);
        uint256 revenue = totalSupply != 0 ? amountLiquidity.mul(totalCap).div(totalSupply) : amountLiquidity;
        uint256 commision = _getWithdrawalCommission(amountLiquidity, msg.sender, currentTokenPrice);
        uint256 paidOff = revenue.sub(commision);
        require(paidOff <= availableCap, "Not enouth Basic Token tokens on the balance to withdraw");
        availableCap = availableCap.sub(paidOff);
        IPoolLiquidityToken(plt).burn(msg.sender, amountLiquidity);
        basicToken.safeTransfer(to, paidOff);
        emit Withdraw(msg.sender, revenue, amountLiquidity, commision);
        _afterWithdraw(revenue, msg.sender, to);
    }

    // function _withdrawETH(uint256 amountLiquidity, address payable to) private {
    //     _beforeWithdraw(amountLiquidity, msg.sender, to);
    //     uint256 totalCap = _totalCap();
    //     uint256 revenue = totalSupply() != 0 ? amountLiquidity.mul(totalCap).div(totalSupply()) : amountLiquidity;
    //     require(revenue <= availableCap), "Not enouth Basic Token tokens on the balance to withdraw");
    //     availableCap = availableCap.sub(revenue);
    //     IPoolLiquidityToken(plt).burn(msg.sender, amountLiquidity);
    //     withdrawals[msg.sender] = withdrawals[msg.sender].add(revenue);
    //     basicToken.safeTransfer(to, revenue);
    //     // IWETH(wETH).withdraw(revenue);
    //     // to.transfer(revenue);
    //     emit Withdraw(msg.sender, revenue);
    //     _afterWithdraw(revenue, msg.sender, to);
    // }

    /**
    * returns amount of liquidity tokens assigned to users (for fixed supply pool this equals to amount sold, for variable supply pool this equals to amount of tokens minted)
     */
    function totalSupply() public view returns(uint256) {
        return IPoolLiquidityToken(plt).totalSupply();
    }

    function _beforeDeposit(uint256 amountTokenSent, address sender, address holder) internal virtual {}
    function _afterDeposit(uint256 amountTokenSent, uint256 amountLiquidityGot, address sender, address holder, int128 tokenPrice) internal virtual {}
    function _beforeWithdraw(uint256 amountLiquidity, address holder, address receiver) internal virtual {}
    function _afterWithdraw(uint256 amountTokenReceived, address holder, address receiver) internal virtual {}

    
    function _totalCap() internal virtual view returns (uint256);

    function _tokenPrice() internal view returns (int128) {
        uint256 totalCapValue = _totalCap();
        uint256 totalSupplyValue = IPoolLiquidityToken(plt).totalSupply();
        return totalSupplyValue>0?ABDKMath64x64.divu(totalCapValue, totalSupplyValue):ABDKMath64x64.fromUInt(1);
    }

    function _getWithdrawalCommission(uint256 liquidity, address holder, int128 tokenPrice) internal virtual view returns (uint256);
    
    uint256[10] private __gap;
}
