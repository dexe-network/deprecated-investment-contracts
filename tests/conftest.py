import pytest
from brownie import accounts, PoolWithRiskyTokenTradingNaive, PoolWithRiskyTokenTradingNaive, Token, SwapperMock, ERC20PresetMinterPauserOwnerBurnable


def deploy_erc20(pm, accounts, name, users, swapper):
    token = Token.deploy(name, name, 18, 10**6 * 1e18, {'from': accounts[0]})
    for account in users:
        token.transfer(account, 100 * 1e18, {'from': accounts[0]})
    token.transfer(swapper.address, 1000 * 1e18, {'from': accounts[0]})
    return token


@pytest.fixture
def lpToken(accounts, pm):
    token = ERC20PresetMinterPauserOwnerBurnable.deploy("lpToken", "lpToken", {'from': accounts[0]})
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
def users(accounts):
    return [
        accounts[1],
        accounts[2],
        accounts[3],
    ]


@pytest.fixture()
def tradingPool(
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
