

# def test_deploy(tradingPool, tokenA, tokenB, tokenC, accounts, lpToken, riskyToken, baseToken, swapper):
#     assert tradingPool.baseToken() == baseToken.address
#     assert tradingPool.lpToken() == lpToken.address
#     assert tradingPool.riskyToken() == riskyToken.address
#     assert tradingPool.swapper() == swapper.address


def test_swaps(tradingPool, tokenA, tokenB, tokenC, accounts, lpToken, riskyToken, baseToken, swapper, users):
    assert tradingPool.baseToken() == baseToken.address
    assert tradingPool.lpToken() == lpToken.address
    assert tradingPool.riskyToken() == riskyToken.address
    assert tradingPool.swapper() == swapper.address

    swappable = [tokenA, tokenB, tokenC, riskyToken, baseToken]
    for fromTokenIndex, fromToken in enumerate(swappable):
        for toTokenIndex, toToken in enumerate(swappable):
            if fromTokenIndex >= toTokenIndex:
                continue
            swapper.setPrice(fromToken, toToken, 10**18, 10**18)  # 1 to 1

    deposit_amount = 10 * 10**18
    for u in users:
        baseToken.approve(tradingPool.address, deposit_amount, {'from': u})
        tradingPool.deposit(deposit_amount, {'from': u})
        assert lpToken.balanceOf(u) == deposit_amount

    assert baseToken.balanceOf(tradingPool.address) == 30 * 10 ** 18
    assert tokenA.balanceOf(tradingPool.address) == 0
    assert tokenB.balanceOf(tradingPool.address) == 0
    assert tokenC.balanceOf(tradingPool.address) == 0
    assert riskyToken.balanceOf(tradingPool.address) == 0

    trader = accounts[0]
    tradingPool.swap(baseToken, tokenA, 10*10**18, 10*10**18, {'from': trader})
    assert baseToken.balanceOf(tradingPool.address) == 20 * 10 ** 18
    assert tokenA.balanceOf(tradingPool.address) == 10 * 10 ** 18

    tradingPool.allowLpTokensForRiskyTrading(10*10**18, {'from': users[0]})
    riskyTradeAmount = 1 * 10 ** 18
    tradingPool.buyRiskyToken(riskyTradeAmount, riskyTradeAmount, {'from': trader})
    assert riskyToken.balanceOf(tradingPool.address) == riskyTradeAmount

    swapper.setPrice(riskyToken.address, baseToken.address, 2, 1)  # 1 risky ~ 2 base
    tradingPool.sellRiskyToken(riskyTradeAmount, 2 * riskyTradeAmount, {'from': trader})
    assert riskyToken.balanceOf(tradingPool.address) == 0

    assert lpToken.balanceOf(users[0]) == deposit_amount + riskyTradeAmount
