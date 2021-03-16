
const UniswapExchangeTool = artifacts.require("UniswapExchangeTool");
const TraderPoolFactoryUpgradeable = artifacts.require("TraderPoolFactoryUpgradeable");
const ParamKeeper = artifacts.require("ParamKeeper");
const TraderPoolUpgradeable = artifacts.require("TraderPoolUpgradeable");
const TestToken = artifacts.require("TestToken");
const IWETH = artifacts.require("IWETH");
const UniswapFactory = artifacts.require("IUniswapV2Factory");
const UniswapRouter = artifacts.require("IUniswapV2Router02");
const UniswapPathFinder = artifacts.require("UniswapPathFinder");
const { time, ether, expectRevert } = require('openzeppelin-test-helpers');
const BigDecimal = require('js-big-decimal');
const { assert } = require('chai');

function toBN(number) {
    return web3.utils.toBN(number);
}

const decimals = toBN('10').pow(toBN('18'));

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

contract('UniswapPathFinder', (accounts) => {



    const uniswapFactoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const uniTokenAddress = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984';
    const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    
    let mainAccount = accounts[0];

    let pathFinder;

    before(async () => {
        assert.isAtLeast(accounts.length, 10, 'User accounts must be at least 10');

        await UniswapPathFinder.new().then(instance => pathFinder = instance);

        await pathFinder.initialize.sendTransaction();

        
    });

    it('negative find direct path', async () => {
    
        let fromToken = uniswapFactoryAddress;
        let toToken = uniTokenAddress;
        let amount = toBN(10).mul(decimals);
        let result = await pathFinder.evaluate.call(fromToken,toToken,amount);
        console.log(result[0].toString());
        for(let i=0;i<result[1].length;i++){
            console.log("Path [",i,"] = ",result[1][i]);
        }
        assert.equal(result[0].toString(),"0","Non existent pair should result in 0 amt");

    });

    it('should find direct path', async () => {
    
        let fromToken = wethAddress;
        let toToken = uniTokenAddress;
        let amount = toBN(10).mul(decimals);
        let result = await pathFinder.evaluate.call(fromToken,toToken,amount);
        console.log(result[0].toString());
        for(let i=0;i<result[1].length;i++){
            console.log("Path [",i,"] = ",result[1][i]);
        }
        assert.equal(result[1].length,2,"direct path");
        assert.notEqual(result[0].toString(),"0","Existent pair should not result in 0 amt");

    });

    it('should find 3-leg path', async () => {
        const unnToken = '0x226f7b842e0f0120b7e194d05432b3fd14773a9d';
        const linkToken = '0x514910771AF9Ca656af840dff83E8264EcF986CA';
        const usdtToken = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        const usdcToken = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        const wbtcToken = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
        let fromToken = unnToken; 
        let toToken = linkToken;
        let amount = toBN(1000).mul(decimals);
        let result = await pathFinder.evaluate.call(fromToken,toToken,amount);
        console.log(result[0].toString());
        for(let i=0;i<result[1].length;i++){
            console.log("Path [",i,"] = ",result[1][i]);
        }
        assert.equal(result[1].length,3,"3-leg path");
        assert.notEqual(result[0].toString(),"0","Existent pair should not result in 0 amt");

    });

    it('should find 4-leg path', async () => {
        const unnToken = '0x226f7b842e0f0120b7e194d05432b3fd14773a9d';
        const linkToken = '0x514910771AF9Ca656af840dff83E8264EcF986CA';
        const usdtToken = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        const usdcToken = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        const wbtcToken = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
        const grtToken = '0xc944e90c64b2c07662a292be6244bdf05cda44a7';
        const busdToken = '0x4fabb145d64652a948d72533023f6e7a623c7c53';
        let fromToken = unnToken; 
        let toToken = busdToken;
        let amount = toBN(1000).mul(decimals);
        let result = await pathFinder.evaluate.call(fromToken,toToken,amount);
        console.log(result[0].toString());
        for(let i=0;i<result[1].length;i++){
            console.log("Path [",i,"] = ",result[1][i]);
        }
        assert.equal(result[1].length,4,"4-leg path");
        assert.notEqual(result[0].toString(),"0","Existent pair should not result in 0 amt");

    });

});
