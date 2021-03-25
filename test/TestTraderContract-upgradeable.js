
const UniswapExchangeTool = artifacts.require("UniswapExchangeTool");
const PancakeExchangeTool = artifacts.require("PancakeExchangeTool");
const TraderPoolFactoryUpgradeable = artifacts.require("TraderPoolFactoryUpgradeable");
const ParamKeeper = artifacts.require("ParamKeeper");
const TraderPoolUpgradeable = artifacts.require("TraderPoolUpgradeable");
const TestToken = artifacts.require("TestToken");
const IWETH = artifacts.require("IWETH");
const UniswapFactory = artifacts.require("IUniswapV2Factory");
const UniswapRouter = artifacts.require("IUniswapV2Router02");
const IPancakeRouter01 = artifacts.require("IPancakeRouter01");
const IPancakeFactory = artifacts.require("IPancakeFactory");
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
    let uniswapExhangeTool;


    // const vendor = 'Ethereum';//BSC
    const vendor = 'BSC';//BSC
    before(async () => {
        assert.isAtLeast(accounts.length, 10, 'User accounts must be at least 10');
        traderWallet = accounts[9];

        await TestToken.new('Test USDT', 'USDT', {from: accounts[0]}).then(instance => basicToken = instance);
        await TestToken.new('Test DAI', 'DAI', {from: accounts[0]}).then(instance => anotherToken = instance);

        paramKeeper = await ParamKeeper.deployed();
        console.log("paramKeeper ",paramKeeper.address);
        uniswapRouterAddress = await paramKeeper.getAddress.call(toBN(1000));
        // uniswapFactoryAddress = await paramKeeper.getAddress.call(toBN(1001));

        if(vendor == 'Ethereum'){
            uniswapExhangeTool = await UniswapExchangeTool.deployed();
            
            uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);
            uniswapFactoryAddress = await uniswapRouter.factory.call();
            uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress);
            wethAddress = await uniswapRouter.WETH.call();

            await uniswapFactory.createPair.sendTransaction(anotherToken.address, basicToken.address)
            .then(() => uniswapFactory.getPair(basicToken.address, anotherToken.address))
            .then(pair => pairAddress = pair);
        }else{
            uniswapExhangeTool = await PancakeExchangeTool.deployed();
            
            uniswapRouter = await IPancakeRouter01.at(uniswapRouterAddress);
            uniswapFactoryAddress = await uniswapRouter.factory.call();
            uniswapFactory = await IPancakeFactory.at(uniswapFactoryAddress);
            wethAddress = await uniswapRouter.WETH.call();

            await uniswapFactory.createPair.sendTransaction(anotherToken.address, basicToken.address)
            .then(() => uniswapFactory.getPair(basicToken.address, anotherToken.address))
            .then(pair => pairAddress = pair);
        }
       
        console.log("uniswapExhangeTool ",uniswapExhangeTool.address);

        //global whitelist
        await paramKeeper.whitelistToken.sendTransaction(anotherToken.address);

        let traderPoolFactoryAddress = await paramKeeper.getAddress.call(toBN(1));
        traderPoolFactory = await TraderPoolFactoryUpgradeable.at(traderPoolFactoryAddress);

        let commissions = [toBN(10),toBN(3),toBN(100),toBN(40), toBN(50),toBN(25)]; 

        // deploy trader pool for testing with basicToken
        let createResult = await traderPoolFactory.createTraderContract(traderWallet, basicToken.address, toBN(0), commissions, true, false, "Trader token 1", "TRT1");
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
        let createResult2 = await traderPoolFactory.createTraderContract(traderWallet, wethAddress, toBN(0),commissions, true, false, "Trader token 2","TRT2");

        let contractETHAddress = createResult2.logs[2].args[0];
        console.log("TraderPool deployed at ", contractETHAddress, "Gas consumed", createResult2.receipt.gasUsed.toString());

        traderpoolETH = await TraderPoolUpgradeable.at(contractETHAddress);
        traderpoolETHLPT = await traderpoolETH.plt.call().then(result => TestToken.at(result));  
        //deploy uniswap pair for testing
        // uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress);
        // uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);

       

        
    });

    it('should set and read commissions', async () => {
        for(let i=1;i<=3;i++){
            let traderComm = await traderpoolETH.getCommission.call(toBN(i));
            console.log("Commission ",i," - ", traderComm[0].toString(),"/", traderComm[1].toString());
        }
        
        

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
        let resDirect = await traderpoolETH.send(ethLiqAmount, {from: account1});
        printEvents(resDirect,"Deposit 1");
        let resDepositTo = await traderpoolETH.depositETHTo.sendTransaction(account2, {from: account1, value: ethLiqAmount});
        printEvents(resDepositTo,"Deposit 2");

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
        let withdrawRes = await traderpoolETH.withdrawETH.sendTransaction(balanceWithdrawn, {from: account1});
        printEvents(withdrawRes," Withdraw tx");
        

        let wethBalanceAfterWithdraw = await weth.balanceOf.call(account1);

        // console.log("WETH balance withdrawn", wethBalanceAfterWithdraw.toString());
        console.log("WETH balance withdrawn", wethBalanceAfterWithdraw.toString());
        //convert WETH to ETH
        await wethContract.withdraw.sendTransaction(wethBalanceAfterWithdraw, {from: account1});
        
        let balance1After = await web3.eth.getBalance(account1);
        // let balance1After = await wethToken.balanceOf.call(account1);
        let lptBalance1After = await traderpoolETHLPT.balanceOf.call(account1);
        console.log("Balances ETH: Before",balance1Before.toString(), " after ",balance1After.toString());
        console.log("Balances LPT: Before",lptBalance1Before.toString(), " after ",lptBalance1After.toString()," diff", lptBalance1Before.sub(balanceWithdrawn).toString());
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
        let lptToWithdraw = lptBalance.div(toBN('1'));
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
        //Deposit 100000 from investor and 20000 from trader
        let investorDeposit = toBN('100000').mul(decimals);
        let traderDeposit = toBN('20000').mul(decimals);
        await basicToken.approve.sendTransaction(traderpool.address, investorDeposit);
        await traderpool.depositTo.sendTransaction(investorDeposit, mainAccount);

        await basicToken.approve.sendTransaction(traderpool.address, traderDeposit);
        await traderpool.depositTo.sendTransaction(traderDeposit, traderWallet);
        let lptInvestor = (await TraderLPT.balanceOf.call(mainAccount));
        let lptTrader = (await TraderLPT.balanceOf.call(traderWallet));
        console.log("Investor LPT: ",lptInvestor.toString());
        console.log("Trader LPT: ",lptTrader.toString());

        let traderLiquidity = await traderpool.traderLiquidityBalance.call();
        assert.equal(traderLiquidity.toString(),lptTrader.toString(),"Trader liquidity incorrect");
        let maxPositionAmount = await traderpool.getMaxPositionOpenAmount.call();
        console.log("maxPositionAmount: ",maxPositionAmount.toString());
        assert.equal(maxPositionAmount.toString(),toBN(220000).mul(decimals).toString(),"Trader maxPositionOpenAmount incorrect");

        //----------------------   

        let beforeBalance = await basicToken.balanceOf.call(traderpool.address);
        let basicLiqAmount = toBN('10000').mul(decimals);
        let reserveBBefore = await basicToken.balanceOf.call(pairAddress); 
        let reserveABefore = await anotherToken.balanceOf.call(pairAddress); 
        let targetLiquidyAmount = basicLiqAmount.mul(reserveABefore).div(reserveBBefore).mul(toBN(997)).div(toBN(1000));

        console.log("Pair Balance Before ",(reserveABefore).div(decimals).toString(),(reserveBBefore).div(decimals).toString());
        console.log("Trader pool balance in basic token:",beforeBalance.div(decimals).toString());

        let deadline=new Date().getTime() + ( 20 * 60 * 1000);
        let positionsLength = await traderpool.positionsLength.call();
        console.log("Positions.length", positionsLength.toString());
        assert.equal(positionsLength.toString(),toBN(0).toString(),"to positions before opening");

        let path = [basicToken.address, anotherToken.address];
        let result = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            basicLiqAmount,
            toBN(0),
            path,
            new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
            {from: traderWallet}
        );
        
        console.log(`openPosition GasUsed: ${result.receipt.gasUsed} deadline = ${deadline}`);    

        let reserveBAfter = await basicToken.balanceOf.call(pairAddress);
        let reserveAAfter = await anotherToken.balanceOf.call(pairAddress);
        console.log("Pair Balance increase: ",(reserveAAfter.sub(reserveABefore)).toString(),(reserveBAfter.sub(reserveBBefore)).toString()); 
        console.log("Abs K=",(reserveAAfter.sub(reserveABefore)).mul(reserveBAfter.sub(reserveBBefore)).toString());    

        printEvents(result,"Open position");
        // var logIndex=-1;

        // //event PositionOpened(uint16 index, uint8 manager, address token, uint256 amountOpened, uint256 liquidity);
        // let index= result.logs[++logIndex].args[0];
        // let manager= result.logs[logIndex].args[1];
        // let token= result.logs[logIndex].args[2];
        // let amountOpened= result.logs[logIndex].args[3];
        // let liquidity= result.logs[logIndex].args[4];
        // console.log('POpened ',index.toString(),manager.toString(),token.toString(),amountOpened.div(decimals).toString(),liquidity.div(decimals).toString());

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
        let positiondata = await traderpool.positionFor.call(anotherToken.address);
        // let managerView = positiondata[0];
        let amountOpenedView = positiondata[0];
        let liquidityView = positiondata[1];
        let tokenView = positiondata[2];
        console.log("Expected liquidity ", targetLiquidyAmount.toString(), "received", liquidityView.toString());
        console.log("view data", amountOpenedView.toString(),liquidityView.toString(),tokenView.toString() );

        // assert.equal(managerView.toString(),toBN(0).toString(),"manager index to be correct");
        assert.equal(amountOpenedView.toString(), basicLiqAmount.toString()," amount opened to be correctly set");
        // REVIEW assert.equal(targetLiquidyAmount.sub(liquidityView).lt(toBN(1000000000000000000))," liquidity to be correctly set");
        assert.equal(tokenView.toString(), anotherToken.address.toString()," token address to be correctly set");

        let basicTokenTraderBefore = await basicToken.balanceOf.call(traderpool.address);
        console.log("Trader balance in BaseToken after operation",basicTokenTraderBefore.toString());

        let totalCap = await traderpool.getTotalValueLocked.call();
        console.log("portfolioCap = ",totalCap[0].toString()," total LPT Supply=",totalCap[1].toString());
    });

    it('should close position partially with a loss', async () => {
        let positionIndex=toBN(0);


        let positiondata = await traderpool.positionAt.call(positionIndex);
        // let managerView = positiondata[0];
        let amountOpenedView = positiondata[0];
        let liquidityView = positiondata[1];
        let tokenView = positiondata[2];
        
        let percentClosed = toBN(50);//50%

        let liquidityClosed = liquidityView.mul(percentClosed).div(toBN(100));
        let liquidityRemaining = liquidityView.sub(liquidityClosed);

        let totalCap = await traderpool.getTotalValueLocked.call();
        // console.log("portfolioCap = ",totalCap[0].toString()," total LPT Supply=",totalCap[1].toString());

        let totalCapBefore = totalCap[0];
        let basicTokenBalanceBefore = await basicToken.balanceOf.call(traderpool.address);

        console.log("Liquidity: ",liquidityClosed.toString(), "out of",liquidityView.toString());

        let path = [ anotherToken.address, basicToken.address];
        let result = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            liquidityClosed,
            toBN(0),
            path,
            new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
            {from: traderWallet}
        );
        console.log(`ClosePosition GasUsed: ${result.receipt.gasUsed}`);    
        printEvents(result,"Close position");

        // let result = await traderpool.exitPosition.sendTransaction(
        //     positionIndex,
        //     liquidityClosed,
        //     new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
        //     {from: traderWallet}
        // );

        // var logIndex=-1;

        //event PositionClosed(uint16 index, uint8 manager, address token, uint256 amountClosed, uint256 liquidity, bool isProfit, uint256 finResB);
        // let index= result.logs[++logIndex].args[0];
        // let manager= result.logs[logIndex].args[1];
        // let token= result.logs[logIndex].args[2];
        // let amountClosed= result.logs[logIndex].args[3];
        // let liquidity= result.logs[logIndex].args[4];
        // let isProfit= result.logs[logIndex].args[5];
        // let finResB= result.logs[logIndex].args[6];

        // console.log('PClosed ',index.toString(),manager.toString(),token.toString(),amountClosed.div(decimals).toString(),liquidity.toString(),isProfit.toString(),finResB.div(decimals).toString());
        
        let basicTokenBalanceAfter = await basicToken.balanceOf.call(traderpool.address);
        let totalCap2 = await traderpool.getTotalValueLocked.call();
        let totalCapAfter = totalCap2[0];
        //balance checks
    //REVIEW    assert.equal(basicTokenBalanceAfter.toString(),basicTokenBalanceBefore.add(amountClosed).toString(),"contract to receive closed tokens" );
    //REVIEW    assert.equal(isProfit,false,"Loss detected");
        // assert.equal(totalCapAfter.toString(), totalCapBefore.sub(finResB).toString(), "remaining totalCap to be correct");

        //check remaining amounts on position record
        let positiondataafter = await traderpool.positionAt.call(positionIndex);
        // let managerViewAfter = positiondataafter[0];
        let amountOpenedViewAfter = positiondataafter[0];
        let liquidityViewAfter = positiondataafter[1];
        let tokenViewAfter = positiondataafter[2];
        assert.equal(liquidityViewAfter.toString(), liquidityRemaining.toString(), "remaining liquidity in Position record to be correct");
        //assert.equal(amountOpenedViewAfter.toString(), amountOpenedView.mul(percentClosed).div(toBN(100)).toString(), "remaining amountOpened in Position record to be correct");    
        
        
        // console.log('LiquidityTokens amount=',ltBalance.toString());

        // assert.notEqual(ltBalance.toString(), '0', 'Balance of pool\'s liquidity token must not be zero');
    });

    it('Should be able to add to Open Position when deposited', async () => {
        let positiondataBefore = await traderpool.positionAt.call(toBN(0));
        // let managerViewBefore = positiondataBefore[0];
        let amountOpenedViewBefore = positiondataBefore[0];
        let liquidityViewBefore = positiondataBefore[1];
        let tokenViewBefore = positiondataBefore[2];

        console.log("OpenedAmtBefore",amountOpenedViewBefore.toString());

        let depostiAmt = toBN('10000').mul(decimals);
        //deposit
        await basicToken.approve.sendTransaction(traderpool.address, depostiAmt);
        await traderpool.depositTo.sendTransaction(depostiAmt, mainAccount);
        //check Position Data
        let positiondataAfter = await traderpool.positionAt.call(toBN(0));
        // let managerViewAfter = positiondataAfter[0];
        let amountOpenedViewAfter = positiondataAfter[0];
        let liquidityViewAfter = positiondataAfter[1];
        let tokenViewAfter = positiondataAfter[2];
        console.log("amountOpenedViewAfter",amountOpenedViewAfter.toString());

        //REVIEW. Actual Portfolio OFF. assert.equal(amountOpenedViewAfter.sub(amountOpenedViewBefore).toString(),depostiAmt.toString(),"Actual position to consume all deposited tokens");

    });

   

 

});
