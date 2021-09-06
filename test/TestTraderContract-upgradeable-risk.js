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
const IPancakeRouter02 = artifacts.require("IPancakeRouter02");
const IPancakeFactory = artifacts.require("IPancakeFactory");
const PancakeAutoExchangeTool = artifacts.require("PancakeAutoExchangeTool");
const { time, ether, expectRevert } = require('openzeppelin-test-helpers');
const BigDecimal = require('js-big-decimal');
const { assert } = require('chai');
// const { helper } = require('./utils.js');
const fs = require('fs');


const contractEventsAbi = (contract) => {
    let events = [];
    const abi = contract["constructor"]["abi"];
    if (abi === undefined) {
        console.warn('no abi for contract', JSON.stringify(contract));
        return [];
    }
    for (let i = 0; i < abi.length; i++) {
        const item = abi[i];
        if (item['type'] === 'event') {
            events.push(item);
        }
    }
    return events;
}


// some how truffle cannot decode events in Tx so I was forced to write my solution
const printEventsCustomDecode = (tx, contracts) => {
    let contractAddress2eventSignature2eventsAbi = {};
    let contractAddress2contractName = {};
    for (const contract of contracts) {
        contractAddress2contractName[contract.address] = contract.constructor.contractName;

        if (contractAddress2eventSignature2eventsAbi[contract.address] === undefined) {
            contractAddress2eventSignature2eventsAbi[contract.address] = {};
        }
        const eventSignature2eventsAbi = contractAddress2eventSignature2eventsAbi[contract.address];
        const eventsAbi = contractEventsAbi(contract);
        for (const eventAbi of eventsAbi) {
            eventSignature2eventsAbi[eventAbi['signature']] = eventAbi;
        }
    }
    for (const log of tx['receipt']['rawLogs']) {
        // e.g.
        // {
        //     "logIndex": 7,
        //     "transactionIndex": 0,
        //     "transactionHash": "0x5684e717e8550746210f3df0b6bffedff2844e7a0f12663f7f87dc69f73e6f76",
        //     "blockHash": "0x3f7753ffcb174a682d7e19b1a8397121262bfdb877ecff5f11f7b6f461d2089d",
        //     "blockNumber": 10018381,
        //     "address": "0x3d501825d4F331c513b0A88834f9375559b15CE3",
        //     "data": "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005ac47ef47598000000000000000000000000000000000000000000000000000016ab4f30639f0000000000000000000000000000000000000000000000000000000000000000",
        //     "topics": ["0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822", "0x00000000000000000000000005ff2b0db69458a0750badebc4f9e13add608c7f", "0x000000000000000000000000e79e241f9b269fc819aec41956a5798b8a611a01"],
        //     "type": "mined",
        //     "removed": false,
        //     "id": "log_993179d5"
        // }
        const eventSignature2eventsAbi = contractAddress2eventSignature2eventsAbi[log.address];
        console.log('logIndex: ', log.logIndex);
        if (eventSignature2eventsAbi === undefined) {
            console.log("FAIL decode event because unknown address ", log.address);
            console.log("bad event:", log);
            continue;
        }
        const eventAbi = eventSignature2eventsAbi[log.topics[0]];
        if (eventAbi === undefined) {
            console.log("FAIL decode event because unknown abi for signature ", log.topics[0]);
            console.log("bad event:", log);
            continue;
        }
        let decoded = null;
        let topics;
        if (eventAbi.anonymous) {
            topics = log.topics;
        } else {
            topics = log.topics.slice(1);
        }
        try {
            decoded = web3.eth.abi.decodeLog(eventAbi['inputs'], log.data, topics);
            console.log('OK decoded ', contractAddress2contractName[log.address], '[', log.address, '] event: ', eventAbi.name, ' ', decoded);
        } catch(error) {
            console.log('FAIL decode log');
            console.log('failed eventAbi: ', JSON.stringify(eventAbi));
            console.log('failed log: ', JSON.stringify(log));
            console.error(error);
        }
    }
}


const takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_snapshot',
      id: new Date().getTime()
    }, (err, snapshotId) => {
      if (err) { return reject(err) }
      return resolve(snapshotId)
    })
  })
}

const revertToSnapShot = (id) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_revert',
      params: [id],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}


function toBN(number) {
    return web3.utils.toBN(number);
}

const decimals = toBN('10').pow(toBN('18'));
const million = toBN('10').pow(toBN('6'));
const billion = toBN('10').pow(toBN('9'));
const trillion = toBN('10').pow(toBN('12'));


function printEvents(txResult, strdata){
    console.log(strdata, " events.length:", txResult.logs.length);
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
const _assertBNAlmostEqual = function (bn1, bn2, acc) {
    // if (
    //     bn1.lte(toBN(10)) || bn2.lte(toBN(10))
    // ) {
    //     assert(bn1.eq(bn2));
    //     return;
    // }
    if (bn1.lt(toBN(0))) {
        assert(bn2.lt(toBN(0)), "bn1 and bn2 must be neg or pos both");
    }
    if (bn1.lt(bn2)) {  // todo
        let tmp = bn1;
        bn1 = bn2;
        bn2 = tmp;
    }
    assert(bn1.gte(bn2));
    let diff = bn1.sub(bn2);
    assert(
        diff.mul(toBN(acc)).div(bn1).eq(toBN(0)),
        "relative difference is higher than 1/", acc, ", bn1: " + bn1.toString() + ', bn2: ' + bn2.toString());
}

const assertBNAlmostEqual100 = function (bn1, bn2) {
    _assertBNAlmostEqual(bn1, bn2, 100);
}

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

    let allDeployedContracts = [];

    async function moveRiskPriceUp(shiftAmount, shifter, _riskToken) {
        await basicToken.approve.sendTransaction(uniswapRouter.address, shiftAmount, {'from': shifter});
        let tx = await uniswapRouter.swapExactTokensForTokens.sendTransaction(
            shiftAmount,
            toBN(0),
            [basicToken.address, _riskToken.address],
            shifter,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {'from': shifter}
        )
        printEvents(tx, "moveRiskPriceUp");
        // todo log price change
    }

    async function moveRiskPriceDown(shiftAmount, shifter, _riskToken) {
        await _riskToken.approve.sendTransaction(uniswapRouter.address, shiftAmount, {'from': shifter});
        let tx = await uniswapRouter.swapExactTokensForTokens.sendTransaction(
            shiftAmount,
            toBN(0),
            [_riskToken.address, basicToken.address],
            shifter,
            Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
            {'from': shifter}
        )
        printEvents(tx, "moveRiskPriceDown");
        // todo log price change
    }

    async function blockchainSetUp() {
        console.log("blockchainSetUp");

        assert.isAtLeast(accounts.length, 10, 'User accounts must be at least 10');
        traderWallet = accounts[9];

        await TestToken.new('Test USDT', 'USDT', {from: accounts[0]}).then((instance) => {basicToken = instance; allDeployedContracts.push(instance)});
        await TestToken.new('Test DAI', 'DAI', {from: accounts[0]}).then((instance) => {anotherToken = instance; allDeployedContracts.push(instance)});
        await TestToken.new('Test RISK1', 'RISK1', {from: accounts[0]}).then((instance) => {riskToken1 = instance; allDeployedContracts.push(instance)});
        await TestToken.new('Test RISK2', 'RISK2', {from: accounts[0]}).then((instance) => {riskToken2 = instance; allDeployedContracts.push(instance)});

        paramKeeper = await ParamKeeper.deployed();
        allDeployedContracts.push(paramKeeper);
        console.log("paramKeeper deployed", paramKeeper.address);

        const exchangerAddress = await paramKeeper.getAssetAutomaticExchangeManager();
        const exchanger = PancakeAutoExchangeTool.at(exchangerAddress);
        allDeployedContracts.push(exchanger);

        // const pancakeRouterAddress = await exchanger.pancakeRouter();
        const pancakeRouterAddress = '0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F';
        const pancakeRouter = IPancakeRouter02.at(pancakeRouterAddress);
        allDeployedContracts.push(pancakeRouter);

        console.log("paramKeeper ",paramKeeper.address);
        uniswapRouterAddress = await paramKeeper.getAddress.call(toBN(1000));
        console.log("uniswapRouterAddress ",uniswapRouterAddress);

        // uniswapFactoryAddress = await paramKeeper.getAddress.call(toBN(1001));

        if(vendor == 'Ethereum'){
            uniswapExhangeTool = await UniswapExchangeTool.deployed();
            allDeployedContracts.push(uniswapExhangeTool);
            uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);
            allDeployedContracts.push(uniswapRouter);
            uniswapFactoryAddress = await uniswapRouter.factory.call();
            uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress);
            allDeployedContracts.push(uniswapFactory);
            wethAddress = await uniswapRouter.WETH.call();
        }else{  // bsc
            uniswapExhangeTool = await PancakeExchangeTool.deployed();
            allDeployedContracts.push(uniswapExhangeTool);
            uniswapRouter = await IPancakeRouter01.at(uniswapRouterAddress);
            allDeployedContracts.push(uniswapRouter);
            uniswapFactoryAddress = await uniswapRouter.factory.call();
            uniswapFactory = await IPancakeFactory.at(uniswapFactoryAddress);
            allDeployedContracts.push(uniswapFactory);
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
        allDeployedContracts.push(traderPoolFactory);

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
        allDeployedContracts.push(traderpool);
        TraderLPT = await traderpool.plt.call().then(result => TestToken.at(result));
        allDeployedContracts.push(TraderLPT);

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
        allDeployedContracts.push(traderpoolETH);
        traderpoolETHLPT = await traderpoolETH.plt.call().then(result => TestToken.at(result));
        allDeployedContracts.push(traderpoolETHLPT);
        //deploy uniswap pair for testing
        // uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress);
        // uniswapRouter = await UniswapRouter.at(uniswapRouterAddress);

        // comissions
        for(let i=1;i<=3;i++){
            let traderComm = await traderpoolETH.getCommission.call(toBN(i));
            console.log("Commission ",i," - ", traderComm[0].toString(),"/", traderComm[1].toString());
        }

        //todo discuss amount
        const poolAmount = toBN(1000);
        let basicTokenAmount = poolAmount.mul(decimals);
        let anotherTokenAmount = poolAmount.mul(decimals);
        let riskToken1Amount = poolAmount.mul(decimals);
        let riskToken2Amount = poolAmount.mul(decimals);

        await addLiquidityToPool(uniswapRouter, basicToken, anotherToken, basicTokenAmount, anotherTokenAmount, accounts[0]);
        await addLiquidityToPool(uniswapRouter, basicToken, riskToken1, basicTokenAmount, riskToken1Amount, accounts[0]);
        await addLiquidityToPool(uniswapRouter, basicToken, riskToken2, basicTokenAmount, riskToken2Amount, accounts[0]);

        //init test balances
        for(let i=1;i<accounts.length;i++){
            let account = accounts[i];
            // await basicToken.transfer.sendTransaction(account, toBN(10).mul(trillion).mul(decimals));
            // await anotherToken.transfer.sendTransaction(account, toBN(10).mul(trillion).mul(decimals));
            // await riskToken1.transfer.sendTransaction(account, toBN(10).mul(trillion).mul(decimals));
            // await riskToken2.transfer.sendTransaction(account, toBN(10).mul(trillion).mul(decimals));

            await basicToken.transfer.sendTransaction(account, toBN(1000).mul(decimals));
            await anotherToken.transfer.sendTransaction(account, toBN(1000).mul(decimals));
            await riskToken1.transfer.sendTransaction(account, toBN(1000).mul(decimals));
            await riskToken2.transfer.sendTransaction(account, toBN(1000).mul(decimals));
        }
    }

    const vendor = 'BSC';
    let snapshotId;
    before(async () => {
        // let snapshotConfig
        // try{
        //     snapshotConfig = require('/tmp/snapshotConfig.json');
        // } catch(e) {
        //     snapshotConfig = undefined;
        // }
        // if (snapshotConfig === undefined || snapshotConfig.snapshotId == undefined) {
            console.log("generate snapshot");  // do not forget to remove the file in case if you changed any SmartContract
            await blockchainSetUp();
            const snapShot = await takeSnapshot();
            snapshotId = snapShot['result'];
            console.log("snapshotId: ", snapshotId);
        //     fs.writeFile("/tmp/snapshotConfig.json", JSON.stringify({"snapshotId": snapshotId}), function(err) {
        //         if (err) throw err;
        //         console.log('complete');
        //         }
        //     );
        // } else {
        //     console.log("load snapshotId from file");
        //     snapshotId = snapshotConfig.snapshotId;
        //     await revertToSnapShot(snapshotId);
        // }
    });

    afterEach(async() => {
        await revertToSnapShot(snapshotId);
    });

    async function getTokenPrice(token){
        // price is calculated for 10**18 tokens sold to baseToken
        return (await uniswapRouter.getAmountsOut.call(decimals, [token.address, basicToken.address]))[1];
    }

    // it('Test price moving', async () => {
    //     let shiftAmount = toBN(1000).mul(decimals);
    //     let shifter = accounts[0];
    //
    //     const shifterRiskTokenBalanceBefore = await riskToken1.balanceOf.call(shifter);
    //     console.log("risk balance shifter before ", shifterRiskTokenBalanceBefore.toString());
    //
    //     const priceBeforeMove = await getTokenPrice(riskToken1);
    //     console.log("price before move ", priceBeforeMove.toString());
    //
    //     await moveRiskPriceUp(shiftAmount, shifter, riskToken1);
    //     const shifterRiskTokenBalanceAfter = await riskToken1.balanceOf.call(shifter);
    //     console.log("risk balance shifter after ", shifterRiskTokenBalanceAfter.toString());
    //     console.log("risk balance shifter change ", (shifterRiskTokenBalanceAfter-shifterRiskTokenBalanceBefore).toString());
    //
    //     const priceAfterMove = await getTokenPrice(riskToken1);
    //     console.log("price after move ", priceAfterMove.toString());
    //
    //     assert(priceAfterMove.gt(priceBeforeMove), "priceAfterMove > priceBeforeMove failed");
    // });
    //
    // it('Test profit risk trade', async () => {
    //     const usersAndTrader = [accounts[1], accounts[2], traderWallet];
    //     const users = [accounts[1], accounts[2]];
    //     const deposit_amount = toBN(10).mul(decimals);
    //     for(const u of usersAndTrader) {
    //         await basicToken.approve.sendTransaction(traderpool.address, deposit_amount, {'from': u});
    //         await traderpool.deposit.sendTransaction(deposit_amount, {'from': u});
    //         assert.equal((await TraderLPT.balanceOf.call(u)).toString(), deposit_amount.toString());
    //     }
    //
    //     assert.equal((await basicToken.balanceOf.call(traderpool.address)).toString(), toBN(30).mul(decimals).toString());
    //     assert.equal((await anotherToken.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //     assert.equal((await riskToken1.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //     assert.equal((await riskToken2.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //
    //     let maxPositionAmount = await traderpool.getMaxPositionOpenAmount.call();
    //     console.log("maxPositionAmount: ",maxPositionAmount.toString());
    //
    //     let lpTokenPriceN0 = await traderpool.REMOVEgetCurrentLpTokenPriceN.call();
    //     let lpTokenPriceD0 = await traderpool.REMOVEgetCurrentLpTokenPriceD.call();
    //     console.log("lpTokenPriceN0/lpTokenPriceD0:", lpTokenPriceN0, '/', lpTokenPriceD0);
    //
    //     // proposal
    //     tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});
    //     printEvents(tx, "createProposal")
    //
    //     // users[0] allowance
    //     tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, toBN(10).mul(decimals), {'from': users[0]});
    //     printEvents(tx, "setAllowanceForProposal")
    //
    //     const riskyTradeAmount = decimals.div(toBN(10000));  // 0.0001
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
    //     printEvents(tx, "swap: basic -> risky1")
    //
    //     let lpTokenPriceN1 = await traderpool.REMOVEgetCurrentLpTokenPriceN.call();
    //     let lpTokenPriceD1 = await traderpool.REMOVEgetCurrentLpTokenPriceD.call();
    //     console.log("lpTokenPriceN1/lpTokenPriceD1:", lpTokenPriceN1, '/', lpTokenPriceD1);
    //     assert.equal(lpTokenPriceN1.toString(), lpTokenPriceN0.toString());
    //     assert.equal(lpTokenPriceD1.toString(), lpTokenPriceD0.toString());
    //
    //     assertBNAlmostEqual((await basicToken.balanceOf.call(traderpool.address)), toBN(30).mul(decimals).sub(riskyTradeAmount));
    //     assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN('0'));
    //     assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), riskyTradeAmount.mul(toBN(998)).div(toBN(1000)));  // comission
    //     assertBNAlmostEqual((await riskToken2.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));
    //
    //     console.log("price before move ",  (await getTokenPrice(riskToken1)).toString());
    //
    //     // let shiftAmount = toBN(1000).mul(billion).mul(decimals);
    //     let shiftAmount = toBN(1000).mul(decimals);
    //     let shifter = accounts[0];
    //     const riskTokenPriceBeforeMove = await getTokenPrice(riskToken1);
    //     await moveRiskPriceUp(shiftAmount, shifter, riskToken1);
    //     const riskTokenPriceAfterMove = await getTokenPrice(riskToken1);
    //     console.log('riskToken1.balanceOf.call(shifter): ', (await riskToken1.balanceOf.call(shifter)).toString());
    //
    //     console.log("riskTokenPriceBeforeMove:", riskTokenPriceBeforeMove.toString());
    //     console.log("riskTokenPriceAfterMove:", riskTokenPriceAfterMove.toString());
    //     assert(riskTokenPriceAfterMove.gt(riskTokenPriceBeforeMove));
    //
    //
    //     // sell 100% risk token
    //     const riskyTradeAmountSell = await riskToken1.balanceOf.call(traderpool.address);
    //     assertBNAlmostEqual(riskyTradeAmountSell, riskyTradeAmount.mul(toBN(998)).div(toBN(1000)));  // fee
    //     console.log("riskyTradeAmountSell: ", riskyTradeAmountSell.toString());
    //
    //     // sell risky token
    //     path = [riskToken1.address, basicToken.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmountSell,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEventsCustomDecode(tx, allDeployedContracts);
    //     printEvents(tx, "swap: risky1 -> basic");
    //
    //     // check that lp price did not change
    //     let lpTokenPriceN2 = await traderpool.REMOVEgetCurrentLpTokenPriceN.call();
    //     let lpTokenPriceD2 = await traderpool.REMOVEgetCurrentLpTokenPriceD.call();
    //     console.log("lpTokenPriceN2/lpTokenPriceD2:", lpTokenPriceN2.toString(), '/', lpTokenPriceD2.toString());
    //     assertBNAlmostEqual(lpTokenPriceN2, lpTokenPriceN0);  // todo why it's not 100% same
    //     assertBNAlmostEqual(lpTokenPriceD2, lpTokenPriceD0);
    //     // assert.equal(lpTokenPriceN2.toString(), toBN(lpTokenPriceN0).toString());
    //     // assert.equal(lpTokenPriceD2.toString(), toBN(lpTokenPriceN0).toString());
    //
    //     let risky1BalanceOfTraderPool = await riskToken1.balanceOf.call(traderpool.address);
    //     assert.equal(risky1BalanceOfTraderPool.toString(), toBN(0).toString());
    //
    //     let LPbalanceOfuser0 = await TraderLPT.balanceOf.call(users[0]);
    //     let deltaBalance = LPbalanceOfuser0.sub(deposit_amount);
    //     let expected = riskyTradeAmountSell.mul(riskTokenPriceAfterMove).div(riskTokenPriceBeforeMove).mul(lpTokenPriceD0).div(lpTokenPriceN0);
    //     assert(deltaBalance.gt(toBN(0)), "too small delta_balance (should be positive): " + deltaBalance.toString());
    //     assertBNAlmostEqual100(deltaBalance, expected);  // todo: 100% accuracy
    // });

    // it('Test loss risk trade', async () => {
    //     const usersAndTrader = [accounts[1], accounts[2], traderWallet];
    //     const users = [accounts[1], accounts[2]];
    //     const deposit_amount = toBN(10).mul(decimals);
    //     for(const u of usersAndTrader) {
    //         await basicToken.approve.sendTransaction(traderpool.address, deposit_amount, {'from': u});
    //         await traderpool.deposit.sendTransaction(deposit_amount, {'from': u});
    //         assert.equal((await TraderLPT.balanceOf.call(u)).toString(), deposit_amount.toString());
    //     }
    //
    //     assert.equal((await basicToken.balanceOf.call(traderpool.address)).toString(), toBN(30).mul(decimals).toString());
    //     assert.equal((await anotherToken.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //     assert.equal((await riskToken1.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //     assert.equal((await riskToken2.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
    //
    //     let maxPositionAmount = await traderpool.getMaxPositionOpenAmount.call();
    //     console.log("maxPositionAmount: ",maxPositionAmount.toString());
    //
    //     let lpTokenPriceN0 = await traderpool.REMOVEgetCurrentLpTokenPriceN.call();
    //     let lpTokenPriceD0 = await traderpool.REMOVEgetCurrentLpTokenPriceD.call();
    //     console.log("lpTokenPriceN0/lpTokenPriceD0:", lpTokenPriceN0, '/', lpTokenPriceD0);
    //
    //     // proposal
    //     tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});
    //     printEvents(tx, "createProposal")
    //
    //     // users[0] allowance
    //     tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, toBN(10).mul(decimals), {'from': users[0]});
    //     printEvents(tx, "setAllowanceForProposal")
    //
    //     const riskyTradeAmount = decimals.div(toBN(10000));  // 0.0001
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
    //     printEvents(tx, "swap: basic -> risky1")
    //
    //     let lpTokenPriceN1 = await traderpool.REMOVEgetCurrentLpTokenPriceN.call();
    //     let lpTokenPriceD1 = await traderpool.REMOVEgetCurrentLpTokenPriceD.call();
    //     console.log("lpTokenPriceN1/lpTokenPriceD1:", lpTokenPriceN1, '/', lpTokenPriceD1);
    //     assert.equal(lpTokenPriceN1.toString(), lpTokenPriceN0.toString());
    //     assert.equal(lpTokenPriceD1.toString(), lpTokenPriceD0.toString());
    //
    //     assertBNAlmostEqual((await basicToken.balanceOf.call(traderpool.address)), toBN(30).mul(decimals).sub(riskyTradeAmount));
    //     assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN('0'));
    //     assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), riskyTradeAmount.mul(toBN(998)).div(toBN(1000)));  // comission
    //     assertBNAlmostEqual((await riskToken2.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));
    //
    //     console.log("price before move ",  (await getTokenPrice(riskToken1)).toString());
    //
    //     // let shiftAmount = toBN(1000).mul(billion).mul(decimals);
    //     let shiftAmount = toBN(1000).mul(decimals);
    //     let shifter = accounts[0];
    //     const riskTokenPriceBeforeMove = await getTokenPrice(riskToken1);
    //     await moveRiskPriceDown(shiftAmount, shifter, riskToken1);
    //     const riskTokenPriceAfterMove = await getTokenPrice(riskToken1);
    //     console.log('riskToken1.balanceOf.call(shifter): ', (await riskToken1.balanceOf.call(shifter)).toString());
    //
    //     console.log("riskTokenPriceBeforeMove:", riskTokenPriceBeforeMove.toString());
    //     console.log("riskTokenPriceAfterMove:", riskTokenPriceAfterMove.toString());
    //     assert(riskTokenPriceAfterMove.lt(riskTokenPriceBeforeMove), "price should decrease");
    //
    //     // sell 100% risk token
    //     const riskyTradeAmountSell = await riskToken1.balanceOf.call(traderpool.address);
    //     assertBNAlmostEqual(riskyTradeAmountSell, riskyTradeAmount.mul(toBN(998)).div(toBN(1000)));  // fee
    //     console.log("riskyTradeAmountSell: ", riskyTradeAmountSell.toString());
    //
    //     // sell risky token
    //     path = [riskToken1.address, basicToken.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmountSell,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEventsCustomDecode(tx, allDeployedContracts);
    //     printEvents(tx, "swap: risky1 -> basic");
    //
    //     // check that lp price did not change
    //     let lpTokenPriceN2 = await traderpool.REMOVEgetCurrentLpTokenPriceN.call();
    //     let lpTokenPriceD2 = await traderpool.REMOVEgetCurrentLpTokenPriceD.call();
    //     console.log("lpTokenPriceN2/lpTokenPriceD2:", lpTokenPriceN2.toString(), '/', lpTokenPriceD2.toString());
    //     assertBNAlmostEqual(lpTokenPriceN2, lpTokenPriceN0);  // todo why it's not 100% same
    //     assertBNAlmostEqual(lpTokenPriceD2, lpTokenPriceD0);
    //     // assert.equal(lpTokenPriceN2.toString(), toBN(lpTokenPriceN0).toString());
    //     // assert.equal(lpTokenPriceD2.toString(), toBN(lpTokenPriceN0).toString());
    //
    //     let risky1BalanceOfTraderPool = await riskToken1.balanceOf.call(traderpool.address);
    //     assert.equal(risky1BalanceOfTraderPool.toString(), toBN(0).toString());
    //
    //     let LPbalanceOfuser0 = await TraderLPT.balanceOf.call(users[0]);
    //     let deltaBalance = LPbalanceOfuser0.sub(deposit_amount);
    //     console.log("LP balance at start: ", deposit_amount.toString());
    //     console.log("LP balance at finish:", LPbalanceOfuser0.toString());
    //     console.log("riskTokenPriceAfterMove.sub(riskTokenPriceBeforeMove): ", riskTokenPriceAfterMove.sub(riskTokenPriceBeforeMove).toString());
    //     let expected = riskyTradeAmountSell.mul(riskTokenPriceAfterMove.sub(riskTokenPriceBeforeMove)).div(riskTokenPriceBeforeMove).mul(lpTokenPriceD0).div(lpTokenPriceN0);
    //     assert(deltaBalance.lt(toBN(0)), "should: " + deltaBalance.toString());
    //     assertBNAlmostEqual100(deltaBalance, expected);  // todo: 100% accuracy
    // });

    it('Test admin allow, buy risk, user allow, both buy, share profit', async () => {
        const usersAndTrader = [accounts[1], accounts[2], traderWallet];
        const users = [accounts[1], accounts[2]];
        const deposit_amount = toBN(10).mul(decimals);
        for(const u of usersAndTrader) {
            await basicToken.approve.sendTransaction(traderpool.address, deposit_amount, {'from': u});
            await traderpool.deposit.sendTransaction(deposit_amount, {'from': u});
            assert.equal((await TraderLPT.balanceOf.call(u)).toString(), deposit_amount.toString());
        }

        assert.equal((await basicToken.balanceOf.call(traderpool.address)).toString(), toBN(30).mul(decimals).toString());
        assert.equal((await anotherToken.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
        assert.equal((await riskToken1.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());
        assert.equal((await riskToken2.balanceOf.call(traderpool.address)).toString(), toBN(0).toString());

        let maxPositionAmount = await traderpool.getMaxPositionOpenAmount.call();
        console.log("maxPositionAmount: ",maxPositionAmount.toString());

        // proposal
        tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});
        printEvents(tx, "createProposal")

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
        printEvents(tx, "swap1: basic -> risky1")

        let shiftAmount = toBN(1000).mul(decimals);
        let shifter = accounts[0];

        await moveRiskPriceUp(shiftAmount, shifter, riskToken1);
        console.log('riskToken1.balanceOf.call(shifter): ', (await riskToken1.balanceOf.call(shifter)).toString());
        console.log("price after move ", (await getTokenPrice(riskToken1)).toString());

        // users[0] allowance
        tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, toBN(10).mul(decimals), {'from': users[0]});
        printEvents(tx, "setAllowanceForProposal")

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
        printEvents(tx, "swap2: basic -> risky1")

        assertBNAlmostEqual((await basicToken.balanceOf.call(traderpool.address)), toBN(30).mul(decimals).sub(riskyTradeAmount));
        assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN('0'));
        // assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), riskyTradeAmount.mul(toBN(998)).div(toBN(1000)));  // comission
        assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), toBN('124774961274931'));  // todo
        assertBNAlmostEqual((await riskToken2.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));

        console.log("price before move ",  (await getTokenPrice(riskToken1)).toString());
        await moveRiskPriceUp(shiftAmount, shifter, riskToken1);
        console.log('riskToken1.balanceOf.call(shifter): ', (await riskToken1.balanceOf.call(shifter)).toString());
        console.log("price after move ", (await getTokenPrice(riskToken1)).toString());

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
        printEventsCustomDecode(tx, allDeployedContracts);
        printEvents(tx, "swap3: risky1 -> basic");

        // check they share profit

        let risky1BalanceOfTraderPool = await riskToken1.balanceOf.call(traderpool.address);
        assert.equal(risky1BalanceOfTraderPool.toString(), toBN(0).toString());

        let LPbalanceOfUser0 = await TraderLPT.balanceOf.call(users[0]);
        let LPbalanceOfTrader = await TraderLPT.balanceOf.call(traderWallet);
        let deltaBalanceUser = LPbalanceOfUser0.sub(deposit_amount);
        let deltaBalanceAdmin = LPbalanceOfTrader.sub(deposit_amount);

        // assert(deltaBalanceAdmin.eq())// todo math

        let expected = riskyTradeAmount.div(toBN(2));
        assert(deltaBalanceUser.gt(toBN(0)), "deltaBalanceUser.gt(toBN(0)) failed");
        assert(deltaBalanceAdmin.gt(toBN(0)), "deltaBalanceAdmin.gt(toBN(0)) failed");
        // todo math
        // assert(deltaBalance.sub(expected).mul(toBN(100)).div(expected).abs().lte(toBN(1)),
        //     "too small delta_balance: " + deltaBalance.toString());

    })

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
    //     const user0Allowance = toBN(10).mul(decimals);
    //     const user1Allowance = toBN(20).mul(decimals);
    //
    //     tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, user0Allowance, {'from': users[0]});
    //     printEvents(tx, "setAllowanceForProposal by users[0]")
    //
    //     tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, user1Allowance, {'from': users[1]});
    //     printEvents(tx, "setAllowanceForProposal by users[1]")
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
    //     // todo
    //     // assert.equal((await riskyToken.balanceOf(traderpool.address)), (1.5*riskyTradeAmount).toInt());
    //     // const totalLockedLp = traderpool.totalLockedLp.call();
    //     // const expected = (riskyTradeAmount * (1 + 0.5/0.5)).toInt();
    //     // assert.equal(abs(totalLockedLp-expected) / expected, ALPHA);
    //
    //     let shiftAmount = toBN(1000).mul(decimals);
    //     let shifter = accounts[0];
    //     await moveRiskPriceUp(shiftAmount, shifter, riskToken1);
    //     console.log("price after move ", (
    //     await uniswapRouter.getAmountsOut.call(decimals, [riskToken1.address, basicToken.address]))[0].toString());
    //
    //     // sell risky token
    //     path = [riskToken1.address, basicToken.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmountSell,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEventsCustomDecode(tx, allDeployedContracts);
    //     printEvents(tx, "swap: risky1 -> basic");
    //
    //     let risky1BalanceOfTraderPool = await riskToken1.balanceOf.call(traderpool.address);
    //     assert.equal(risky1BalanceOfTraderPool.toString(), toBN(0).toString());
    //
    //     // todo
    //     //   check users[0] and users[1] shared profit
    //
    //     // let LPbalanceOfuser0 = await TraderLPT.balanceOf.call(users[0]);
    //     // let LPbalanceOfuser1 = await TraderLPT.balanceOf.call(users[1]);
    //     // let deltaBalance = LPbalanceOfuser0.sub(deposit_amount);
    //     // let expected = riskyTradeAmount.div(toBN(2));
    //     // assert(deltaBalance.lt(toBN(0)), "too big delta_balance (should be positive): " + deltaBalance.toString());
    //     // assert(deltaBalance.sub(expected).mul(toBN(100)).div(expected).abs().lte(toBN(1)),
    //     //     "too small delta_balance: " + deltaBalance.toString());
    // });

    // it('profit by risk trading for 1th user and loss for 2nd', async () => {/*todo*/});
    //
    // it('profit by risk trading takes into account current lp price move', async () => {
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
    //
    // it('profit on riskToken1, loss on riskToken2', async () => {
    //     let tx;
    //
    //     // createProposal 1
    //     tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});
    //
    //     // createProposal 2
    //     tx = await traderpool.createProposal.sendTransaction(riskToken2.address, {'from': traderWallet});
    //
    //     const riskyTradeAmount = toBN(1) * decimals;
    //
    //     // buy risk1
    //     path = [basicToken.address, riskToken1.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmount,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEvents(tx, "swap: basic -> risky1")
    //
    //     // buy risk2
    //     path = [basicToken.address, riskToken1.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmount,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEvents(tx, "swap: basic -> risky2")
    //
    //     let shiftAmount = toBN(1000).mul(decimals);
    //     let shifter = accounts[0];
    //     await moveRiskPriceUp(shiftAmount, shifter, riskToken1);
    //     await moveRiskPriceDown(shiftAmount, shifter, riskToken2);
    //
    //     // sell 1
    //     path = [riskToken1.address, basicToken.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmount,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEvents(tx, "swap: risky1 -> basic")
    //
    //     // sell 2
    //     path = [riskToken2.address, basicToken.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmount,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEvents(tx, "swap: risky2 -> basic")
    //
    //     // todo check LP balances
    // });
    //
    // it('liquidate riskToken1', async () => {
    //     let tx;
    //
    //     // createProposal
    //     tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});
    //
    //     // buy risk1
    //     path = [basicToken.address, riskToken1.address];
    //     tx = await uniswapExhangeTool.swapExactTokensForTokens.sendTransaction(
    //         traderpool.address,
    //         riskyTradeAmount,
    //         toBN(0),
    //         path,
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {from: traderWallet}
    //     );
    //     printEvents(tx, "swap: basic -> risky1")
    //
    //     // include to whiteList
    //
    //     // deny any operation before converting to white
    //
    //     // assume state was updated correctly
    // });
    //
    // it('100 trades, measure aggregated errors in calculations', async () => {});
    //
    // it('add risk token to whiteList, move riskSubPool into the general pool', async () => {
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
    //     // buy another token
    //     let path = [anotherToken.address, basicToken.address];
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
    //     assertBNAlmostEqual((await basicToken.balanceOf.call(traderpool.address)), toBN(30).mul(decimals));
    //     assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN('9881383789778015406'));  // todo discuss
    //     // assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN(10).mul(decimals));
    //     assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));
    //     assertBNAlmostEqual((await riskToken2.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));
    //     // assert.equal((await basicToken.balanceOf.call(traderpool.address)).toString(), toBN(30).mul(decimals).toString());
    //     // assert.equal((await anotherToken.balanceOf.call(traderpool.address)).toString(), toBN(10).mul(decimals).toString());
    //     // assert.equal((await riskToken1.balanceOf.call(traderpool.address)).toString(), toBN(0).mul(decimals).toString());
    //     // assert.equal((await riskToken2.balanceOf.call(traderpool.address)).toString(), toBN(0).mul(decimals).toString());
    //
    //     tx = await traderpool.createProposal.sendTransaction(riskToken1.address, {'from': traderWallet});
    //     printEvents(tx, "createProposal")
    //
    //     tx = await traderpool.setAllowanceForProposal.sendTransaction(riskToken1.address, toBN(10).mul(decimals), {'from': users[0]});
    //     printEvents(tx, "setAllowanceForProposal")
    //
    //     const riskyTradeAmount = decimals.div(toBN(10000));  // 0.0001
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
    //     printEvents(tx, "swap: basic -> risky1")
    //
    //     assertBNAlmostEqual((await basicToken.balanceOf.call(traderpool.address)), toBN(30).mul(decimals));
    //     assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN('9881383789778015406'));  // todo discuss
    //     // assertBNAlmostEqual((await anotherToken.balanceOf.call(traderpool.address)), toBN(10).mul(decimals));
    //     assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), toBN('99799999999999'));
    //     // assertBNAlmostEqual((await riskToken1.balanceOf.call(traderpool.address)), riskyTradeAmount);
    //     assertBNAlmostEqual((await riskToken2.balanceOf.call(traderpool.address)), toBN(0).mul(decimals));
    //
    //     console.log("accounts[0] balance of basicToken: ", (await basicToken.balanceOf(accounts[0])).toString());
    //     console.log("accounts[0] balance of riskToken1: ", (await riskToken1.balanceOf(accounts[0])).toString());
    //
    //     console.log("price before move ", (
    //         await uniswapRouter.getAmountsOut.call(trillion, [riskToken1.address, basicToken.address]))[0].toString());
    //
    //     // let shiftAmount = toBN(1000).mul(billion).mul(decimals);
    //     let shiftAmount = toBN(1000).mul(decimals);
    //     let shifter = accounts[0];
    //     console.log('riskToken1.balanceOf.call(shifter): ', (await riskToken1.balanceOf.call(shifter)).toString());
    //     await riskToken1.approve.sendTransaction(uniswapRouter.address, shiftAmount, {'from': shifter});
    //     tx = await uniswapRouter.swapExactTokensForTokens.sendTransaction(
    //         shiftAmount,
    //         toBN(0),
    //         [riskToken1.address, basicToken.address],
    //         users[0],
    //         Math.round((new Date().getTime() + (2 * 24 * 60 * 60 * 1000))/1000),
    //         {'from': shifter}
    //     )
    //     printEvents(tx, "swap to move price down");
    //     console.log('riskToken1.balanceOf.call(shifter): ', (await riskToken1.balanceOf.call(shifter)).toString());
    //
    //     console.log("price after move ", (
    //         await uniswapRouter.getAmountsOut.call(decimals, [riskToken1.address, basicToken.address]))[0].toString());
    //
    //     const riskyTradeAmountSell = await riskToken1.balanceOf.call(traderpool.address);
    //     console.log("riskyTradeAmountSell: ", riskyTradeAmountSell.toString());
    //
    //     // todo add to white list
    //
    //     // call moveRiskSubPoolToGeneralPool
    //
    //     // todo sell risky token and check the result
    // });
});

