// SPDX-License-Identifier: MIT
pragma solidity 0.6.6;


import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./upgradeable/BeaconProxy.sol";
import "./interfaces/IParamStorage.sol";
import "./interfaces/ITraderPoolInitializable.sol";
import "./interfaces/IPoolLiquidityToken.sol";

contract TraderPoolFactoryUpgradeable is AccessControlUpgradeable {

  IParamStorage public paramkeeper;

  address public positionToolManager;

  address public traderContractBeaconAddress;
  address public pltBeaconAddress;

  address public dexeAdmin;

  address public wethAddress;

  event TraderContractCreated(address newContractAddress);

   /**
    * @dev Throws if called by any account other than the one with the Admin role granted.
    */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not the Admin");
        _;
    }

  function initialize(address _admin, address _traderContractBeaconAddress, address _pltBeaconAddress, address _paramkeeper, address _positionToolManager, address _weth) public initializer {
    __AccessControl_init();

    _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    
    dexeAdmin = _admin;
    wethAddress = _weth;
    traderContractBeaconAddress = _traderContractBeaconAddress;
    pltBeaconAddress = _pltBeaconAddress;
    paramkeeper = IParamStorage(_paramkeeper);
    positionToolManager = _positionToolManager;
  }

  function setTraderContractBeaconAddress(address _traderContractBeaconAddress) public onlyAdmin {
    traderContractBeaconAddress = _traderContractBeaconAddress;
  }

  function setDexeAdminAddress(address _dexeAdmin) public onlyAdmin {
    dexeAdmin = _dexeAdmin;
  }

  function createTraderContract(address _traderWallet, address _basicToken, uint256 _totalSupply, uint8 _tcNom, uint8 _tcDenom, uint8 _icNom, uint8 _icDenom, bool _actual,string memory name_, string memory symbol_) public returns (address){
    address traderContractProxy = address(new BeaconProxy(traderContractBeaconAddress, bytes("")));
    address poolTokenProxy = address(new BeaconProxy(pltBeaconAddress, bytes("")));
    IPoolLiquidityToken(poolTokenProxy).initialize(traderContractProxy, _totalSupply,name_,symbol_ );

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
            0... _tcNom,
            1... _tcDenom,
            ]
         */
    address[9] memory iaddr = [dexeAdmin, _traderWallet, _basicToken, wethAddress, address(paramkeeper),positionToolManager, getDexeCommissionAddress(),getInsuranceAddress(),poolTokenProxy];
    uint256[4] memory iuint = [uint256(_tcNom),uint256(_tcDenom),uint256(_icNom),uint256(_icDenom)];

    ITraderPoolInitializable(traderContractProxy).initialize(iaddr, iuint, _actual);
    //
    emit TraderContractCreated(traderContractProxy);

    return traderContractProxy;
  }

  function getInsuranceAddress() public view returns (address) {
    return paramkeeper.getAddress(101);
  }

  function getDexeCommissionAddress() public view returns (address) {
    return paramkeeper.getAddress(102);
  }

}
