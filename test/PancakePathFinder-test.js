
const UniswapExchangeTool = artifacts.require("UniswapExchangeTool");
const TraderPoolFactoryUpgradeable = artifacts.require("TraderPoolFactoryUpgradeable");
const ParamKeeper = artifacts.require("ParamKeeper");
const TraderPoolUpgradeable = artifacts.require("TraderPoolUpgradeable");
const TestToken = artifacts.require("TestToken");
const IWETH = artifacts.require("IWETH");
const UniswapFactory = artifacts.require("IUniswapV2Factory");
const UniswapRouter = artifacts.require("IUniswapV2Router02");
const PancakePathFinder = artifacts.require("PancakePathFinder");
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

contract('PancakePathFinder', (accounts) => {



    const uniswapFactoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    // const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const usdtTokenAddress = '0x55d398326f99059fF775485246999027B3197955';
    const wbnbAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    const busdAddress ='0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
    
    let mainAccount = accounts[0];

    let pathFinder;

    before(async () => {
        assert.isAtLeast(accounts.length, 10, 'User accounts must be at least 10');

        await PancakePathFinder.new().then(instance => pathFinder = instance);

        await pathFinder.initialize.sendTransaction();

        
    });

    it('negative find direct path', async () => {
    
        let fromToken = uniswapFactoryAddress;
        let toToken = usdtTokenAddress;
        let amount = toBN(10).mul(decimals);
        let result = await pathFinder.evaluate.call(fromToken,toToken,amount);
        console.log(result[0].toString());
        for(let i=0;i<result[1].length;i++){
            console.log("Path [",i,"] = ",result[1][i]);
        }
        assert.equal(result[0].toString(),"0","Non existent pair should result in 0 amt");

    });

    it('should find direct path', async () => {
    
        let fromToken = wbnbAddress;
        let toToken = busdAddress;
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
        const cakeToken = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82';
        const linkToken = '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd';
        const usdtToken = usdtTokenAddress;
        const usdcToken = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';
        const wbtcToken = '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c';
        let fromToken = cakeToken; 
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
        const cakeToken = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82';
        const linkToken = '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd';
        const usdtToken = usdtTokenAddress;
        const usdcToken = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';
        const wbtcToken = '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c';
        const dotToken = '0x7083609fce4d1d8dc0c979aab8c869ea2c873402';

        const busdToken = '0xe9e7cea3dedca5984780bafc599bd69add087d56';
        let fromToken = cakeToken; 
        let toToken = dotToken;
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
