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

contract AssetManagerAB is ReentrancyGuard{

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    Position[] public positions;

    event PositionPrepared(uint8 manager, address token, uint256 amountRequested, uint256 amountAccepted);

    event PositionOpened(uint16 index, uint8 manager, address token, uint256 amountOpened, uint256 liquidity);

    event PositionClosed(uint16 index, uint8 manager, address token, uint256 amountClosed, uint256 liquidity, bool isProfit, uint256 finResB);

    event PositionExited(uint16 index, uint8 manager, address token, uint256 amountClosed, uint256 liquidity, bool isProfit, uint256 finResB);

    IParamStorage private paramStorage;

    IPositionToolManager private positionToolManager;

    function _assetManagerInit(address _paramstorage, address _positiontoolmanager) internal {
        require (address(paramStorage) == address(0),"Already inited");
        paramStorage = IParamStorage(_paramstorage);
        positionToolManager = IPositionToolManager(_positiontoolmanager);
    }

    /**
    * returns amount of positions in Positions array. 
     */
    function positionsLength() external view returns (uint256) {
        return positions.length;
    }

    /**
    * returns Posision data from arrat at the _index specified. return data:
    *    1) manager - Position manager tool ID - the tool position was opened with.
    *    2) amountOpened - the amount of Basic Tokens a position was opened with.
    *    3) liquidity - the amount of Destination tokens received from exchange when position was opened.
    *    4) token - the address of ERC20 token that position was opened to 
    * i.e. the position was opened with  "amountOpened" of BasicTokens and resulted in "liquidity" amount of "token"s.  
     */
    
    function positionAt(uint16 _index) external view returns (uint8,uint256,uint256,address) {
        require(_index < positions.length);
        return (positions[_index].manager, positions[_index].amountOpened, positions[_index].liquidity, positions[_index].token);
    }

    /**
    * @dev Prepares position and returns amount of tokens accepted during prepare call. This operation is stateless.
    */
    function _praparePosition(uint8 _manager, address _basicToken, address _toToken, uint256 _amount, uint256 _deadline) internal nonReentrant returns (uint256) {
        require(positionToolManager.getPositionTool(_manager) != address(0),"PositionManager should not be zero address");
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("preparePosition(address,address,address,uint256,uint256)")),address(paramStorage),_basicToken,_toToken, _amount, _deadline);
        (bool success, bytes memory returnedData) = positionToolManager.getPositionTool(_manager).delegatecall(data);
        require(success, "PositionManager.preparePosition call failed");
        (uint256 tokenBaccepted) = abi.decode(returnedData, (uint256));
        emit PositionPrepared(_manager, _toToken, _amount, tokenBaccepted);
        return tokenBaccepted;     
    }

    /**
    * @dev opens position and returns position index
    */
    function _openPosition(uint8 _manager, uint16 _index, address _basicToken, address _toToken, uint256 _amount, uint256 _deadline) internal nonReentrant returns (uint256, uint256) {
        require(positionToolManager.getPositionTool(_manager) != address(0),"PositionManager should not be zero address");
        require(_index >= positions.length || positions[_index].token == _toToken, "Position mismatch or index incorrect");
        require(address(paramStorage) != address(0), "ParamStorage to be defined");
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("openPosition(address,address,address,uint256,uint256)")),address(paramStorage),_basicToken,_toToken, _amount, _deadline);
        (bool success, bytes memory returnedData) = positionToolManager.getPositionTool(_manager).delegatecall(data);
        require(success, "PositionManager.openPosition call failed");
        (uint256 tokenBaquired, uint256 liquidity) = abi.decode(returnedData, (uint256, uint256));
        Position memory pos = (_index < positions.length)? positions[_index]: Position (_manager,0,0,_toToken);

        pos.amountOpened = pos.amountOpened.add(tokenBaquired);
        pos.liquidity = pos.liquidity.add(liquidity);

        if(_index>=positions.length)
            positions.push(pos);
        else
            positions[_index] = pos;

        emit PositionOpened(_index<positions.length?_index:uint16(positions.length-1), _manager, _toToken, pos.amountOpened, pos.liquidity);
        
        return (tokenBaquired, liquidity);
        // return 0;     
    }

        /**
    * @dev opens position and returns position index
    */
    function _splitPosition(uint8 _manager, uint16 _indexFrom, uint16 _indexTo, address _basicToken, address _toToken, uint256 _ltAmount, uint256 _deadline) internal nonReentrant returns (uint256) {
        require(positionToolManager.getPositionTool(_manager) != address(0),"PositionManager should not be zero address");
        require(_indexFrom < positions.length && positions[_indexFrom].amountOpened > 0, "Splitting positions not allowed for empty positions");
        require(_indexTo >= positions.length && positions[_indexTo].amountOpened == 0, "Overwriting positions not allowed while active");
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("splitPosition(address,address,address,uint256,uint256)")),address(paramStorage),_basicToken,_toToken, _ltAmount, _deadline);
        (bool success, bytes memory returnedData) = positionToolManager.getPositionTool(_manager).delegatecall(data);
        require(success, "PositionManager.splitPosition call failed");
        (uint256 tokenBaquired, uint256 liquidity) = abi.decode(returnedData, (uint256, uint256));
        positions[_indexTo].manager = _manager;
        positions[_indexTo].amountOpened = tokenBaquired;
        positions[_indexTo].liquidity = liquidity;
        positions[_indexTo].token = _toToken;
        emit PositionOpened(_indexTo, _manager, _toToken, tokenBaquired, liquidity);
        return liquidity;
        // return 0;     
    }

    /**
    * @dev closes position and returns position index
    */
    function _rewardPosition(uint16 _index, address _basicToken,  uint256 _ltAmount, uint256 _deadline) internal nonReentrant returns (uint256){
        require(_ltAmount <= positions[_index].liquidity, "Position liquidity amount is less then requested");

        uint256 receivedBAmount;
        uint256 liquidityBurned;
        {
            bytes memory data = abi.encodeWithSelector(bytes4(keccak256("rewardPosition(address,address,address,uint256,uint256)")),address(paramStorage),_basicToken,positions[_index].token,_ltAmount,_deadline);
            (bool success, bytes memory returnedData) = positionToolManager.getPositionTool(positions[_index].manager).delegatecall(data);
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
        require(_index < positions.length,"index out of bound");
        require(_ltAmount<= positions[_index].liquidity,"liquidity overflow");
        require(positions[_index].liquidity > 0, "position to be opened");

        uint256 receivedBAmount;
        uint256 liquidityBurned;
        {
            bytes memory data = abi.encodeWithSelector(bytes4(keccak256("exitPosition(address,address,address,uint256,uint256)")),address(paramStorage),_basicToken,positions[_index].token,_ltAmount,_deadline);
            (bool success, bytes memory returnedData) = positionToolManager.getPositionTool(positions[_index].manager).delegatecall(data);
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

        //remove completely closed position
        if(positions[_index].liquidity == 0)
            _removePositionItem(_index);

        return receivedBAmount;
    }

    function _removePositionItem(uint16 index) private {
        require (index < positions.length, "Index out of bound");
        if(positions.length > 1){
            positions[index] = positions[positions.length-1];
        }
        // delete positions[positions.length-1];
        // positions.length--;
        // require (positions.length == 0, "not deleted");
        positions.pop();
    }

    /**
    * @dev callback for applying financial result logic before Position data updated
    */
    function _callbackFinRes(uint16 index, uint256 ltAmount, uint256 receivedAmountB, bool isProfit, uint256 finResB) internal virtual nonReentrant {}


}
