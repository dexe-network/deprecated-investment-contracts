pragma solidity 0.6.6;

import "../math/SafeMath.sol";
import "../token/ERC20/IERC20.sol";
import "../token/ERC20/ERC20Mintable.sol";
import "../token/ERC20/ERC20Burnable.sol";
import "../token/ERC20/SafeERC20.sol";
import "./PoolLiquidityToken.sol";
import "./PoolLiquidityTokenFixed.sol";


interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}

contract Pool{

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public constant wETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    IERC20 public basicToken;
    address public plt;

    uint256 public totalCap;

    mapping (address => uint256) public deposits;
    mapping (address => uint256) public withdrawals;

    bool private isFixedSupply;


    modifier isWrappedEth() {
        require(address(basicToken) == wETH);
        _;
    }

    event Deposit(address indexed who, uint256 amount);

    event Withdraw(address indexed who, uint256 amount);


    function _poolInit(address _basicToken, address pltTokenAddress, bool _isFixedSupply) internal {
        basicToken = IERC20(_basicToken);
        plt = pltTokenAddress;
        isFixedSupply = _isFixedSupply;
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
    * @param to - address to assign liquidity tokens to
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
        _withdrawETH(amount, msg.sender);
    }

    /**
    * converts spefied amount of Liquidity tokens to WETH, unwraps it and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of 
    * Liquidity tokens specidied. Resulted amount of tokens are transferred to specified address
    * @param amount - amount of liquidity tokens to exchange to ETH.
    * @param to - address to send resulted amount of ETH to
     */
    function withdrawETHTo(uint256 amount, address payable to) external isWrappedEth {
        _withdrawETH(amount, to);
    }

    /** Use with caution!
     */
    function _adjustTotalCap() internal returns (uint256) {
        if(basicToken.balanceOf(address(this)) > totalCap)
            totalCap = basicToken.balanceOf(address(this));
        return totalCap;
    }

    function _deposit(uint256 amount, address to) private {
        _beforeDeposit(amount, msg.sender, to);
        uint256 mintAmount = totalCap != 0 ? amount.mul(totalSupply()).div(totalCap) : amount;
        _mintLiquidity(to, mintAmount);
        totalCap = totalCap.add(amount);
        deposits[to] = deposits[to].add(amount);
        emit Deposit(to, amount);
        _afterDeposit(amount, mintAmount,  msg.sender, to);
    }

    function _withdraw(uint256 amountLiquidity, address to) private {
        _beforeWithdraw(amountLiquidity, msg.sender, to);
        uint256 revenue = totalSupply() != 0 ? amountLiquidity.mul(totalCap).div(totalSupply()) : amountLiquidity;
        require(revenue <= basicToken.balanceOf(address(this)), "Not enouth Basic Token tokens on the balance to withdraw");
        totalCap = totalCap.sub(revenue);
        _burnLiquidity(msg.sender, amountLiquidity);
        basicToken.safeTransfer(to, revenue);
        withdrawals[msg.sender] = withdrawals[msg.sender].add(revenue);
        emit Withdraw(msg.sender, revenue);
        _afterWithdraw(revenue, msg.sender, to);
    }

    function _withdrawETH(uint256 amountLiquidity, address payable to) private {
        _beforeWithdraw(amountLiquidity, msg.sender, to);
        uint256 revenue = totalSupply() != 0 ? amountLiquidity.mul(totalCap).div(totalSupply()) : amountLiquidity;
        require(revenue <= basicToken.balanceOf(address(this)), "Not enouth Basic Token tokens on the balance to withdraw");
        totalCap = totalCap.sub(revenue);
        _burnLiquidity(msg.sender, amountLiquidity);
        IWETH(wETH).withdraw(revenue);
        to.transfer(revenue);
        withdrawals[msg.sender] = withdrawals[msg.sender].add(revenue);
        emit Withdraw(msg.sender, revenue);
        _afterWithdraw(revenue, msg.sender, to);
    }

    function _mintLiquidity(address to, uint256 amount) private {
        if(isFixedSupply){
            IERC20(plt).safeTransfer(to, amount);
        }else{
            ERC20Mintable(plt).mintTo(to, amount);
        }
    }

    function _burnLiquidity(address from, uint256 amount) private {
        if(isFixedSupply){
            IERC20(plt).safeTransferFrom(from, address(this), amount);
        }else{
            ERC20Burnable(plt).burnFrom(from, amount);
        }
    }

    /**
    * returns amount of liquidity tokens assigned to users (for fixed supply pool this equals to amount sold, for variable supply pool this equals to amount of tokens minted)
     */
    function totalSupply() public view returns(uint256) {
        IERC20 token = IERC20(plt);
        return isFixedSupply?(token.totalSupply().sub(token.balanceOf(address(this)))):token.totalSupply();
    }

    function _beforeDeposit(uint256 amountTokenSent, address sender, address holder) internal virtual {}
    function _afterDeposit(uint256 amountTokenSent, uint256 amountLiquidityGot, address sender, address holder) internal virtual {}
    function _beforeWithdraw(uint256 amountLiquidity, address holder, address receiver) internal virtual {}
    function _afterWithdraw(uint256 amountTokenReceived, address holder, address receiver) internal virtual {}

}
