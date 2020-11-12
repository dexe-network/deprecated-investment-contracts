pragma solidity 0.6.6;

import "../math/SafeMath.sol";
import "../token/ERC20/IERC20.sol";
import "../token/ERC20/ERC20Mintable.sol";
import "../token/ERC20/ERC20Burnable.sol";
import "../token/ERC20/SafeERC20.sol";
import "./PoolLiquidityToken.sol";


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
    PoolLiquidityToken public plt;

    uint256 public totalCap;

    mapping (address => uint256) public deposits;
    mapping (address => uint256) public withdrawals;

    constructor(address _basicToken) public {
        plt = new PoolLiquidityToken();
        basicToken = IERC20(_basicToken);
    }

    modifier isWrappedEth() {
        require(address(basicToken) == wETH);
        _;
    }

    event Deposit(address who, uint256 amount);

    event Withdraw(address who, uint256 amount);


    //deposit functions
    receive() payable external isWrappedEth {
        if(msg.sender != wETH){ //omit re-entrancy
            uint256 amount = msg.value;
            IWETH(wETH).deposit{value: amount}();
            _deposit(amount,msg.sender);
        }
    }

    function depositETHTo(
        address to
    ) payable external isWrappedEth {
        uint256 amount = msg.value;
        IWETH(wETH).deposit{value: amount}();
        _deposit(amount,to);
    }

    function depositTo(
        uint256 amount,
        address to
    ) external {
        basicToken.safeTransferFrom(msg.sender, address(this), amount);
        _deposit(amount,to);
    }

    function deposit(
        uint256 amount
    ) external {
        basicToken.safeTransferFrom(msg.sender, address(this), amount);
        _deposit(amount,msg.sender);
    }

    //withdraw functions

    function withdraw(uint256 amount) external{
        _withdraw(amount,msg.sender);
    }

    function withdrawTo(
        uint256 amount,
        address to
    ) external {
        _withdraw(amount,to);
    }

    function withdrawETH(uint256 amount) external isWrappedEth {
        _withdrawETH(amount, msg.sender);
    }

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
        uint256 mintAmount = totalCap != 0 ? amount.mul(plt.totalSupply()).div(totalCap) : amount;
        plt.mintTo(to, mintAmount);
        totalCap = totalCap.add(amount);
        deposits[msg.sender] = deposits[msg.sender].add(amount);
        emit Deposit(msg.sender, amount);
        _afterDeposit(amount, msg.sender, to);
    }

    function _withdraw(uint256 amountLiquidity, address to) private {
        _beforeWithdraw(amountLiquidity, msg.sender, to);
        uint256 revenue = plt.totalSupply() != 0 ? amountLiquidity.mul(totalCap).div(plt.totalSupply()) : amountLiquidity;
        require(revenue <= basicToken.balanceOf(address(this)), "Not enouth Basic Token tokens on the balance to withdraw");
        totalCap = totalCap.sub(revenue);
        plt.burnFrom(msg.sender, amountLiquidity);
        basicToken.safeTransfer(to, revenue);
        withdrawals[msg.sender] = withdrawals[msg.sender].add(revenue);
        emit Withdraw(msg.sender, revenue);
        _afterWithdraw(revenue, msg.sender, to);
    }

    function _withdrawETH(uint256 amountLiquidity, address payable to) private {
        _beforeWithdraw(amountLiquidity, msg.sender, to);
        uint256 revenue = plt.totalSupply() != 0 ? amountLiquidity.mul(totalCap).div(plt.totalSupply()) : amountLiquidity;
        require(revenue <= basicToken.balanceOf(address(this)), "Not enouth Basic Token tokens on the balance to withdraw");
        totalCap = totalCap.sub(revenue);
        plt.burnFrom(msg.sender, amountLiquidity);
        IWETH(wETH).withdraw(revenue);
        to.transfer(revenue);
        withdrawals[msg.sender] = withdrawals[msg.sender].add(revenue);
        emit Withdraw(msg.sender, revenue);
        _afterWithdraw(revenue, msg.sender, to);
    }

    function _beforeDeposit(uint256 amount, address holder, address to) internal virtual {}
    function _afterDeposit(uint256 amount, address holder, address to) internal virtual {}
    function _beforeWithdraw(uint256 amountLiquidity, address holder, address to) internal virtual {}
    function _afterWithdraw(uint256 amountReceived, address holder, address to) internal virtual {}

}
