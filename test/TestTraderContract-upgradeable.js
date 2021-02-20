
const ExchangePositionManager = artifacts.require("ExchangePositionManager");
const TraderPoolFactoryUpgradeable = artifacts.require("TraderPoolFactoryUpgradeable");
const ParamKeeper = artifacts.require("ParamKeeper");
const TraderPoolUpgradeable = artifacts.require("TraderPoolUpgradeable");
const TestToken = artifacts.require("TestToken");
const IWETH = artifacts.require("IWETH");
const UniswapFactory = artifacts.require("IUniswapV2Factory");
const UniswapRouter = artifacts.require("IUniswapV2Router02");
const { time, ether, expectRevert } = require('openzeppelin-test-helpers');
const BigDecimal = require('js-big-decimal');
const { assert } = require('chai');

function toBN(number) {
    return web3.utils.toBN(number);
}

const decimals = toBN('10').pow(toBN('18'));

contract('TraderPool', (accounts) => {

    // const uniswapFactoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    // const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    // const uniTokenAddress = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984';
    // const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    
    let mainAccount = accounts[0];

    let uniswapFactory;
    let uniswapRouter;
    let basicToken;
    let anotherToken;
    let WEthAddress;
    let TraderToken;
    let traderpool;
    let traderpoolETH;
    let pairAddress;
    let TraderLPT;
    let traderpoolETHLPT;
    let exchangePositionManager;
    let uniswapPositionManager;

    let traderTemplateContact;
    let traderPoolFactory;
    let paramKeeper;

    let traderWallet;
    let wethAddress;
    let uniswapFactoryAddress;
    let uniswapRouterAddress;

    before(async () => {
        assert.isAtLeast(accounts.length, 10, 'User accounts must be at least 10');
        traderWallet = accounts[9];

        await TestToken.new('Test USDT', 'USDT', {from: accounts[0]}).then(instance => basicToken = instance);
        await TestToken.new('Test DAI', 'DAI', {from: accounts[0]}).then(instance => anotherToken = instance);


        paramKeeper = await ParamKeeper.deployed();
        console.log("paramKeeper ",paramKeeper.address);


        uniswapRouterAddress = await paramKeeper.getAddress.call(toBN(1000));
        uniswapFactoryAddress = await paramKeeper.getAddress.call(toBN(1001));

        uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress);
        uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);
        wethAddress = await uniswapRouter.WETH.call();

        //global whitelist
        await paramKeeper.whitelistToken.sendTransaction(anotherToken.address);

        let traderPoolFactoryAddress = await paramKeeper.getAddress.call(toBN(1));
        traderPoolFactory = await TraderPoolFactoryUpgradeable.at(traderPoolFactoryAddress);

        // deploy trader pool for testing with basicToken
        let createResult = await traderPoolFactory.createTraderContract(traderWallet, basicToken.address, toBN(0),toBN(3), toBN(10), true,"Trader token 1","TRT1");
        console.log("createResult.logs.length = ",createResult.logs.length);
        for(var i=0;i<createResult.logs.length;i++){
            console.log("createResult.logs[",i,"].length = ",createResult.logs[i].args.length, " ", createResult.logs[i].args.toString());
            console.log("response.logs[index].event = ",createResult.logs[i].event);
            for(var j=0;j<createResult.logs[i].args.length;j++){
                console.log(">",i,">",j," ",createResult.logs[i].args[j].toString());
            }
        }
        let contract3Address = createResult.logs[2].args[0];
        console.log("TraderPool deployed at ", contract3Address, "Gas consumed", createResult.receipt.gasUsed.toString());

        traderpool = await TraderPoolUpgradeable.at(contract3Address);
        TraderLPT = await traderpool.plt.call().then(result => TestToken.at(result));

        console.log("wethAddres = ",wethAddress);

        //deploy WETH based traderpool    
        let createResult2 = await traderPoolFactory.createTraderContract(traderWallet, wethAddress, toBN(0),toBN(3), toBN(10), true,"Trader token 2","TRT2");

        let contractETHAddress = createResult2.logs[2].args[0];
        console.log("TraderPool deployed at ", contractETHAddress, "Gas consumed", createResult2.receipt.gasUsed.toString());

        traderpoolETH = await TraderPoolUpgradeable.at(contractETHAddress);
        traderpoolETHLPT = await traderpoolETH.plt.call().then(result => TestToken.at(result));  
        //deploy uniswap pair for testing
        // uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress);
        // uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);

        await uniswapFactory.createPair.sendTransaction(anotherToken.address, basicToken.address)
            .then(() => uniswapFactory.getPair(basicToken.address, anotherToken.address))
            .then(pair => pairAddress = pair);

        
    });

    it('should setup paramKeeper', async () => {
        // await paramKeeper.setParamAddress.sendTransaction(toBN(1000), uniswapRouterAddress);
        // await paramKeeper.setParamAddress.sendTransaction(toBN(1001), uniswapFactoryAddress);
    
        });

    it('should deposit using Ethereum native coin', async () => {
        let account1 = accounts[1];
        let account2 = accounts[2];
        let ethLiqAmount = ether('10');

        let balance1Before = await web3.eth.getBalance(account1);
        let balance2Before = await web3.eth.getBalance(account2);
        console.log("BEFORE:",balance1Before,balance2Before,ethLiqAmount.toString());
        let lptBalance1before = await traderpoolETHLPT.balanceOf.call(account1);
        let lptBalance2before = await traderpoolETHLPT.balanceOf.call(account2);
        console.log("Balances LP: ",lptBalance1before.toString(), lptBalance2before.toString());
        await traderpoolETH.send(ethLiqAmount, {from: account1});
        await traderpoolETH.depositETHTo.sendTransaction(account2, {from: account1, value: ethLiqAmount});
        let balance1After = await web3.eth.getBalance(account1);
        let balance2After = await web3.eth.getBalance(account2);

        assert.equal(toBN(balance1After).lt(toBN(balance1Before).sub(ethLiqAmount).sub(ethLiqAmount)), true);
        assert.equal(balance2After.toString(), balance1Before.toString());

        let lptBalance1 = await traderpoolETHLPT.balanceOf.call(account1);
        let lptBalance2 = await traderpoolETHLPT.balanceOf.call(account2);
        console.log("Balances: ",lptBalance1.toString(), lptBalance2.toString());

        assert.equal(ethLiqAmount.toString(), lptBalance1.toString());
        assert.equal(ethLiqAmount.toString(), lptBalance2.toString());

        // await TraderEth.withdraw.sendTransaction( {from: account1});

    });

    it('should withdraw using Ethereum native coin', async () => {
        let account1 = accounts[1];
        let account2 = accounts[2];

        let wethContract = await IWETH.at(wethAddress);

        let balance1Before = await web3.eth.getBalance(account1);
        let lptBalance1Before = await traderpoolETHLPT.balanceOf.call(account1);
        let balanceWithdrawn = lptBalance1Before.div(toBN(2));

        let weth = await TestToken.at(wethAddress);

        console.log("weth contract balance = ",(await weth.balanceOf.call(traderpoolETH.address)).toString()," required",balanceWithdrawn.toString());

        await traderpoolETHLPT.approve.sendTransaction(traderpoolETH.address,balanceWithdrawn,{from: account1});
        await traderpoolETH.withdrawETH.sendTransaction(balanceWithdrawn, {from: account1});

        //convert WETH to ETH
        await wethContract.withdraw.sendTransaction(balanceWithdrawn, {from: account1});
        
        let balance1After = await web3.eth.getBalance(account1);
        // let balance1After = await wethToken.balanceOf.call(account1);
        let lptBalance1After = await traderpoolETHLPT.balanceOf.call(account1);
        console.log("Balances ETH: Before",balance1Before.toString(), " after ",balance1After.toString());

        assert.equal(lptBalance1After.toString(), lptBalance1Before.sub(balanceWithdrawn).toString());
        assert.equal(toBN(balance1After).gte(toBN(balance1Before).add(balanceWithdrawn).sub(ether('0.01'))), true);

    });

    it('should init Uniswap pool for basicToken/anotherToken', async () => {
        let basicTokenAmount = toBN('36076072').mul(decimals);//USDT
        let anotherTokenAmount = toBN('99660').mul(decimals);//ETH
        await basicToken.approve.sendTransaction(uniswapRouterAddress, basicTokenAmount);
        await anotherToken.approve.sendTransaction(uniswapRouterAddress, anotherTokenAmount);
        await uniswapRouter.addLiquidity.sendTransaction(
            basicToken.address, anotherToken.address,
            basicTokenAmount, anotherTokenAmount,
            basicTokenAmount, anotherTokenAmount,
            accounts[0],
            new Date().getTime() + (2 * 24 * 60 * 60 * 1000)
        );
        let basicTokenBalance = await basicToken.balanceOf.call(pairAddress);
        let anotherTokenBalance = await anotherToken.balanceOf.call(pairAddress);

        //init test balances
        for(let i=1;i<accounts.length;i++){
            let account = accounts[i];
            await basicToken.transfer.sendTransaction(account, toBN('3610000').mul(decimals));
            await anotherToken.transfer.sendTransaction(account, toBN('10000').mul(decimals));
        }


        assert.equal(basicTokenBalance.toString(), basicTokenAmount, 'Router must have balance equal to liquidity');
        assert.equal(anotherTokenBalance.toString(), anotherTokenAmount, 'Router must have balance equal to liquidity');
    });

    it('should add deposit to Trader', async () => {
        let basicLiqAmount = toBN('20000').mul(decimals);
        let lptBalance0 = await TraderLPT.balanceOf.call(mainAccount);
        await basicToken.approve.sendTransaction(traderpool.address, basicLiqAmount);
        await traderpool.depositTo.sendTransaction(basicLiqAmount, mainAccount);
        let lptBalance1 = (await TraderLPT.balanceOf.call(mainAccount)).sub(lptBalance0);

        await basicToken.approve.sendTransaction(traderpool.address, basicLiqAmount);
        await traderpool.depositTo.sendTransaction(basicLiqAmount, mainAccount);
        let lptBalance2 = (await TraderLPT.balanceOf.call(mainAccount)).sub(lptBalance1);

        assert.equal(basicLiqAmount.toString(), lptBalance1.toString());
        assert.equal(basicLiqAmount.toString(), lptBalance2.toString());

        let basicTokenTraderBefore = await basicToken.balanceOf.call(traderpool.address);
        console.log("Trader balance in BaseToken",basicTokenTraderBefore.toString());
    });

    it('should withdraw deposit from Trader', async () => {
        let lptBalance = await TraderLPT.balanceOf.call(mainAccount);
        let basicTokenBalanceBefore = await basicToken.balanceOf.call(mainAccount);
        let lptToWithdraw = lptBalance.div(toBN('2'));
        await TraderLPT.approve.sendTransaction(traderpool.address, lptToWithdraw, {from: mainAccount});
        await traderpool.withdrawTo.sendTransaction(lptToWithdraw, mainAccount);
        let basicTokenBalanceAfter = await basicToken.balanceOf.call(mainAccount);

        assert(basicTokenBalanceAfter.gt(basicTokenBalanceBefore), `New balance must be greated than before, Current: ${basicTokenBalanceAfter.toString()}, Previous: ${basicTokenBalanceBefore.toString()}`);

        let basicTokenTraderBefore = await basicToken.balanceOf.call(traderpool.address);
        console.log("Trader balance in BaseToken",basicTokenTraderBefore.toString());
        // var res = await traderpool.getUserOperationsStat.call(mainAccount);
        // console.log("User stat", res[0].toString(), res[1].toString(), res[2].toString());
    });

    it('should revert on sending funds to payable function', async () => {
        let account1 = accounts[1];
        let ethLiqAmount = ether('10');
        await expectRevert(
            traderpool.send(ethLiqAmount, {from: account1}),
            'revert'
        );
    });

    it('should open position (buy anotherToken)', async () => {

        //----------------------   

        let beforeBalance = await basicToken.balanceOf.call(traderpool.address);
        let basicLiqAmount = toBN('10000').mul(decimals);
        let reserveBBefore = await basicToken.balanceOf.call(pairAddress); 
        let reserveABefore = await anotherToken.balanceOf.call(pairAddress); 

        console.log("Pair Balance Before ",(reserveABefore).div(decimals).toString(),(reserveBBefore).div(decimals).toString());
        console.log("Trader pool balance in basic token:",beforeBalance.div(decimals).toString());

        let deadline=new Date().getTime() + ( 20 * 60 * 1000);
        let positionsLength = await traderpool.positionsLength.call();
        console.log("Positions.length", positionsLength.toString());
        assert.equal(positionsLength.toString(),toBN(0).toString(),"to positions before opening");


        let result = await traderpool.openPosition.sendTransaction(
            toBN(0),
            toBN(1),
            anotherToken.address,
            basicLiqAmount,
            new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
            {from: traderWallet}
        );
        
        console.log(`openPosition GasUsed: ${result.receipt.gasUsed} deadline = ${deadline}`);    

        let reserveBAfter = await basicToken.balanceOf.call(pairAddress);
        let reserveAAfter = await anotherToken.balanceOf.call(pairAddress);
        console.log("Pair Balance increase: ",(reserveAAfter.sub(reserveABefore)).toString(),(reserveBAfter.sub(reserveBBefore)).toString()); 
        console.log("Abs K=",(reserveAAfter.sub(reserveABefore)).mul(reserveBAfter.sub(reserveBBefore)).toString());    


        var logIndex=-1;

        //event PositionOpened(uint16 index, uint8 manager, address token, uint256 amountOpened, uint256 liquidity);
        let index= result.logs[++logIndex].args[0];
        let manager= result.logs[logIndex].args[1];
        let token= result.logs[logIndex].args[2];
        let amountOpened= result.logs[logIndex].args[3];
        let liquidity= result.logs[logIndex].args[4];
        console.log('POpened ',index.toString(),manager.toString(),token.toString(),amountOpened.div(decimals).toString(),liquidity.div(decimals).toString());

        let afterBalance = await basicToken.balanceOf.call(traderpool.address);
        console.log('afterBalance ',afterBalance.toString());

        // let openDifference = basicLiqAmount.sub(amountOpened);
        // console.log("openDIfference",openDifference.toString());
        // assert.equal(openDifference.lte(toBN(300)), true, "Difference to be small");

        // let basicTokenDifference=afterBalance.add(basicLiqAmount.div(toBN(2))).sub(beforeBalance);
        // console.log("basicTokenDifference",basicTokenDifference.toString());
        // assert.equal(basicTokenDifference.lte(toBN(200)), true, "beforeBalance-afterBalance-basicLiqAmount/2 == 0 ");

        console.log("Retreiving position...");
        // check reader method
        let positiondata = await traderpool.positionAt.call(index);
        let managerView = positiondata[0];
        let amountOpenedView = positiondata[1];
        let liquidityView = positiondata[2];
        let tokenView = positiondata[3];
        console.log("view data",managerView.toString(), amountOpenedView.toString(),liquidityView.toString(),tokenView.toString() );

        assert.equal(managerView.toString(),toBN(0).toString(),"manager index to be correct");
        assert.equal(amountOpenedView.toString(), amountOpened.toString()," amount opened to be correctly set");
        assert.equal(liquidityView.toString(), liquidity.toString()," liquidity to be correctly set");
        assert.equal(tokenView.toString(), anotherToken.address.toString()," token address to be correctly set");

        let basicTokenTraderBefore = await basicToken.balanceOf.call(traderpool.address);
        console.log("Trader balance in BaseToken after operation",basicTokenTraderBefore.toString());

        let portfolioCap = await traderpool.portfolioCap.call();
        console.log("portfolioCap = ",portfolioCap.toString());
    });

    it('should close position partially with a loss', async () => {
        let positionIndex=toBN(0);


        let positiondata = await traderpool.positionAt.call(positionIndex);
        let managerView = positiondata[0];
        let amountOpenedView = positiondata[1];
        let liquidityView = positiondata[2];
        let tokenView = positiondata[3];
        
        let percentClosed = toBN(50);//50%

        let liquidityClosed = liquidityView.mul(percentClosed).div(toBN(100));
        let liquidityRemaining = liquidityView.sub(liquidityClosed);

        let totalCapBefore = await traderpool.totalCap.call();
        let basicTokenBalanceBefore = await basicToken.balanceOf.call(traderpool.address);

        console.log("Liquidity: ",liquidityClosed.toString(), "out of",liquidityView.toString());

        let result = await traderpool.exitPosition.sendTransaction(
            positionIndex,
            liquidityClosed,
            new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
            {from: traderWallet}
        );

        var logIndex=-1;

        //event PositionClosed(uint16 index, uint8 manager, address token, uint256 amountClosed, uint256 liquidity, bool isProfit, uint256 finResB);
        let index= result.logs[++logIndex].args[0];
        let manager= result.logs[logIndex].args[1];
        let token= result.logs[logIndex].args[2];
        let amountClosed= result.logs[logIndex].args[3];
        let liquidity= result.logs[logIndex].args[4];
        let isProfit= result.logs[logIndex].args[5];
        let finResB= result.logs[logIndex].args[6];

        console.log('PClosed ',index.toString(),manager.toString(),token.toString(),amountClosed.div(decimals).toString(),liquidity.toString(),isProfit.toString(),finResB.div(decimals).toString());
        
        let basicTokenBalanceAfter = await basicToken.balanceOf.call(traderpool.address);
        let totalCapAfter = await traderpool.totalCap.call();
        //balance checks
        assert.equal(basicTokenBalanceAfter.toString(),basicTokenBalanceBefore.add(amountClosed).toString(),"contract to receive closed tokens" );
        assert.equal(isProfit,false,"Loss detected");
        assert.equal(totalCapAfter.toString(), totalCapBefore.sub(finResB).toString(), "remaining totalCap to be correct");

        //check remaining amounts on position record
        let positiondataafter = await traderpool.positionAt.call(positionIndex);
        let managerViewAfter = positiondataafter[0];
        let amountOpenedViewAfter = positiondataafter[1];
        let liquidityViewAfter = positiondataafter[2];
        let tokenViewAfter = positiondataafter[3];
        assert.equal(liquidityViewAfter.toString(), liquidityRemaining.toString(), "remaining liquidity in Position record to be correct");
        //assert.equal(amountOpenedViewAfter.toString(), amountOpenedView.mul(percentClosed).div(toBN(100)).toString(), "remaining amountOpened in Position record to be correct");    
        
        
        // console.log('LiquidityTokens amount=',ltBalance.toString());

        // assert.notEqual(ltBalance.toString(), '0', 'Balance of pool\'s liquidity token must not be zero');
    });

    it('Should be able to add to Open Position when deposited', async () => {
        let positiondataBefore = await traderpool.positionAt.call(toBN(0));
        let managerViewBefore = positiondataBefore[0];
        let amountOpenedViewBefore = positiondataBefore[1];
        let liquidityViewBefore = positiondataBefore[2];
        let tokenViewBefore = positiondataBefore[3];

        console.log("OpenedAmtBefore",amountOpenedViewBefore.toString());

        let depostiAmt = toBN('10000').mul(decimals);
        //deposit
        await basicToken.approve.sendTransaction(traderpool.address, depostiAmt);
        await traderpool.depositTo.sendTransaction(depostiAmt, mainAccount);
        //check Position Data
        let positiondataAfter = await traderpool.positionAt.call(toBN(0));
        let managerViewAfter = positiondataAfter[0];
        let amountOpenedViewAfter = positiondataAfter[1];
        let liquidityViewAfter = positiondataAfter[2];
        let tokenViewAfter = positiondataAfter[3];
        console.log("amountOpenedViewAfter",amountOpenedViewAfter.toString());

        assert.equal(amountOpenedViewAfter.sub(amountOpenedViewBefore).toString(),depostiAmt.toString(),"Actual position to consume all deposited tokens");

    });

    // it('should swap tokens back and forth many times', async () => {
    //     //target is 50M of funds turn around. need 80 operations like this.
    //     let basicTokenSwapAmount = toBN('381000').mul(decimals);
    //     let anotherTokenSwapAmount = toBN('1000').mul(decimals);

    //     //assume all accounts already has test balances in tokens
    //     let max=10;

    //     for (let i = 1; i < max; i++) {
    //         let account = accounts[i%accounts.length];
            

    //         await basicToken.approve.sendTransaction(uniswapRouter.address, basicTokenSwapAmount, {from: account});

    //         await uniswapRouter.swapExactTokensForTokens(
    //             basicTokenSwapAmount, '0',
    //             [basicToken.address, anotherToken.address],
    //             account,
    //             new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
    //             {from: account}
    //         );

    //         await anotherToken.approve.sendTransaction(uniswapRouter.address, anotherTokenSwapAmount, {from: account});

    //         await uniswapRouter.swapExactTokensForTokens(
    //             anotherTokenSwapAmount, '0',
    //             [anotherToken.address, basicToken.address],
    //             account,
    //             new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
    //             {from: account}
    //         );

    //         let balanceA = await anotherToken.balanceOf.call(account);
    //         let balanceB = await basicToken.balanceOf.call(account);
    //         console.log(i,' After swap balance: ',balanceA.toString(),', ',balanceB.toString());
    //     }

    // });

    // it('should close position in full with a profit', async () => {
    //     let basicTokenTraderBefore = await basicToken.balanceOf.call(traderpool.address);
    //     console.log("Trader balance BEFORE in BaseToken",basicTokenTraderBefore.toString());

    //     let positiondata = await traderpool.positionAt.call(toBN(1));
    //     let managerView = positiondata[0];
    //     let amountOpenedView = positiondata[1];
    //     let liquidityView = positiondata[2];
    //     let tokenView = positiondata[3];
        
    //     let percentClosed = toBN(100);//100%

    //     let liquidityClosed = liquidityView.mul(percentClosed).div(toBN(100));
    //     let liquidityRemaining = liquidityView.sub(liquidityClosed);

    //     let totalCapBefore = await traderpool.totalCap.call();
    //     let basicTokenBalanceBefore = await basicToken.balanceOf.call(traderpool.address);
    //     let ltBalanceBefore = await TestToken.at(pairAddress).then(instance => instance.balanceOf.call(traderpool.address));

    //     console.log("Liquidity: ",liquidityClosed.toString(), "out of",liquidityView.toString(), "balanceBefore",ltBalanceBefore.toString());

    //     let reserveBBefore = await basicToken.balanceOf.call(pairAddress); 
    //     let reserveABefore = await anotherToken.balanceOf.call(pairAddress); 

    //     console.log("Pair Balance Before ",(reserveABefore).div(decimals).toString(),(reserveBBefore).div(decimals).toString());


    //     let result = await traderpool.closePosition.sendTransaction(
    //         toBN(1), liquidityClosed,
    //         new Date().getTime() + (2 * 24 * 60 * 60 * 1000)
    //     );

    //     let reserveBAfter = await basicToken.balanceOf.call(pairAddress);
    //     let reserveAAfter = await anotherToken.balanceOf.call(pairAddress);

    //     console.log("Pair Balance decrease: ",(reserveABefore.sub(reserveAAfter)).toString(),(reserveBBefore.sub(reserveBAfter)).toString()); 
    //     console.log("Abs K=",(reserveABefore.sub(reserveAAfter)).mul(reserveBBefore.sub(reserveBAfter)).toString());    


    //     var logIndex=-1;

    //     //event PositionClosed(uint16 index, uint8 manager, address token, uint256 amountClosed, uint256 liquidity, bool isProfit, uint256 finResB);
    //     let index= result.logs[++logIndex].args[0];
    //     let manager= result.logs[logIndex].args[1];
    //     let token= result.logs[logIndex].args[2];
    //     let amountClosed= result.logs[logIndex].args[3];
    //     let liquidity= result.logs[logIndex].args[4];
    //     let isProfit= result.logs[logIndex].args[5];
    //     let finResB= result.logs[logIndex].args[6];

    //     console.log('PClosed ',index.toString(),manager.toString(),token.toString(),amountClosed.div(decimals).toString(),liquidity.toString(),isProfit.toString(),finResB.div(decimals).toString());
        
    //     let basicTokenBalanceAfter = await basicToken.balanceOf.call(traderpool.address);
    //     let ltBalanceAfter = await TestToken.at(pairAddress).then(instance => instance.balanceOf.call(traderpool.address));
    //     let totalCapAfter = await traderpool.totalCap.call();
    //     //balance checks
    //     assert.equal(ltBalanceAfter.toString(), liquidityRemaining.toString(), "remaining liquidity balance to be correct");
    //     assert.equal(basicTokenBalanceAfter.toString(),basicTokenBalanceBefore.add(amountClosed).toString(),"contract to receive closed tokens" );
    //     assert.equal(isProfit,true,"Profit detected");

    //     assert.equal(totalCapAfter.sub(totalCapBefore.add(finResB.mul(toBN(8)).div(toBN(10)))).lte(toBN(10)),true, "remaining totalCap to be correct");

    //     // let externalCommissionAfter = await traderpool.externalCommissionBalance.call();
    //     // assert.equal(externalCommissionAfter.sub(finResB.mul(toBN(3)).div(toBN(10))).lte(toBN(10)),true, "externalCommissionAfter to be correct");



    //     //check remaining amounts on position record
    //     let positiondataafter = await traderpool.positionAt.call(toBN(1));
    //     let managerViewAfter = positiondataafter[0];
    //     let amountOpenedViewAfter = positiondataafter[1];
    //     let liquidityViewAfter = positiondataafter[2];
    //     let tokenViewAfter = positiondataafter[3];
    //     assert.equal(liquidityViewAfter.toString(), liquidityRemaining.toString(), "remaining liquidity in Position record to be correct");
    //     assert.equal(amountOpenedViewAfter.toString(), toBN(0).toString(), "remaining amountOpened in Position record to be correct");    
        
    //     let basicTokenTraderAfter= await basicToken.balanceOf.call(traderpool.address);
    //     console.log("Trader balance AFTER in BaseToken",basicTokenTraderAfter.toString());
    //     // console.log('LiquidityTokens amount=',ltBalance.toString());

    //     // assert.notEqual(ltBalance.toString(), '0', 'Balance of pool\'s liquidity token must not be zero');
    // });

    // it('should withdraw external commission', async () => {
    //     let basicTokenBalanceBefore = await basicToken.balanceOf.call(traderpool.address);
    //     let basicTokenBalanceBeforeTarget = await basicToken.balanceOf.call(mainAccount);
    //     // let dexeCommissionBalance = await traderpool.dexeCommissionBalance.call();

    //     // await traderpool.withdrawCommission.sendTransaction(dexeCommissionBalance);

    //     let traderCommissionBalance = await traderpool.traderCommissionBalance.call();

    //     await traderpool.withdrawCommission.sendTransaction(traderCommissionBalance);

    //     let basicTokenBalanceAfter = await basicToken.balanceOf.call(traderpool.address);
    //     let basicTokenBalanceAfterTarget = await basicToken.balanceOf.call(mainAccount);

    //     // assert.equal(basicTokenBalanceAfterTarget.sub(basicTokenBalanceBeforeTarget).toString(),externalCommission.toString(),"Amount of tokens received to be correct");
    //     // assert.equal(basicTokenBalanceBefore.sub(basicTokenBalanceAfter).toString(),externalCommission.toString(),"Amount of tokens withdraen to be correct");

    //     let basicTokenTraderBefore = await basicToken.balanceOf.call(traderpool.address);
    //     console.log("Trader balance in BaseToken",basicTokenTraderBefore.toString());
    // });

    // it('should withdraw deposit from Trader', async () => {
    //     let lptBalance = await TraderLPT.balanceOf.call(mainAccount);
    //     let basicTokenBalanceBefore = await basicToken.balanceOf.call(mainAccount);
    //     let basicTokenTraderBefore = await basicToken.balanceOf.call(traderpool.address);
    //     let anotherTokenTraderBefore = await anotherToken.balanceOf.call(traderpool.address);
    //     let totalCap = await traderpool.totalCap.call();
    //     let totalSupply = await TraderLPT.totalSupply.call();

    //     console.log("basicTokenTraderBefore",basicTokenTraderBefore.toString());
    //     console.log("anotherTokenTraderBefore",anotherTokenTraderBefore.toString());
    //     console.log("lptBalance",lptBalance.toString());
    //     console.log("totalCap",totalCap.toString());
    //     console.log("totalSupply",totalSupply.toString());

    //     if(anotherTokenTraderBefore.gt(toBN(1))){
    //         await traderpool.exitPosition.sendTransaction(toBN(1),anotherTokenTraderBefore, new Date().getTime() + (2 * 24 * 60 * 60 * 1000));

    //         let basicTokenTraderBefore2 = await basicToken.balanceOf.call(traderpool.address);
    //         let anotherTokenTraderBefore2 = await anotherToken.balanceOf.call(traderpool.address);
    //         let totalCap2 = await traderpool.totalCap.call();
    //         console.log("basicTokenTraderBefore2",basicTokenTraderBefore2.toString());
    //         console.log("anotherTokenTraderBefore2",anotherTokenTraderBefore2.toString());
    //         console.log("totalCap2",totalCap2.toString());
    //     }

    //     let lptToWithdraw = lptBalance.div(toBN('2'));
    //     await TraderLPT.approve.sendTransaction(traderpool.address, lptToWithdraw, {from: mainAccount});
    //     await traderpool.withdrawTo.sendTransaction(lptToWithdraw, mainAccount);
    //     let basicTokenBalanceAfter = await basicToken.balanceOf.call(mainAccount);
    //     console.log("withdrawn: ",basicTokenBalanceAfter.sub(basicTokenBalanceBefore).toString());

    //     assert(basicTokenBalanceAfter.gt(basicTokenBalanceBefore), `New balance must be greated than before, Current: ${basicTokenBalanceAfter.toString()}, Previous: ${basicTokenBalanceBefore.toString()}`);

    //     var res = await traderpool.getUserData.call(mainAccount);
    //     console.log("User stat", res[0].toString(), res[1].toString(), res[2].toString());

    //     var res = await traderpool.getTotalValueLocked.call();
    //     console.log("Contract stat", res[0].toString(), res[1].toString());

    //     let contractTokens = await basicToken.balanceOf.call(traderpool.address);
    //     console.log("Contract tokens",contractTokens.toString());
    //     //adjust totalCap
    //     await traderpool.adjustTotalCap.sendTransaction();
    //     var res2 = await traderpool.getTotalValueLocked.call();
    //     console.log("Contract stat after adjustment", res2[0].toString(), res2[1].toString());

    //     let contractTokens2 = await basicToken.balanceOf.call(traderpool.address);
    //     console.log("Contract tokens",contractTokens2.toString());
    // });

    //********************************************* */

    // it('should return liquidity back and calculate profit', async () => {
    //     let basicTokenAmount = toBN('10000').mul(decimals);
    //     let ltBalance = await TestToken.at(pairAddress).then(instance => instance.balanceOf.call(traderpool.address));

    //     let basicTokenBalanceBefore = await basicToken.balanceOf.call(traderpool.address);
    //     let anotherTokenBalanceBefore = await anotherToken.balanceOf.call(traderpool.address);
    //     let totalCapBefore = await traderpool.totalCap.call();
        
    //     // let liquidity = ltBalance;
    //     let liquidity = ltBalance.div(toBN('2'));


    //     let result = await traderpool.removeLiquidity.sendTransaction(liquidity,
    //         basicToken.address, anotherToken.address,
    //         '0', '0',
    //         new Date().getTime() + (2 * 24 * 60 * 60 * 1000)
    //     );

    //     var logIndex=-1;

    //     // let ppair= result.logs[++logIndex].args[0];
    //     // let pamtA= result.logs[logIndex].args[1];
    //     // let pamtB= result.logs[logIndex].args[2];
    //     // console.log('before pamtA=',pamtA.toString(),'pamtB=',pamtB.toString());

    //     // let pair= result.logs[++logIndex].args[0];
    //     // let amtA= result.logs[logIndex].args[1];
    //     // let amtB= result.logs[logIndex].args[2];
    //     // console.log('after amtA=',amtA.toString(),'amtB=',amtB.toString());


    //     let fBt=result.logs[++logIndex].args[0];
    //     let fBv=result.logs[logIndex].args[1];
    //     console.log('fin res B ',fBt,fBv.toString());
    //     let fAt=result.logs[++logIndex].args[0];
    //     let fAv=result.logs[logIndex].args[1];
    //     console.log('fin res A ',fAt,fAv.toString());

    //     let fTt=result.logs[++logIndex].args[0];
    //     let fTv=result.logs[logIndex].args[1];
    //     console.log('fin res T ',fTt,fTv.toString());

    //     let totalCapAfter = await traderpool.totalCap.call();
    //     console.log('totalCapBefor=',totalCapBefore.toString());
    //     console.log('totalCapAfter=',totalCapAfter.toString());

    //     let ltBalanceAfter = await TestToken.at(pairAddress).then(instance => instance.balanceOf.call(traderpool.address));
    //     console.log('ltBalanceAfter',ltBalanceAfter.toString());

    //     let basicTokenBalanceAfter = await basicToken.balanceOf.call(traderpool.address);
    //     let anotherTokenBalanceAfter = await anotherToken.balanceOf.call(traderpool.address);
        
    //     assert(totalCapAfter.gt(totalCapBefore),'TotalCap should grow');

    //     assert.notEqual(ltBalanceAfter.toString(), ltBalance.toString());
    //     // assert(basicTokenBalanceAfter.gt(basicTokenBalanceBefore));
    //     // assert(anotherTokenBalanceAfter.gt(anotherTokenBalanceBefore));
    //     // assert.notEqual(totalCapAfter.toString(), '0', 'Total capacity must not be zero');
    //     // assert.notEqual(totalCapAfter.toString(), basicTokenAmount.toString(), 'Total capacity must not be equal to liquidity amount');
    // });

    // it('should push liquidity with increased price', async () => {
    //     let account = accounts[2];
    //     let basicTokenAmount = toBN('10000').mul(decimals);
    //     let lptTotalSupply = await TraderLPT.totalSupply.call();
    //     let totalCap = await traderpool.totalCap.call();
    //     await basicToken.transfer.sendTransaction(account, basicTokenAmount);
    //     let lptBalance = await TraderLPT.balanceOf.call(account);
        
    //     await basicToken.approve.sendTransaction(traderpool.address, basicTokenAmount, {from: account});
    //     await traderpool.depositTo(basicTokenAmount, account, {from: account});

    //     let lptBalanceAfter = await TraderLPT.balanceOf.call(account);

    //     console.log(totalCap.toString(), ', ', lptTotalSupply.toString());

        
    //     console.log(lptBalance.add(basicTokenAmount).toString(), ' ==> ', lptBalanceAfter.toString());
    //     assert(lptBalanceAfter.lt(lptBalance.add(basicTokenAmount)));
    // });

 

});
