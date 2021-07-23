import pytest
from brownie import (
    accounts,
    # PoolWithRiskyTokenTradingNaive,
    Token,
    SwapperMock,
    # ERC20PresetMinterPauserOwnerBurnable,
    TraderPoolUpgradeable,
    TraderPoolFactoryUpgradeable,
)


def deploy_erc20(pm, accounts, name, users, swapper):
    token = Token.deploy(name, name, 18, 10**6 * 1e18, {'from': accounts[0]})
    for account in users:
        token.transfer(account, 100 * 1e18, {'from': accounts[0]})
    token.transfer(swapper.address, 1000 * 1e18, {'from': accounts[0]})
    return token


@pytest.fixture
def lpToken(accounts, pm):
    token = Token.deploy('LP', 'LP', 18, 10**6 * 1e18, {'from': accounts[0]})
    # token = ERC20PresetMinterPauserOwnerBurnable.deploy("lpToken", "lpToken", {'from': accounts[0]})
    return token


@pytest.fixture
def swapper(accounts, pm):
    return SwapperMock.deploy({'from': accounts[0]})


@pytest.fixture
def riskyToken(accounts, pm, users, swapper):
    return deploy_erc20(pm, accounts, 'riskyToken', users, swapper)


@pytest.fixture
def baseToken(accounts, pm, users, swapper):
    return deploy_erc20(pm, accounts, 'baseToken', users, swapper)


@pytest.fixture
def tokenA(accounts, pm, users, swapper):
    return deploy_erc20(pm, accounts, 'tokenA', users, swapper)


@pytest.fixture
def tokenB(accounts, pm, users, swapper):
    return deploy_erc20(pm, accounts, 'tokenB', users, swapper)


@pytest.fixture
def tokenC(accounts, pm, users, swapper):
    return deploy_erc20(pm, accounts, 'tokenC', users, swapper)


@pytest.fixture
def tokenRisk(accounts, pm, users, swapper):
    return deploy_erc20(pm, accounts, 'tokenRisk', users, swapper)


@pytest.fixture
def users(accounts):
    return [
        accounts[1],
        accounts[2],
        accounts[3],
    ]


@pytest.fixture()
def tradingPoolNaive(
    baseToken,
    lpToken,
    riskyToken,
    tokenA,
    tokenB,
    tokenC,
    swapper,
    users,
):
    contract = PoolWithRiskyTokenTradingNaive.deploy(
        baseToken.address,
        lpToken.address,
        riskyToken.address,
        swapper.address,
        {'from': accounts[0]},
    )
    for role in [lpToken.DEFAULT_ADMIN_ROLE(), lpToken.MINTER_ROLE(), lpToken.PAUSER_ROLE()]:
        lpToken.grantRole(role, contract.address, {'from': accounts[0]})
    contract.addToken(tokenA.address)
    contract.addToken(tokenB.address)
    contract.addToken(tokenC.address)
    for user in users:
        contract.addUser(user)
    return contract


@pytest.fixture()
def paramkeeper():
    pass


# @pytest.fixture()
# def trader_pool_factory(baseToken):
#     _admin = accounts[0]
#     _traderContractBeaconAddress = accounts[0]
#
#     contract = TraderPoolFactoryUpgradeable.deploy(
#         _admin,
#         _traderContractBeaconAddress,
#         baseToken.address,
#         {'from': accounts[0]},
#     )
#     return contract

ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'


@pytest.fixture()
def trader_pool(baseToken):
    trader_wallet = accounts[0]
    basic_token_address = baseToken.address
    _totalSupply = 0
    commissions = [10, 3, 100, 40, 50, 25]
    _actual = True
    _investorRestricted = False
    _name = "Trader token 1"
    _symbol = "TRT1"
    # contract_address = TraderPoolUpgradeable.createTraderContract(
    #     trader_wallet,
    #     basic_token_address,
    #     _totalSupply,
    #     commissions,
    #     _actual,
    #     _investorRestricted,
    #     _name,
    #     _symbol,
    #     {'from': accounts[0]},
    # )
    # todo contract at

    _admin = accounts[0]
    _traderWallet = accounts[0]

    contract = TraderPoolUpgradeable.deploy({'from': accounts[0]})
    iaddr = [
        _admin,
        _traderWallet,
        basic_token_address,  #basic
        basic_token_address,  # weth?
        ADDRESS_ZERO,  # _paramkeeper,
        ADDRESS_ZERO,  #_positiontoolmanager,
        0,  # _dexeComm,
        0,  # _insurance,
        ADDRESS_ZERO, # _pltTokenAddress,
    ]
    contract.initialize(iaddr, commissions, _actual, _investorRestricted)
    return contract
