#
# ALPHA = 1e-6
#
# def test_deploy(tradingPoolNaive, tokenA, tokenB, tokenC, accounts, lpToken, riskyToken, baseToken, swapper):
#     assert tradingPoolNaive.baseToken() == baseToken.address
#     assert tradingPoolNaive.lpToken() == lpToken.address
#     assert tradingPoolNaive.riskyToken() == riskyToken.address
#     assert tradingPoolNaive.swapper() == swapper.address
#
#
# def test_profit_risk_trade(tradingPoolNaive, tokenA, tokenB, tokenC, accounts, lpToken, riskyToken, baseToken, swapper, users):
#     assert tradingPoolNaive.baseToken() == baseToken.address
#     assert tradingPoolNaive.lpToken() == lpToken.address
#     assert tradingPoolNaive.riskyToken() == riskyToken.address
#     assert tradingPoolNaive.swapper() == swapper.address
#
#     swappable = [tokenA, tokenB, tokenC, riskyToken, baseToken]
#     for fromTokenIndex, fromToken in enumerate(swappable):
#         for toTokenIndex, toToken in enumerate(swappable):
#             if fromTokenIndex >= toTokenIndex:
#                 continue
#             swapper.setPrice(fromToken, toToken, 10**18, 10**18)  # 1 to 1
#
#     deposit_amount = 10 * 10**18
#     for u in users:
#         baseToken.approve(tradingPoolNaive.address, deposit_amount, {'from': u})
#         tradingPoolNaive.deposit(deposit_amount, {'from': u})
#         assert lpToken.balanceOf(u) == deposit_amount
#
#     assert baseToken.balanceOf(tradingPoolNaive.address) == 30 * 10 ** 18
#     assert tokenA.balanceOf(tradingPoolNaive.address) == 0
#     assert tokenB.balanceOf(tradingPoolNaive.address) == 0
#     assert tokenC.balanceOf(tradingPoolNaive.address) == 0
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == 0
#
#     trader = accounts[0]
#     tradingPoolNaive.swap(baseToken, tokenA, 10*10**18, 10*10**18, {'from': trader})
#     assert baseToken.balanceOf(tradingPoolNaive.address) == 20 * 10 ** 18
#     assert tokenA.balanceOf(tradingPoolNaive.address) == 10 * 10 ** 18
#
#     tradingPoolNaive.allowLpTokensForRiskyTrading(10*10**18, {'from': users[0]})
#     riskyTradeAmount = int(0.0001 * 10 ** 18)
#     tradingPoolNaive.buyRiskyToken(riskyTradeAmount, riskyTradeAmount, {'from': trader})
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == riskyTradeAmount
#
#     swapper.setPrice(riskyToken.address, baseToken.address, 2*10**18, 1*10**18)  # 1 risky ~ 2 base
#     tx = tradingPoolNaive.sellRiskyToken(riskyTradeAmount, 2 * riskyTradeAmount, {'from': trader})
#     # print(f'{list(dict(e.items()) for e in tx.events)=}')
#
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == 0
#
#     delta_balance = lpToken.balanceOf(users[0]) - deposit_amount
#     assert delta_balance > 0 and abs(delta_balance - riskyTradeAmount) / riskyTradeAmount < 0.01
#
#
# def test_loss_risk_trade(tradingPoolNaive, tokenA, tokenB, tokenC, accounts, lpToken, riskyToken, baseToken, swapper, users):
#     assert tradingPoolNaive.baseToken() == baseToken.address
#     assert tradingPoolNaive.lpToken() == lpToken.address
#     assert tradingPoolNaive.riskyToken() == riskyToken.address
#     assert tradingPoolNaive.swapper() == swapper.address
#
#     swappable = [tokenA, tokenB, tokenC, riskyToken, baseToken]
#     for fromTokenIndex, fromToken in enumerate(swappable):
#         for toTokenIndex, toToken in enumerate(swappable):
#             if fromTokenIndex >= toTokenIndex:
#                 continue
#             swapper.setPrice(fromToken, toToken, 10**18, 10**18)  # 1 to 1
#
#     deposit_amount = 10 * 10**18
#     for u in users:
#         baseToken.approve(tradingPoolNaive.address, deposit_amount, {'from': u})
#         tradingPoolNaive.deposit(deposit_amount, {'from': u})
#         assert lpToken.balanceOf(u) == deposit_amount
#
#     assert baseToken.balanceOf(tradingPoolNaive.address) == 30 * 10 ** 18
#     assert tokenA.balanceOf(tradingPoolNaive.address) == 0
#     assert tokenB.balanceOf(tradingPoolNaive.address) == 0
#     assert tokenC.balanceOf(tradingPoolNaive.address) == 0
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == 0
#
#     trader = accounts[0]
#     tradingPoolNaive.swap(baseToken, tokenA, 10*10**18, 10*10**18, {'from': trader})
#     assert baseToken.balanceOf(tradingPoolNaive.address) == 20 * 10 ** 18
#     assert tokenA.balanceOf(tradingPoolNaive.address) == 10 * 10 ** 18
#
#     tradingPoolNaive.allowLpTokensForRiskyTrading(10*10**18, {'from': users[0]})
#     riskyTradeAmount = int(0.0001 * 10 ** 18)
#     tradingPoolNaive.buyRiskyToken(riskyTradeAmount, riskyTradeAmount, {'from': trader})
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == riskyTradeAmount
#
#     swapper.setPrice(riskyToken.address, baseToken.address, 10**18, 2*10**18)  # price go down to: 2 risky ~ 1 base
#     tx = tradingPoolNaive.sellRiskyToken(riskyTradeAmount, int(riskyTradeAmount/2), {'from': trader})
#     # print(f'{list(dict(e.items()) for e in tx.events)=}')
#
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == 0
#
#     delta_balance = lpToken.balanceOf(users[0]) - deposit_amount
#     expected = -riskyTradeAmount/2
#     assert delta_balance < 0 and abs(delta_balance - expected) / expected < 0.01
#
#
# def test_profit_2_profit_trades_by_2_isolated_users(tradingPoolNaive, tokenA, tokenB, tokenC, accounts, lpToken, riskyToken, baseToken, swapper, users):
#     assert tradingPoolNaive.baseToken() == baseToken.address
#     assert tradingPoolNaive.lpToken() == lpToken.address
#     assert tradingPoolNaive.riskyToken() == riskyToken.address
#     assert tradingPoolNaive.swapper() == swapper.address
#
#     swappable = [tokenA, tokenB, tokenC, riskyToken, baseToken]
#     for fromTokenIndex, fromToken in enumerate(swappable):
#         for toTokenIndex, toToken in enumerate(swappable):
#             if fromTokenIndex >= toTokenIndex:
#                 continue
#             swapper.setPrice(fromToken, toToken, 10**18, 10**18)  # 1 to 1
#
#     deposit_amount = 10 * 10**18
#     for u in users:
#         baseToken.approve(tradingPoolNaive.address, deposit_amount, {'from': u})
#         tradingPoolNaive.deposit(deposit_amount, {'from': u})
#         assert lpToken.balanceOf(u) == deposit_amount
#
#     assert baseToken.balanceOf(tradingPoolNaive.address) == 30 * 10 ** 18
#     assert tokenA.balanceOf(tradingPoolNaive.address) == 0
#     assert tokenB.balanceOf(tradingPoolNaive.address) == 0
#     assert tokenC.balanceOf(tradingPoolNaive.address) == 0
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == 0
#
#     trader = accounts[0]
#     user1 = users[0]
#     user2 = users[1]
#     tradingPoolNaive.swap(baseToken, tokenA, 10*10**18, 10*10**18, {'from': trader})  # trade1 on whiteList token
#     assert baseToken.balanceOf(tradingPoolNaive.address) == 20 * 10 ** 18
#     assert tokenA.balanceOf(tradingPoolNaive.address) == 10 * 10 ** 18
#
#     smallAmount = int(1e-9 * 10 ** 18)
#     riskyTradeAmount = smallAmount
#
#     tradingPoolNaive.allowLpTokensForRiskyTrading(riskyTradeAmount, {'from': user1})
#     tradingPoolNaive.buyRiskyToken(riskyTradeAmount, riskyTradeAmount, {'from': trader})  # trade2 on risky token
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == riskyTradeAmount
#     assert tradingPoolNaive.totalLockedLp.call() == riskyTradeAmount
#
#     swapper.setPrice(riskyToken.address, baseToken.address, 2*10**18, 1*10**18)  # 1 risky ~ 2 base
#
#     tradingPoolNaive.allowLpTokensForRiskyTrading(int(1.01*riskyTradeAmount), {'from': user2})  # todo 1.01 because price mess up
#     tradingPoolNaive.buyRiskyToken(riskyTradeAmount, riskyTradeAmount/2, {'from': trader})  # user2 receive x/2, trade3 on risky token
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == int(1.5*riskyTradeAmount)
#     totalLockedLp = tradingPoolNaive.totalLockedLp.call()
#     expected = int(riskyTradeAmount * (1 + 0.5/0.5))
#     assert abs(totalLockedLp-expected) / expected < ALPHA
#
#     swapper.setPrice(riskyToken.address, baseToken.address, 4*10**18, 1*10**18)  # 1 risky ~ 4 base
#
#     riskyBalanceBefore = riskyToken.balanceOf(tradingPoolNaive.address)
#
#     minBaseTokenAmount = 4 * riskyTradeAmount
#     baseTokenAmount = tradingPoolNaive.sellRiskyToken.call(riskyTradeAmount, minBaseTokenAmount, {'from': trader})  # trade4 sell 2/3 risky token
#     assert baseTokenAmount == minBaseTokenAmount
#     tx = tradingPoolNaive.sellRiskyToken(riskyTradeAmount, minBaseTokenAmount, {'from': trader})  # trade4 sell 2/3 risky token
#     print(f'{list(e for e in tx.events)=}')
#     assert riskyToken.balanceOf(tradingPoolNaive.address) == int(0.5*riskyTradeAmount)
#
#     # check won amount
#     delta_balance1 = lpToken.balanceOf(user1) - deposit_amount
#     delta_balance2 = lpToken.balanceOf(user2) - deposit_amount
#
#     # todo: discuss why changed
#     # expected1 = riskyTradeAmount * (1 / 1.5) * ((4-1)/1)
#     # expected2 = riskyTradeAmount * (0.5 / 1.5) * ((4-2)/2)
#
#     # expected1 = profile.riskyTokenAmount / riskyBalanceBefore * (baseTokenAmount * currentLpPrice.denominator / currentLpPrice.numerator - totalLockedLp * riskyTokenAmount / riskyBalanceBefore)
#     currentLpPriceInBase = 1  # todo test if not eq
#     expected1 = (1 / 1.5) * (baseTokenAmount / currentLpPriceInBase - totalLockedLp * riskyTradeAmount / riskyBalanceBefore)
#
#     expected2 = (0.5 / 1.5) * (baseTokenAmount / currentLpPriceInBase - totalLockedLp * riskyTradeAmount / riskyBalanceBefore)
#
#     assert delta_balance1 > 0 and abs(delta_balance1 - expected1) / expected1 < ALPHA
#     assert delta_balance2 > 0 and abs(delta_balance2 - expected2) / expected2 < ALPHA
