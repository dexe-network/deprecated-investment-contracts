
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
const million = toBN('10').pow(toBN('6'));
const billion = toBN('10').pow(toBN('9'));
const trillion = toBN('10').pow(toBN('12'));

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

// there is some moving price change on every uniswap
const assertBNAlmostEqual = function (bn1, bn2) {
    if (bn1.lte(toBN(10)) || bn2.lte(toBN(10))) {
        assert(bn1.eq(bn2));
        return;
    }
    if (bn1.lt(bn2)) {
        let tmp = bn1;
        bn1 = bn2;
        bn2 = tmp;
    }
    assert(bn1.gte(bn2));
    let diff = bn1.sub(bn2);
    assert(
        diff.mul(toBN(1000)).div(bn1).eq(toBN(0)),
        "relative difference is higher than 1/1000, bn1: " + bn1.toString() + ', bn2: ' + bn2.toString());
}

const addLiquidityToPool = async function (uniswapRouter, token1, token2, amount1, amount2, user) {
    await token1.approve.sendTransaction(uniswapRouter.address, amount1, {'from': user});
    await token2.approve.sendTransaction(uniswapRouter.address, amount2, {'from': user});
    await uniswapRouter.addLiquidity.sendTransaction(
        token1.address, token2.address,
        amount1, amount2,
        toBN(0), toBN(0),
        user,
        new Date().getTime() + (2 * 24 * 60 * 60 * 1000),
        {'from': user}
    );
};

contract('TraderPool', (accounts) => {
    let mainAccount = accounts[0];
    let uniswapFactory;
    let uniswapRouter;
    let basicToken;
    let anotherToken;
    let riskToken1;
    let riskToken2;
    let WEthAddress;
    let TraderToken;
    let traderpool;
    let traderpoolETH;

    let pairAddress;
    let riskToken1pairAddress;
    let riskToken2pairAddress;

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

    // const vendor = 'Ethereum';
    const vendor = 'BSC';
    beforeEach(async () => {
        assert.isAtLeast(accounts.length, 10, 'User accounts must be at least 10');
        traderWallet = accounts[9];

        await TestToken.new('Test USDT', 'USDT', {from: accounts[0]}).then(instance => basicToken = instance);
        await TestToken.new('Test DAI', 'DAI', {from: accounts[0]}).then(instance => anotherToken = instance);
        await TestToken.new('Test RISK1', 'RISK1', {from: accounts[0]}).then(instance => riskToken1 = instance);
        await TestToken.new('Test RISK2', 'RISK2', {from: accounts[0]}).then(instance => riskToken2 = instance);

        paramKeeper = await ParamKeeper.deployed();
        console.log("paramKeeper ",paramKeeper.address);
        uniswapRouterAddress = await paramKeeper.getAddress.call(toBN(1000));
        console.log("uniswapRouterAddress ",uniswapRouterAddress);

        // uniswapFactoryAddress = await paramKeeper.getAddress.call(toBN(1001));

        if(vendor == 'Ethereum'){
            uniswapExhangeTool = await UniswapExchangeTool.deployed();
            uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);
            uniswapFactoryAddress = await uniswapRouter.factory.call();
            uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress);
            wethAddress = await uniswapRouter.WETH.call();
        }else{  // bsc
            uniswapExhangeTool = await PancakeExchangeTool.deployed();
            uniswapRouter = await IPancakeRouter01.at(uniswapRouterAddress);
            uniswapFactoryAddress = await uniswapRouter.factory.call();
            uniswapFactory = await IPancakeFactory.at(uniswapFactoryAddress);
            wethAddress = await uniswapRouter.WETH.call();
        }
        await uniswapFactory.createPair.sendTransaction(anotherToken.address, basicToken.address)
            .then(() => uniswapFactory.getPair(basicToken.address, anotherToken.address))
            .then(pair => pairAddress = pair);
        await uniswapFactory.createPair.sendTransaction(riskToken1.address, basicToken.address)
            .then(() => uniswapFactory.getPair(basicToken.address, riskToken1.address))
            .then(pair => riskToken1pairAddress = pair);
        await uniswapFactory.createPair.sendTransaction(riskToken2.address, basicToken.address)
            .then(() => uniswapFactory.getPair(basicToken.address, riskToken2.address))
            .then(pair => riskToken2pairAddress = pair);

        console.log("uniswapExhangeTool ",uniswapExhangeTool.address);

        //global whitelist
        await paramKeeper.whitelistToken.sendTransaction(anotherToken.address);

        let traderPoolFactoryAddress = await paramKeeper.getAddress.call(toBN(1));
        traderPoolFactory = await TraderPoolFactoryUpgradeable.at(traderPoolFactoryAddress);

        let commissions = [toBN(10),toBN(3),toBN(100),toBN(40), toBN(50),toBN(25)];

        // deploy trader pool for testing with basicToken
        let createResult = await traderPoolFactory.createTraderContract(
            traderWallet, basicToken.address, toBN(0), commissions, true, false, "Trader token 1", "TRT1"
        );
        console.log("createResult.logs.length = ",createResult.logs.length);
        assert.equal(createResult.logs.length, 2);
        for(var i=0;i<createResult.logs.length;i++){
            console.log("createResult.logs[",i,"].length = ",createResult.logs[i].args.length, " ", createResult.logs[i].args.toString());
            console.log("response.logs[index].event = ",createResult.logs[i].event);
            for(var j=0;j<createResult.logs[i].args.length;j++){
                console.log(">",i,">",j," ",createResult.logs[i].args[j].toString());
            }
        }
        let contract3Address = createResult.logs[createResult.logs.length-1].args[0];
        console.log("TraderPool deployed at ", contract3Address, "Gas consumed", createResult.receipt.gasUsed.toString());

        traderpool = await TraderPoolUpgradeable.at(contract3Address);
        TraderLPT = await traderpool.plt.call().then(result => TestToken.at(result));

        console.log("wethAddres = ",wethAddress);

        //deploy WETH based traderpool
        let createResult2 = await traderPoolFactory.createTraderContract(traderWallet, wethAddress, toBN(0),commissions, true, false, "Trader token 2","TRT2");
        for(var i=0;i<createResult2.logs.length;i++){
            console.log("createResult2.logs[",i,"].length = ",createResult2.logs[i].args.length, " ", createResult2.logs[i].args.toString());
            console.log("createResult2.logs[",i,"].event = ",createResult2.logs[i].event);
            for(var j=0;j<createResult2.logs[i].args.length;j++){
                console.log(">",i,">",j," ",createResult2.logs[i].args[j].toString());
            }
        }
        assert.equal(createResult2.logs[createResult2.logs.length-1].event, "TraderContractCreated");
        let contractETHAddress = createResult2.logs[createResult2.logs.length-1].args[0];
        console.log("TraderPool deployed at ", contractETHAddress, "Gas consumed", createResult2.receipt.gasUsed.toString());

        traderpoolETH = await TraderPoolUpgradeable.at(contractETHAddress);
        traderpoolETHLPT = await traderpoolETH.plt.call().then(result => TestToken.at(result));
        //deploy uniswap pair for testing
        // uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress);
        // uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);

        // comissions
        for(let i=1;i<=3;i++){
            let traderComm = await traderpoolETH.getCommission.call(toBN(i));
            console.log("Commission ",i," - ", traderComm[0].toString(),"/", traderComm[1].toString());
        }

        //todo discuss amount
        let basicTokenAmount = trillion.mul(decimals);
        let anotherTokenAmount = trillion.mul(decimals);
        let riskToken1Amount = trillion.mul(decimals);
        let riskToken2Amount = trillion.mul(decimals);

        await addLiquidityToPool(uniswapRouter, basicToken, anotherToken, basicTokenAmount, anotherTokenAmount, accounts[0]);
        await addLiquidityToPool(uniswapRouter, basicToken, riskToken1, basicTokenAmount, riskToken1Amount, accounts[0]);
        await addLiquidityToPool(uniswapRouter, basicToken, riskToken2, basicTokenAmount, riskToken2Amount, accounts[0]);

        //init test balances
        for(let i=1;i<accounts.length;i++){
            let account = accounts[i];
            await basicToken.transfer.sendTransaction(account, toBN('3610000').mul(decimals));
            await anotherToken.transfer.sendTransaction(account, toBN('10000').mul(decimals));
            await riskToken1.transfer.sendTransaction(account, toBN('10000').mul(decimals));
            await riskToken2.transfer.sendTransaction(account, toBN('10000').mul(decimals));
        }
    });

    it('Test loss risk trade', async () => {
        const usersAndTrader = [accounts[1], accounts[2], accounts[3], traderWallet];
        const users = [accounts[1], accounts[2], accounts[3]];
        const deposit_amount = toBN(10).mul(decimals);
        for(const u of usersAndTrader) {
            await basicToken.approve.sendTransaction(traderpool.address, deposit_amount, {'from': u});
            await traderpool.deposit.sendTransaction(deposit_amount, {'from': u});
            assert.equal((await TraderLPT.balanceOf.call(u)).toString(), deposit_amount.toString());
        }

        assert.equal((await basicToken.balanceOf.call(traderpool.address)).toString(), toBN(40).mul(decimals).toString());
        assert.equal((await anotherToken.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
        assert.equal((await riskToken1.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
        assert.equal((await riskToken2.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());

        let maxPositionAmount = await traderpool.getMaxPositionOpenAmount.call();
        console.log("maxPositionAmount: ",maxPositionAmount.toString());

        let amount = toBN(10).mul(decimals);
        // buy another token
        let path = [basicToken.address, anotherToken.address];
        let tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            amount,
            toBN(0),
            path,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {from: traderWallet}
        );
        printEvents(tx, "swap: basic -> another")

        assertBNAlmostEqual((await basicToken.balanceOf.call(traderpool.address)), toBN(30).mul(decimals));
        assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN('9979999999900399600'));  // todo discuss
        // assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN(10).mul(decimals));
        assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));
        assertBNAlmostEqual((await riskToken2.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));
        // assert.equal((await basicToken.balanceOf.call(traderpool.address)).toString(), toBN(30).mul(decimals).toString());
        // assert.equal((await anotherToken.balanceOf.call(traderpool.address)).toString(), toBN(10).mul(decimals).toString());
        // assert.equal((await riskToken1.balanceOf.call(traderpool.address)).toString(), toBN(0).mul(decimals).toString());
        // assert.equal((await riskToken2.balanceOf.call(traderpool.address)).toString(), toBN(0).mul(decimals).toString());

        tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});
        printEvents(tx, "createProposal")

        tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, toBN(10).mul(decimals), {'from': users[0]});
        printEvents(tx, "setAllowanceForProposal")

        const riskyTradeAmount = decimals.div(toBN(10000));  // 0.0001
        // buy risky token
        path = [basicToken.address, riskToken1.address];
        tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            riskyTradeAmount,
            toBN(0),
            path,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {from: traderWallet}
        );
        printEvents(tx, "swap: basic -> risky1")

        assertBNAlmostEqual((await basicToken.balanceOf.call(traderpool.address)), toBN(30).mul(decimals));
        assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN('9979999999900399600'));  // todo discuss
        // assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN(10).mul(decimals));
        assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), toBN('99799999999999'));
        // assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), riskyTradeAmount);
        assertBNAlmostEqual((await riskToken2.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));

        console.log("accounts[0] balance of basicToken: ", (await basicToken.balanceOf(accounts[0])).toString());
        console.log("accounts[0] balance of riskToken1: ", (await riskToken1.balanceOf(accounts[0])).toString());
        await addLiquidityToPool(
            uniswapRouter, basicToken, riskToken1, toBN(100), toBN(100), accounts[0]
            // uniswapRouter, basicToken, riskToken1, toBN(0), trillion.mul(decimals), accounts[0]
        ); // twice more risky in pool
        // swapper.setPrice(riskyToken.address, baseToken.address, 10**18, 2*10**18)  # price go down to: 2 risky ~ 1 base

        const riskyTradeAmountSell = await riskToken1.balanceOf.call(traderpool.address);
        console.log("riskyTradeAmountSell: ", riskyTradeAmountSell.toString());

        // sell risky token
        path = [riskToken1.address, basicToken.address];
        tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            riskyTradeAmountSell,
            toBN(0),
            path,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {from: traderWallet}
        );
        printEvents(tx, "swap: risky1 -> basic")

        let risky1BalanceOfTraderPool = await riskToken1.balanceOf.call(traderpool.address);
        assert.equal(risky1BalanceOfTraderPool.toString(), toBN(0).toString());

        let LPbalanceOfuser0 = await TraderLPT.balanceOf.call(users[0]);
        let delta_balance = LPbalanceOfuser0 - deposit_amount;
        let expected = -riskyTradeAmount.div(toBN(2));
        assert(delta_balance.lt(toBN(0)));
        assert(delta_balance.sub(expected).mul(toBN(100)).div(expected).abs().lte(toBN(1)));
    });

    // it('Profit 2 profit trades by 2 isolated users', async () => {
    //     const usersAndTrader = [accounts[1], accounts[2], accounts[3], traderWallet];
    //     const users = [accounts[1], accounts[2], accounts[3]];
    //     const deposit_amount = toBN(10).mul(decimals);
    //     for(const u of usersAndTrader) {
    //         await basicToken.approve.sendTransaction(traderpool.address, deposit_amount, {'from': u});
    //         await traderpool.deposit.sendTransaction(deposit_amount, {'from': u});
    //         assert.equal((await TraderLPT.balanceOf.call(u)).toString(), deposit_amount.toString());
    //     }
    //
    //     assert.equal((await basicToken.balanceOf.call(traderpool.address)).toString(), toBN(40).mul(decimals).toString());
    //     assert.equal((await anotherToken.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //     assert.equal((await riskToken1.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //     assert.equal((await riskToken2.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //
    //     let maxPositionAmount = await traderpool.getMaxPositionOpenAmount.call();
    //     console.log("maxPositionAmount: ",maxPositionAmount.toString());
    //
    //     let amount = toBN(10).mul(decimals);
    //     let path = [basicToken.address, anotherToken.address];
    //     let tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         amount,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEvents(tx, "swap: basic -> another")
    //
    //     const smallAmount = decimals.div(billion);
    //     const riskyTradeAmount = smallAmount;
    //
    //     tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});
    //     printEvents(tx, "createProposal")
    //
    //     tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, toBN(10).mul(decimals), {'from': users[0]});
    //     printEvents(tx, "setAllowanceForProposal")
    //
    //     // buy risky token
    //     path = [basicToken.address, riskToken1.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmount,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEvents(tx, "swap1: basic -> risky1")
    //
    //     // await swapper.setPrice.sendTransaction(riskyToken.address, baseToken.address, 2*10**18, 1*10**18);
    //
    //     tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, toBN(10).mul(decimals), {'from': users[1]});
    //     printEvents(tx, "setAllowanceForProposal")
    //
    //     // buy more risky token
    //     path = [basicToken.address, riskToken1.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmount / 2,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEvents(tx, "swap2: basic -> risky1")
    //
    //     // assert.equal((await riskyToken.balanceOf(traderpool.address)), (1.5*riskyTradeAmount).toInt());
    //     // const totalLockedLp = traderpool.totalLockedLp.call();
    //     // const expected = (riskyTradeAmount * (1 + 0.5/0.5)).toInt();
    //     // assert.equal(abs(totalLockedLp-expected) / expected, ALPHA);
    //
    //     // swapper.setPrice(riskyToken.address, baseToken.address, 4*10**18, 1*10**18)  # 1 risky ~ 4 base
    //     //
    //     // riskyBalanceBefore = riskyToken.balanceOf(traderpool.address)
    //     //
    //     // minBaseTokenAmount = 4 * riskyTradeAmount
    //     // baseTokenAmount = traderpool.sellRiskyToken.call(riskyTradeAmount, minBaseTokenAmount, {'from': trader})  # trade4 sell 2/3 risky token
    //     // assert baseTokenAmount == minBaseTokenAmount
    //     // tx = traderpool.sellRiskyToken(riskyTradeAmount, minBaseTokenAmount, {'from': trader})  # trade4 sell 2/3 risky token
    //     // print(f'{list(e for e in tx.events)=}')
    //     // assert riskyToken.balanceOf(traderpool.address) == int(0.5*riskyTradeAmount)
    //     //
    //     // # check won amount
    //     // delta_balance1 = lpToken.balanceOf(user1) - deposit_amount
    //     // delta_balance2 = lpToken.balanceOf(user2) - deposit_amount
    //     //
    //     // # todo: discuss why changed
    //     // # expected1 = riskyTradeAmount * (1 / 1.5) * ((4-1)/1)
    //     // # expected2 = riskyTradeAmount * (0.5 / 1.5) * ((4-2)/2)
    //     //
    //     // # expected1 = profile.riskyTokenAmount / riskyBalanceBefore * (baseTokenAmount * currentLpPrice.denominator / currentLpPrice.numerator - totalLockedLp * riskyTokenAmount / riskyBalanceBefore)
    //     // currentLpPriceInBase = 1  # todo test if not eq
    //     // expected1 = (1 / 1.5) * (baseTokenAmount / currentLpPriceInBase - totalLockedLp * riskyTradeAmount / riskyBalanceBefore)
    //     //
    //     // expected2 = (0.5 / 1.5) * (baseTokenAmount / currentLpPriceInBase - totalLockedLp * riskyTradeAmount / riskyBalanceBefore)
    //     //
    //     // assert delta_balance1 > 0 and abs(delta_balance1 - expected1) / expected1 < ALPHA
    //     // assert delta_balance2 > 0 and abs(delta_balance2 - expected2) / expected2 < ALPHA
    //
    // });

    it('profit on riskToken1, loss on riskTokwn2', async () => {
        let tx;

        // createProposal 1
        tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});

        // createProposal 2
        tx = await traderpool.createProposal.sendTransaction(riskToken2.address, {'from': traderWallet});

        const riskyTradeAmount = toBN(1) * decimals;

        // buy risk1
        path = [basicToken.address, riskToken1.address];
        tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            riskyTradeAmount,
            toBN(0),
            path,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {from: traderWallet}
        );
        printEvents(tx, "swap: basic -> risky1")

        // buy risk2
        path = [basicToken.address, riskToken1.address];
        tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            riskyTradeAmount,
            toBN(0),
            path,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {from: traderWallet}
        );
        printEvents(tx, "swap: basic -> risky2")

        // move price 1 up
        await addLiquidityToPool(uniswapRouter, basicToken, riskToken1, trillion, toBN(0), accounts[0]);

        // move price 2 down
        await addLiquidityToPool(uniswapRouter, basicToken, riskToken1, toBN(0), trillion, accounts[0]);

        // sell 1
        path = [riskToken1.address, basicToken.address];
        tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            riskyTradeAmount,
            toBN(0),
            path,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {from: traderWallet}
        );
        printEvents(tx, "swap: risky1 -> basic")

        // sell 2
        path = [riskToken2.address, basicToken.address];
        tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            riskyTradeAmount,
            toBN(0),
            path,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {from: traderWallet}
        );
        printEvents(tx, "swap: risky2 -> basic")

        // check balances
    });

    it('liquidate riskToken1', async () => {
        let tx;

        // createProposal
        tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});

        // buy risk1
        path = [basicToken.address, riskToken1.address];
        tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
            traderpool.address,
            riskyTradeAmount,
            toBN(0),
            path,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {from: traderWallet}
        );
        printEvents(tx, "swap: basic -> risky1")

        // include to whiteList

        // deny any operation before converting to white

        // assume state was updated correctly
    });
});

