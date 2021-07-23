ALPHA = 1e-6

def test_deploy(trader_pool, riskyToken, accounts, baseToken, lpToken, tokenA, tokenB, tokenC, swapper):
    admin = accounts[0]
    trader = accounts[0]
    user1 = accounts[1]
    user2 = accounts[2]
    users = [user1, user2]

    # assert trader_pool.lpToken.call({'from': admin})

    trader_pool.createProposal(riskyToken)

    deposit_amount = 10 * 10**18
    for u in users:
        baseToken.approve(trader_pool.address, deposit_amount, {'from': u})
        trader_pool.deposit(deposit_amount, {'from': u})
        assert lpToken.balanceOf(u) == deposit_amount

    assert baseToken.balanceOf(trader_pool.address) == 30 * 10 ** 18
    assert tokenA.balanceOf(trader_pool.address) == 0
    assert tokenB.balanceOf(trader_pool.address) == 0
    assert tokenC.balanceOf(trader_pool.address) == 0
    assert riskyToken.balanceOf(trader_pool.address) == 0


    trader = accounts[0]
    trader_pool.swap(baseToken, tokenA, 10*10**18, 10*10**18, {'from': trader})
    assert baseToken.balanceOf(trader_pool.address) == 20 * 10 ** 18
    assert tokenA.balanceOf(trader_pool.address) == 10 * 10 ** 18

    trader_pool.allowLpTokensForRiskyTrading(10*10**18, {'from': users[0]})
    riskyTradeAmount = int(0.0001 * 10 ** 18)
    trader_pool.buyRiskyToken(riskyTradeAmount, riskyTradeAmount, {'from': trader})
    assert riskyToken.balanceOf(trader_pool.address) == riskyTradeAmount

    swapper.setPrice(riskyToken.address, baseToken.address, 2*10**18, 1*10**18)  # 1 risky ~ 2 base
    tx = trader_pool.sellRiskyToken(riskyTradeAmount, 2 * riskyTradeAmount, {'from': trader})
    # print(f'{list(dict(e.items()) for e in tx.events)=}')

    assert riskyToken.balanceOf(trader_pool.address) == 0

    delta_balance = lpToken.balanceOf(users[0]) - deposit_amount
    assert delta_balance > 0 and abs(delta_balance - riskyTradeAmount) / riskyTradeAmount < 0.01


def test_loss_risk_trade(trader_pool, tokenA, tokenB, tokenC, accounts, lpToken, riskyToken, baseToken, swapper, users):
    assert trader_pool.baseToken() == baseToken.address
    assert trader_pool.lpToken() == lpToken.address
    assert trader_pool.riskyToken() == riskyToken.address
    assert trader_pool.swapper() == swapper.address

    swappable = [tokenA, tokenB, tokenC, riskyToken, baseToken]
    for fromTokenIndex, fromToken in enumerate(swappable):
        for toTokenIndex, toToken in enumerate(swappable):
            if fromTokenIndex >= toTokenIndex:
                continue
            swapper.setPrice(fromToken, toToken, 10**18, 10**18)  # 1 to 1

    deposit_amount = 10 * 10**18
    for u in users:
        baseToken.approve(trader_pool.address, deposit_amount, {'from': u})
        trader_pool.deposit(deposit_amount, {'from': u})
        assert lpToken.balanceOf(u) == deposit_amount

    assert baseToken.balanceOf(trader_pool.address) == 30 * 10 ** 18
    assert tokenA.balanceOf(trader_pool.address) == 0
    assert tokenB.balanceOf(trader_pool.address) == 0
    assert tokenC.balanceOf(trader_pool.address) == 0
    assert riskyToken.balanceOf(trader_pool.address) == 0

    trader = accounts[0]
    trader_pool.swap(baseToken, tokenA, 10*10**18, 10*10**18, {'from': trader})
    assert baseToken.balanceOf(trader_pool.address) == 20 * 10 ** 18
    assert tokenA.balanceOf(trader_pool.address) == 10 * 10 ** 18

    trader_pool.allowLpTokensForRiskyTrading(10*10**18, {'from': users[0]})
    riskyTradeAmount = int(0.0001 * 10 ** 18)
    trader_pool.buyRiskyToken(riskyTradeAmount, riskyTradeAmount, {'from': trader})
    assert riskyToken.balanceOf(trader_pool.address) == riskyTradeAmount

    swapper.setPrice(riskyToken.address, baseToken.address, 10**18, 2*10**18)  # price go down to: 2 risky ~ 1 base
    tx = trader_pool.sellRiskyToken(riskyTradeAmount, int(riskyTradeAmount/2), {'from': trader})
    # print(f'{list(dict(e.items()) for e in tx.events)=}')

    assert riskyToken.balanceOf(trader_pool.address) == 0

    delta_balance = lpToken.balanceOf(users[0]) - deposit_amount
    expected = -riskyTradeAmount/2
    assert delta_balance < 0 and abs(delta_balance - expected) / expected < 0.01


def test_profit_2_profit_trades_by_2_isolated_users(trader_pool, tokenA, tokenB, tokenC, accounts, lpToken, riskyToken, baseToken, swapper, users):
    assert trader_pool.baseToken() == baseToken.address
    assert trader_pool.lpToken() == lpToken.address
    assert trader_pool.riskyToken() == riskyToken.address
    assert trader_pool.swapper() == swapper.address

    swappable = [tokenA, tokenB, tokenC, riskyToken, baseToken]
    for fromTokenIndex, fromToken in enumerate(swappable):
        for toTokenIndex, toToken in enumerate(swappable):
            if fromTokenIndex >= toTokenIndex:
                continue
            swapper.setPrice(fromToken, toToken, 10**18, 10**18)  # 1 to 1

    deposit_amount = 10 * 10**18
    for u in users:
        baseToken.approve(trader_pool.address, deposit_amount, {'from': u})
        trader_pool.deposit(deposit_amount, {'from': u})
        assert lpToken.balanceOf(u) == deposit_amount

    assert baseToken.balanceOf(trader_pool.address) == 30 * 10 ** 18
    assert tokenA.balanceOf(trader_pool.address) == 0
    assert tokenB.balanceOf(trader_pool.address) == 0
    assert tokenC.balanceOf(trader_pool.address) == 0
    assert riskyToken.balanceOf(trader_pool.address) == 0

    trader = accounts[0]
    user1 = users[0]
    user2 = users[1]
    trader_pool.swap(baseToken, tokenA, 10*10**18, 10*10**18, {'from': trader})  # trade1 on whiteList token
    assert baseToken.balanceOf(trader_pool.address) == 20 * 10 ** 18
    assert tokenA.balanceOf(trader_pool.address) == 10 * 10 ** 18

    smallAmount = int(1e-9 * 10 ** 18)
    riskyTradeAmount = smallAmount

    trader_pool.allowLpTokensForRiskyTrading(riskyTradeAmount, {'from': user1})
    trader_pool.buyRiskyToken(riskyTradeAmount, riskyTradeAmount, {'from': trader})  # trade2 on risky token
    assert riskyToken.balanceOf(trader_pool.address) == riskyTradeAmount
    assert trader_pool.totalLockedLp.call() == riskyTradeAmount

    swapper.setPrice(riskyToken.address, baseToken.address, 2*10**18, 1*10**18)  # 1 risky ~ 2 base

    trader_pool.allowLpTokensForRiskyTrading(int(1.01*riskyTradeAmount), {'from': user2})  # todo 1.01 because price mess up
    trader_pool.buyRiskyToken(riskyTradeAmount, riskyTradeAmount/2, {'from': trader})  # user2 receive x/2, trade3 on risky token
    assert riskyToken.balanceOf(trader_pool.address) == int(1.5*riskyTradeAmount)
    totalLockedLp = trader_pool.totalLockedLp.call()
    expected = int(riskyTradeAmount * (1 + 0.5/0.5))
    assert abs(totalLockedLp-expected) / expected < ALPHA

    swapper.setPrice(riskyToken.address, baseToken.address, 4*10**18, 1*10**18)  # 1 risky ~ 4 base

    riskyBalanceBefore = riskyToken.balanceOf(trader_pool.address)

    minBaseTokenAmount = 4 * riskyTradeAmount
    baseTokenAmount = trader_pool.sellRiskyToken.call(riskyTradeAmount, minBaseTokenAmount, {'from': trader})  # trade4 sell 2/3 risky token
    assert baseTokenAmount == minBaseTokenAmount
    tx = trader_pool.sellRiskyToken(riskyTradeAmount, minBaseTokenAmount, {'from': trader})  # trade4 sell 2/3 risky token
    print(f'{list(e for e in tx.events)=}')
    assert riskyToken.balanceOf(trader_pool.address) == int(0.5*riskyTradeAmount)

    # check won amount
    delta_balance1 = lpToken.balanceOf(user1) - deposit_amount
    delta_balance2 = lpToken.balanceOf(user2) - deposit_amount

    # todo: discuss why changed
    # expected1 = riskyTradeAmount * (1 / 1.5) * ((4-1)/1)
    # expected2 = riskyTradeAmount * (0.5 / 1.5) * ((4-2)/2)

    # expected1 = profile.riskyTokenAmount / riskyBalanceBefore * (baseTokenAmount * currentLpPrice.denominator / currentLpPrice.numerator - totalLockedLp * riskyTokenAmount / riskyBalanceBefore)
    currentLpPriceInBase = 1  # todo test if not eq
    expected1 = (1 / 1.5) * (baseTokenAmount / currentLpPriceInBase - totalLockedLp * riskyTradeAmount / riskyBalanceBefore)

    expected2 = (0.5 / 1.5) * (baseTokenAmount / currentLpPriceInBase - totalLockedLp * riskyTradeAmount / riskyBalanceBefore)

    assert delta_balance1 > 0 and abs(delta_balance1 - expected1) / expected1 < ALPHA
    assert delta_balance2 > 0 and abs(delta_balance2 - expected2) / expected2 < ALPHA
