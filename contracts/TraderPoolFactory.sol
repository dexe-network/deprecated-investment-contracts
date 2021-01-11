// SPDX-License-Identifier: MIT
pragma solidity 0.6.6;

import "./access/Ownable.sol";
import "./clone/CloneFactory.sol";
import "./ParamKeeper.sol";
import "./TraderPool.sol";
import "./pool/PoolLiquidityToken.sol";
import "./pool/PoolLiquidityTokenFixed.sol";

contract TraderPoolFactory is Ownable, CloneFactory {

  ParamKeeper public paramkeeper;

  address public positionToolManager;

  address public traderContractAddress;

  event TraderContractCreated(address newContractAddress);

  IERC20 private erc20mintableTemplate;

  IERC20 private erc20fixedTemplate;

  constructor(address _traderContractAddress, address _paramkeeper, address _positionToolManager) public {
    traderContractAddress = _traderContractAddress;
    paramkeeper = ParamKeeper(_paramkeeper);
    erc20mintableTemplate = new PoolLiquidityToken(); 
    erc20fixedTemplate = new PoolLiquidityTokenFixed();
    positionToolManager = _positionToolManager;
  }

  function setLibraryAddress(address _traderContractAddress) public onlyOwner {
    traderContractAddress = _traderContractAddress;
  }

  function createTraderContract(address _traderWallet, address _basicToken, uint256 _totalSupply, uint8 _tcNom, uint8 _tcDenom, bool _actual) public returns (address){
    address payable clone = createClone(traderContractAddress);
    // init(address _traderWallet, address _basicToken, uint256 _totalSupply, uint8 _tcNom, uint8 _tcDenom, bool _actual)
    bool isFixedSupply = _totalSupply > 0;
    address plt = isFixedSupply? createClone(address(erc20fixedTemplate)):createClone(address(erc20mintableTemplate));
    if(isFixedSupply){
        PoolLiquidityTokenFixed(plt).init(_totalSupply,clone);
    }

    TraderPool(clone).init(_traderWallet, _basicToken, plt, isFixedSupply , _tcNom, _tcDenom, _actual);
    // init2(address _dexeComm, address _insurance, address _paramkeeper) 
    TraderPool(clone).init2(getDexeCommissionAddress(), getInsuranceAddress(), address(paramkeeper), positionToolManager);
    //
    emit TraderContractCreated(clone);

    return clone;
  }

  function getInsuranceAddress() public view returns (address) {
    return paramkeeper.getAddress(101);
  }

  function getDexeCommissionAddress() public view returns (address) {
    return paramkeeper.getAddress(102);
  }

}
