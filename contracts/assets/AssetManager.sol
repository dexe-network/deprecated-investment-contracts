pragma solidity 0.6.6;

import "../math/SafeMath.sol";
import "../token/ERC20/IERC20.sol";
import "../token/ERC20/SafeERC20.sol";
import "../utils/ReentrancyGuard.sol";
import "./IPositionManager.sol";

struct Position {
    //manager index
    uint8 manager;
    //amount of tokens position was opened with
    uint256 amountOpened;
    //liquidity tokens equivalent of the position. When 0 => position closed.
    uint256 liquidity;
    //position toToken address
    address token;
}

contract AssetManager is ReentrancyGuard, IParamStorage {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping (uint16 => Position) public positions;
    mapping (uint8 => address) internal managers;

    mapping (uint16 => address) private addressParams;
    mapping (uint16 => uint256) private uintParams;

    event PositionPrepared(uint8 manager, address token, uint256 amountRequested, uint256 amountAccepted);

    event PositionOpened(uint16 index, uint8 manager, address token, uint256 amountOpened, uint256 liquidity);

    event PositionClosed(uint16 index, uint8 manager, address token, uint256 amountClosed, uint256 liquidity, bool isProfit, uint256 finResB);

    event PositionExited(uint16 index, uint8 manager, address token, uint256 amountClosed, uint256 liquidity, bool isProfit, uint256 finResB);

    constructor() public {
    }

    function getAddress(uint16 key) external override view returns (address){
        return addressParams[key];
    }

    function getUInt256(uint16 key) external override view returns (uint256){
        return uintParams[key];
    }

    function positionAt(uint16 _index) external view returns (uint8,uint256,uint256,address) {
        return (positions[_index].manager, positions[_index].amountOpened, positions[_index].liquidity, positions[_index].token);
    }

    function _setAddress(uint16 _key, address _value) internal {
        addressParams[_key] = _value;
    }

    function _setUInt256(uint16 _key, uint256 _value) internal {
        uintParams[_key] = _value;
    }

    function _setPositionManager(uint8 _index, address _address) internal {
        managers[_index] = _address;
    }

    /**
    * @dev Prepares position and returns amount of tokens accepted during prepare call. This operation is stateless.
    */
    function _praparePosition(uint8 _manager, address _basicToken, address _toToken, uint256 _amount, uint256 _deadline) internal nonReentrant returns (uint256) {
        require(managers[_manager] != address(0),"PositionManager should not be zero address");
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("preparePosition(address,address,address,uint256,uint256)")),address(this),_basicToken,_toToken, _amount, _deadline);
        (bool success, bytes memory returnedData) = managers[_manager].delegatecall(data);
        require(success, "PositionManager.preparePosition call failed");
        (uint256 tokenBaccepted) = abi.decode(returnedData, (uint256));
        emit PositionPrepared(_manager, _toToken, _amount, tokenBaccepted);
        return tokenBaccepted;     
    }

    /**
    * @dev opens position and returns position index
    */
    function _openPosition(uint8 _manager, uint16 _index, address _basicToken, address _toToken, uint256 _amount, uint256 _deadline) internal nonReentrant returns (uint256) {
        require(managers[_manager] != address(0),"PositionManager should not be zero address");
        require(positions[_index].amountOpened == 0, "Overwriting positions not allowed while active");
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("openPosition(address,address,address,uint256,uint256)")),address(this),_basicToken,_toToken, _amount, _deadline);
        (bool success, bytes memory returnedData) = managers[_manager].delegatecall(data);
        require(success, "PositionManager.openPosition call failed");
        (uint256 tokenBaquired, uint256 liquidity) = abi.decode(returnedData, (uint256, uint256));
        positions[_index].manager = _manager;
        positions[_index].amountOpened = tokenBaquired;
        positions[_index].liquidity = liquidity;
        positions[_index].token = _toToken;
        emit PositionOpened(_index, _manager, _toToken, tokenBaquired, liquidity);
        return liquidity;
        // return 0;     
    }

    /**
    * @dev closes position and returns position index
    */
    function _closePosition(uint16 _index, address _basicToken,  uint256 _ltAmount, uint256 _deadline) internal nonReentrant returns (uint256){
        //require(_ltAmount <= positions[_index].liquidity, "Position liquidity amount is less then requested");

        uint256 receivedBAmount;
        uint256 liquidityBurned;
        {
            bytes memory data = abi.encodeWithSelector(bytes4(keccak256("closePosition(address,address,address,uint256,uint256)")),address(this),_basicToken,positions[_index].token,_ltAmount,_deadline);
            (bool success, bytes memory returnedData) = managers[positions[_index].manager].delegatecall(data);
            require(success, "PositionManager.closePosition call failed");
            (receivedBAmount,liquidityBurned)=abi.decode(returnedData, (uint256, uint256));
        }

        require(liquidityBurned <= positions[_index].liquidity, "Liquidity consumed by operation is too high");
        //calculate Financial result of the (partial) position close 
        //Deduct from Position opened amount. 
        
        uint256 amountOpenedPart = positions[_index].liquidity>0?positions[_index].amountOpened.mul(liquidityBurned).div(positions[_index].liquidity):0;
        bool isProfit = amountOpenedPart < receivedBAmount;
        uint256 finResB = isProfit?(receivedBAmount.sub(amountOpenedPart)):(amountOpenedPart.sub(receivedBAmount));

        _callbackFinRes(_index, liquidityBurned, receivedBAmount, isProfit, finResB);

        positions[_index].liquidity = positions[_index].liquidity.sub(liquidityBurned);
        positions[_index].amountOpened = positions[_index].amountOpened.sub(amountOpenedPart);

        emit PositionClosed(_index,positions[_index].manager,positions[_index].token,receivedBAmount,liquidityBurned,isProfit,finResB);

        return receivedBAmount;
    }

     /**
    * @dev closes position and returns position index
    */
    function _exitPosition(uint16 _index, address _basicToken,  uint256 _ltAmount, uint256 _deadline) internal nonReentrant returns (uint256){
        

        uint256 receivedBAmount;
        uint256 liquidityBurned;
        {
            bytes memory data = abi.encodeWithSelector(bytes4(keccak256("exitPosition(address,address,address,uint256,uint256)")),address(this),_basicToken,positions[_index].token,_ltAmount,_deadline);
            (bool success, bytes memory returnedData) = managers[positions[_index].manager].delegatecall(data);
            require(success, "PositionManager.exitPosition call failed");
            (receivedBAmount,liquidityBurned)=abi.decode(returnedData, (uint256, uint256));
        }
        //calculate Financial result of the (partial) position close 
        //Deduct from Position opened amount. 
        require(liquidityBurned <= positions[_index].liquidity, "Liquidity consumed by operation is too high");

        uint256 amountOpenedPart = positions[_index].liquidity>0?positions[_index].amountOpened.mul(liquidityBurned).div(positions[_index].liquidity):0;
        bool isProfit = amountOpenedPart < receivedBAmount;
        uint256 finResB = isProfit?(receivedBAmount.sub(amountOpenedPart)):(amountOpenedPart.sub(receivedBAmount));

        _callbackFinRes(_index, liquidityBurned, receivedBAmount, isProfit, finResB);

        positions[_index].liquidity = positions[_index].liquidity.sub(liquidityBurned);
        positions[_index].amountOpened = positions[_index].amountOpened.sub(amountOpenedPart);

        emit PositionExited(_index,positions[_index].manager,positions[_index].token,receivedBAmount,liquidityBurned,isProfit,finResB);

        return receivedBAmount;
    }

    /**
    * @dev callback for applying financial result logic before Position data updated
    */
    function _callbackFinRes(uint16 index, uint256 ltAmount, uint256 receivedAmountB, bool isProfit, uint256 finResB) internal virtual nonReentrant {}


}
