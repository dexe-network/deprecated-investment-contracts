// migrations/2_deploy_box.js
const TraderPoolFactoryUpgradeable = artifacts.require('TraderPoolFactoryUpgradeable');
const UpgradeableBeacon = artifacts.require('UpgradeableBeacon');
const BeaconProxy = artifacts.require('BeaconProxy');
const TraderPoolUpgradeable = artifacts.require('TraderPoolUpgradeable');
const PoolLiquidityTokenUpgradeable = artifacts.require('PoolLiquidityTokenUpgradeable');
const UniswapExchangeTool = artifacts.require('UniswapExchangeTool');
const UniswapPathFinder = artifacts.require('UniswapPathFinder');
const UniswapAutoExchangeTool = artifacts.require('UniswapAutoExchangeTool');
const ParamKeeper = artifacts.require('ParamKeeper');
const PancakeExchangeTool = artifacts.require('PancakeExchangeTool');
const PancakePathFinder = artifacts.require('PancakePathFinder');
const PancakeAutoExchangeTool = artifacts.require('PancakeAutoExchangeTool');

const UniswapRouter = artifacts.require("IUniswapV2Router02");
const IPancakeRouter01 = artifacts.require("IPancakeRouter01");



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
// const vendor = 'Ethereum';//BSC
const vendor = 'BSC';//BSC
 
module.exports = async function (deployer, network, accounts) {
  console.log('network =',network);
  let swapRouterAddress;
  //0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F
  
  if(network == 'rinkeby'){
    swapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  }else if(network == 'ropsten' || network == 'ropsten-fork'){
    swapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  }
  else if(network == 'test' || network =='mainnet'){
    swapRouterAddress = (vendor == 'Ethereum')? '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': '0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F';
  }

  console.log("swap router Address=",swapRouterAddress);

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


  // let priceFeeder;
  // await deployer.deploy(PriceFeederUpgradeable).then(function(){
  //   return UpgradeableBeacon.new(PriceFeederUpgradeable.address);
  // }).then(function (Beacon){
  //   console.log ("PriceFeederUpgradeable Beacon:", Beacon.address);
  //   return BeaconProxy.new(Beacon.address, web3.utils.hexToBytes('0x'));
  // }).then (function(BeaconProxy){
  //   return PriceFeederUpgradeable.at(BeaconProxy.address);
  // }).then(function (instance){
  //   priceFeeder = instance;
  // });
  // console.log ("PriceFeederUpgradeable Proxy Instance:", priceFeeder.address);


  //create paramKeeper
  let paramKeeper;

  await deployer.deploy(ParamKeeper).then(function(){
    console.log("ParamKeeper.address: ",ParamKeeper.address);
    return ParamKeeper.at(ParamKeeper.address);
  }).then(function (instance){
    paramKeeper = instance;
  });

  let uniswapRouter;
  let uniswapFactoryAddress;
  let wethTokenAddress;

  let valuationManager;
  let automaticExchangeManager;
  let swapTool;

  if(vendor == 'Ethereum'){
    uniswapRouter = await UniswapRouter.at(swapRouterAddress);
    uniswapFactoryAddress = await uniswapRouter.factory.call();
    wethTokenAddress = await uniswapRouter.WETH.call();
    //deploy and whitelist Uniswap tool

    await deployer.deploy(UniswapExchangeTool).then(function(){
      console.log("UniswapExchangeTool.address: ",UniswapExchangeTool.address);
      return UniswapExchangeTool.at(UniswapExchangeTool.address);
    }).then(function (instance){
      swapTool = instance;
    });

    await deployer.deploy(UniswapPathFinder).then(function(){
      console.log("UniswapPathFinder.address: ",UniswapPathFinder.address);
      return UniswapPathFinder.at(UniswapPathFinder.address);
    }).then(function (instance){
      valuationManager = instance;
    });

    await deployer.deploy(UniswapAutoExchangeTool,valuationManager.address).then(function(){
      console.log("UniswapAutoExchangeTool.address: ",UniswapAutoExchangeTool.address);
      return UniswapAutoExchangeTool.at(UniswapAutoExchangeTool.address);
    }).then(function (instance){
      automaticExchangeManager = instance;
    });
  }else if(vendor =='BSC'){
    uniswapRouter = await IPancakeRouter01.at(swapRouterAddress);
    uniswapFactoryAddress = await uniswapRouter.factory.call();
    wethTokenAddress = await uniswapRouter.WETH.call();

    await deployer.deploy(PancakePathFinder).then(function(){
      console.log("PancakePathFinder.address: ",PancakePathFinder.address);
      return PancakePathFinder.at(PancakePathFinder.address);
    }).then(function (instance){
      valuationManager = instance;
    });

    await deployer.deploy(PancakeAutoExchangeTool,valuationManager.address).then(function(){
      console.log("PancakeAutoExchangeTool.address: ",PancakeAutoExchangeTool.address);
      return PancakeAutoExchangeTool.at(PancakeAutoExchangeTool.address);
    }).then(function (instance){
      automaticExchangeManager = instance;
    });

    await deployer.deploy(PancakeExchangeTool).then(function(){
      console.log("PancakeExchangeTool.address: ",PancakeExchangeTool.address);
      return PancakeExchangeTool.at(PancakeExchangeTool.address);
    }).then(function (instance){
      swapTool = instance;
    });
  }

  await paramKeeper.setAssetAutomaticExchangeManager.sendTransaction(automaticExchangeManager.address);
  await paramKeeper.setAssetValuationManager.sendTransaction(valuationManager.address);

  await paramKeeper.setParamAddress.sendTransaction(toBN(1000), swapRouterAddress);
  await paramKeeper.setParamAddress.sendTransaction(toBN(1001), uniswapFactoryAddress);
  //insurance address
  await paramKeeper.setParamAddress.sendTransaction(toBN(101), accounts[8]);
  //dexe commission address
  await paramKeeper.setParamAddress.sendTransaction(toBN(102), accounts[8]);
  await paramKeeper.addAssetManager.sendTransaction(swapTool.address);

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