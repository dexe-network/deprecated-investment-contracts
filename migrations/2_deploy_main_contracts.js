// migrations/2_deploy_box.js
const TraderPoolFactoryUpgradeable = artifacts.require('TraderPoolFactoryUpgradeable');
const UpgradeableBeacon = artifacts.require('UpgradeableBeacon');
const BeaconProxy = artifacts.require('BeaconProxy');
const TraderPoolUpgradeable = artifacts.require('TraderPoolUpgradeable');
const PoolLiquidityTokenUpgradeable = artifacts.require('PoolLiquidityTokenUpgradeable');
const ExchangePositionManager = artifacts.require('ExchangePositionManager');
const ParamKeeper = artifacts.require('ParamKeeper');
const UniswapRouter = artifacts.require("IUniswapV2Router02");



function toBN(number) {
  return web3.utils.toBN(number);
}

function printEvents(txResult, strdata){
  console.log(strdata," events:",txResult.logs.length);
  for(var i=0;i<txResult.logs.length;i++){
      let argsLength = Object.keys(txResult.logs[i].args).length;
      console.log("Event ",txResult.logs[i].event, "  length:",argsLength);
      for(var j=0;j<argsLength;j++){
          if(!(typeof txResult.logs[i].args[j] === 'undefined') && txResult.logs[i].args[j].toString().length>0)
              console.log(">",i,">",j," ",txResult.logs[i].args[j].toString());
      }
  }

}

const decimals = toBN('10').pow(toBN('18'));
 
module.exports = async function (deployer, network, accounts) {

  let uniswapRouterAddress;
  
  if(network == 'rinkeby'){
    uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  }else if(network == 'ropsten' || network == 'ropsten-fork'){
    uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  }
  else if(network == 'test' || network =='mainnet'){
    uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  }

  let uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);
  let uniswapFactoryAddress = await uniswapRouter.factory.call();
  let wethTokenAddress = await uniswapRouter.WETH.call();

  let TraderPoolUpgradeableBeaconAddress;
  await deployer.deploy(TraderPoolUpgradeable).then(function(){
    return UpgradeableBeacon.new(TraderPoolUpgradeable.address);
  }).then(function (Beacon){
    console.log ("TraderPoolUpgradeable Beacon:", Beacon.address);
    TraderPoolUpgradeableBeaconAddress = Beacon.address;
  });

  let PoolLiquidityTokenUpgradeableBeaconAddress;
  await deployer.deploy(PoolLiquidityTokenUpgradeable).then(function(){
    return UpgradeableBeacon.new(PoolLiquidityTokenUpgradeable.address);
  }).then(function (Beacon){
    console.log ("PoolLiquidityTokenUpgradeableBeaconAddress Beacon:", Beacon.address);
    PoolLiquidityTokenUpgradeableBeaconAddress = Beacon.address;
  });

  let factoryInstance;
  await deployer.deploy(TraderPoolFactoryUpgradeable).then(function(){
    return UpgradeableBeacon.new(TraderPoolFactoryUpgradeable.address);
  }).then(function (Beacon){
    console.log ("TraderPoolFactoryUpgradeable Beacon:", Beacon.address);
    return BeaconProxy.new(Beacon.address, web3.utils.hexToBytes('0x'));
  }).then (function(BeaconProxy){
    return TraderPoolFactoryUpgradeable.at(BeaconProxy.address);
  }).then(function (instance){
    factoryInstance = instance;
  });
  console.log ("TraderPoolFactoryUpgradeable Proxy Instance:", factoryInstance.address);

  let paramKeeper;

  await deployer.deploy(ParamKeeper).then(function(){
    console.log("ParamKeeper.address: ",ParamKeeper.address);
    return ParamKeeper.at(ParamKeeper.address);
  }).then(function (instance){
    paramKeeper = instance;
  });

  await paramKeeper.setParamAddress.sendTransaction(toBN(1000), uniswapRouterAddress);
  await paramKeeper.setParamAddress.sendTransaction(toBN(1001), uniswapFactoryAddress);
  //insurance address
  await paramKeeper.setParamAddress.sendTransaction(toBN(101), accounts[8]);
  //dexe commission address
  await paramKeeper.setParamAddress.sendTransaction(toBN(102), accounts[8]);
  let exchangePositionManager;
  await ExchangePositionManager.new({from: accounts[0]}).then(instance => exchangePositionManager = instance);
  await paramKeeper.setPositionTool.sendTransaction(toBN(0),exchangePositionManager.address);

  //address _admin, address _traderContractBeaconAddress,address _pltBeaconAddress, address _paramkeeper, address _positionToolManager, address _weth
  await factoryInstance.initialize.sendTransaction(accounts[0],TraderPoolUpgradeableBeaconAddress,PoolLiquidityTokenUpgradeableBeaconAddress, paramKeeper.address,  paramKeeper.address, wethTokenAddress);
  await paramKeeper.setParamAddress.sendTransaction(toBN(1), factoryInstance.address);
  console.log("Factory inited");

  if(true && (network == 'ropsten' || network == 'ropsten-fork')){

    let traderWallet = accounts[0];
    let basicTokenAddress = '0xad6d458402f60fd3bd25163575031acdce07538d';

    let traderPoolFactoryAddress = await paramKeeper.getAddress.call(toBN(1));
    traderPoolFactory = await TraderPoolFactoryUpgradeable.at(traderPoolFactoryAddress);

    let commissions = [toBN(10),toBN(3),toBN(10),toBN(3), toBN(10),toBN(3)]; 

    // deploy trader pool for testing with basicToken
    let createResult = await traderPoolFactory.createTraderContract(traderWallet, basicTokenAddress, toBN(0), commissions, true, false, "Trader token 1", "TRT1");
    printEvents(createResult,"Trader Contract Deploy");
  }

  
};