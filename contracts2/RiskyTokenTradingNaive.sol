// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.4;
//todo 0.6.0

// пока непонятно, нужно ли включать эту логику в основной пулл
// скорее всего эффективнее по газу будет включить все эти функции в WhiteListPool

/**** ТЕРМИНОЛОГИЯ ****
BASETOKEN - ETH/BSN
*/


/*
залоченные LpToken не конвертируются в РискиТокен
но РискиТокен покупается на свободные BaseToken в WhiteListPool ??? ??? ???
в том количестве (фиксированнов) в котором их дали юзеры

эти BaseToken перечисляются со счета WhiteListPool на RiskyPool в момент открытия position on RiskToken ??? ???
*/


/*
что происходит когда пользователь хочет выйти?
вопрос - сколько нужно наминтить или сжечь токенов ему?
*/


import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ERC20PresetMinterPauser} from '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';


interface ISwapper {
    function priceOf(address tokenFrom, address tokenTo) external view returns(FractionLib.Fraction memory);
    function swap(address tokenFrom, address tokenTo, uint256 amountFrom, uint256 minAmountTo) external returns(uint256);
}

library FractionLib{
    struct Fraction {
        uint256 numerator;
        uint256 denominator;
    }
}

contract SwapperMock {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => FractionLib.Fraction)) internal prices;

    function priceOf(address tokenFrom, address tokenTo) public view returns(FractionLib.Fraction memory result) {
        result = prices[tokenFrom][tokenTo];
    }

    // todo slippage
    function setPrice(address tokenFrom, address tokenTo, uint256 numerator, uint256 denominator) external {
        require(numerator > 0);
        require(denominator > 0);
        prices[tokenFrom][tokenTo] = FractionLib.Fraction(numerator, denominator);
        prices[tokenTo][tokenFrom] = FractionLib.Fraction(denominator, numerator);  // todo discuss
    }

    function swap(
        address tokenFrom, address tokenTo, uint256 amountFrom, uint256 minAmountTo
    ) public returns(uint256) {
        FractionLib.Fraction memory f = prices[tokenFrom][tokenTo];
        require(f.denominator != 0, "zero denominator");
        uint256 amountTo = amountFrom * f.numerator / f.denominator;
        require(amountTo >= minAmountTo, "small amountTo");
        IERC20(tokenFrom).safeTransferFrom(msg.sender, address(this), amountFrom);
        IERC20(tokenTo).safeTransfer(msg.sender, amountTo);
        return amountTo;
    }
}


//interface IERC20MintableBurnable is IERC20 {
//    function mint(address to, uint256 amount) public;
//    function burn(uint256 amount) public;
//    function burnFrom(address account, uint256 amount) public;
//}


contract PoolWithRiskyTokenTradingNaive is Ownable {  // todo extends
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /*
        в качестве токена, на который трейдер совершат покупку RiskyToken будет выступать BaseToken
        todo: что если рейт конвертации baseToken в liquidityToken не постоянный
          а в распоряжение трейдера попадает указанное пользователем количество baseToken из whiteListPool
          при этом liquidityToken закрепляется за ПНЛ Хтокена.
          не будет ли такое, что цена baseToken по отношению к liquidityToken будет постоянно меняться
          и количество закрепленных за ПНЛ-Х liquidityToken нужно постоянно перерассчитывать?
    */

    EnumerableSet.AddressSet internal tokens;
    IERC20 public baseToken;
    ERC20PresetMinterPauser public lpToken;
    IERC20 public riskyToken;
    /* todo maybe its a good idea to cache balances to avoid expensive external balanceOf calls
         but it's less safe
    */

    struct UserInfo{
//        uint256 lpTokenAmount;  // сколько у юзера lp tokens
        uint256 riskyAllowedLp;  // allowance дается в LP tokens  //todo вот тут короче я не уверен
        uint256 lockedLp;  // лочатся в ценах basePrice
        uint256 riskyTokenAmount;  // доля юзера в купленных risky
    }
    uint256 public totalLockedLp;
    uint256 public totalAllowedLp;
    mapping(address => UserInfo) internal userInfo;
    EnumerableSet.AddressSet internal users;

    ISwapper public swapper;  // todo: uniswap

    constructor(address _baseToken, address _lpToken, address _riskyToken, address _swapper){
//        lpToken = new ERC20PresetMinterPauser("LpToken", "LP");  //todo uncomment
        require(_lpToken != address(0), "0 addr");
        lpToken = ERC20PresetMinterPauser(_lpToken);
        require(lpToken.totalSupply() == 0, "lp supply > 0");
        require(_riskyToken != address(0), "0 addr");
        riskyToken = IERC20(_riskyToken);
        require(_baseToken != address(0), "0 addr");
        baseToken = IERC20(_baseToken);
        require(_swapper != address(0), "0 addr");
        swapper = ISwapper(_swapper);
    }

    /*********** white list functions ***************/

    function addToken(address token) public {
        tokens.add(token);
    }

    function removeToken(address token) public {
        tokens.remove(token);
    }

    function addUser(address user) public {
        users.add(user);
    }

    function removeUser(address user) public {
        users.remove(user);
    }

    function deposit(uint256 amount) public returns(uint256) {  // todo very naive, this is responsibility of user here
        uint256 lpSupply = lpToken.totalSupply();
        if (lpSupply == 0) {
            baseToken.safeTransferFrom(msg.sender, address(this), amount);
            lpToken.mint(msg.sender, amount);
            return amount;
        }
        baseToken.safeTransferFrom(msg.sender, address(this), baseToken.balanceOf(address(this)) * amount / lpSupply);
        for(uint256 i=0; i < tokens.length(); ++i) {
            IERC20 token = IERC20(tokens.at(i));
            token.safeTransferFrom(msg.sender, address(this), token.balanceOf(address(this)) * amount / lpSupply);
        }
        lpToken.mint(msg.sender, amount);
        return amount;
    }

    function withdraw(uint256 amount) public returns(uint256) {
        require(amount > 0, "amount is zero");
        uint256 lpSupply = lpToken.totalSupply();
        require(amount <= lpSupply, "amount is too big");
        baseToken.safeTransfer(msg.sender, baseToken.balanceOf(address(this)) * amount / lpSupply);
        for(uint256 i=0; i < tokens.length(); ++i) {
            IERC20 token = IERC20(tokens.at(i));
            token.safeTransfer(msg.sender, token.balanceOf(address(this)) * amount / lpSupply);
        }
        lpToken.burnFrom(msg.sender, amount);
        return amount;
    }

    function swap(address tokenFrom, address tokenTo, uint256 amountFrom, uint256 minAmountTo) public onlyOwner {
        // todo assert tokenFrom in tokens + {baseToken}
        // todo assert tokenTo in tokens + {baseToken}
        IERC20(tokenFrom).safeIncreaseAllowance(address(swapper), amountFrom);
        swapper.swap(tokenFrom, tokenTo, amountFrom, minAmountTo);
    }

    /*********** risky trading functions ***************/

    function allowLpTokensForRiskyTrading(uint256 _lpTokenAmount) external {
        UserInfo storage profile = userInfo[msg.sender];
        require(_lpTokenAmount <= lpToken.balanceOf(msg.sender), "NOT _lpTokenAmount <= lpToken.balanceOf(msg.sender)");  // todo fix
        require(_lpTokenAmount >= profile.lockedLp, "NOT _lpTokenAmount >= profile.lockedLp");  //todo: что если юзер аллоунс меньше то нужно вывести локнутые
        totalAllowedLp = totalAllowedLp - profile.riskyAllowedLp + _lpTokenAmount;
        profile.riskyAllowedLp = _lpTokenAmount;
    }

    /* todo вывод locked LP
        Vitalii Maistrenko BillTrade, [15.06.21 05:34]
        если юзер хочет вывести свои средства с пула отправив Lp обратно в пул
        берем пропорционально с свободных средств пула + пропорционально закрывает все позиции и что получилось отправляем юзеру
        Vitalii Maistrenko BillTrade, [15.06.21 05:35]
        + все расходы по закрытию в этот момент позиций оплачивает юзер что это все затеял
        Vitalii Maistrenko BillTrade, [15.06.21 05:36]
        просто выдавать средства с свободных не вариант так как трейдер оставляет их для усреднения а если мы их отдадим просто юзеру то просто подставим трейдера
    */

    // todo discuss how should it be (and if implements then how) in real life
    function lpTokenPrice() public view returns(FractionLib.Fraction memory) {  //todo too naive implementation (no slippage)
        uint256 totalBaseTokens = baseToken.balanceOf(address(this));
        for(uint256 i=0; i < tokens.length(); i++) {
            IERC20 token = IERC20(tokens.at(i));
            uint256 poolTokenBalance = token.balanceOf(address(this));
            if (poolTokenBalance == 0) {
                continue;
            }
            FractionLib.Fraction memory price = swapper.priceOf(address(token), address(baseToken));
            require(price.denominator > 0, "bad price");
            uint256 baseTokens = poolTokenBalance * price.numerator / price.denominator;
            totalBaseTokens += baseTokens;
        }
        return FractionLib.Fraction(totalBaseTokens, lpToken.totalSupply());
    }

    function getTotalAvailableLpForRiskyTrading() public view returns(uint256) {
        return totalAllowedLp - totalLockedLp;
    }

    function buyRiskyToken(uint256 baseTokenAmount, uint256 minRiskyAmount) external onlyOwner returns(uint256) {
        require(baseToken.balanceOf(address(this)) >= baseTokenAmount, "NOT baseToken.balanceOf(address(this)) >= baseTokenAmount");
        FractionLib.Fraction memory currentLpPrice = lpTokenPrice();

        // хотим залочить лп токены у юзеров
        // tradeLpAmountEquivalent = base / price, сколько стоят эти baseTokenAmount в лпТокенах
        // сколько лп токенов нужно было бы отдать чтобы купить riskyAmount
        uint256 tradeLpAmountEquivalent = baseTokenAmount * currentLpPrice.denominator / currentLpPrice.numerator;  //todo xxx
        // 1000usd - 1laptop
        // apples = 1000 / 10applePrice

        // проверяем что достаточно еще не использованого allowance
        uint256 totalAvailableLp = getTotalAvailableLpForRiskyTrading();
        require(totalAvailableLp >= tradeLpAmountEquivalent, "not enough available Lp");

        // everything is oK, so we lock LP and do swap

        // swap
        baseToken.safeIncreaseAllowance(address(swapper), baseTokenAmount);
        uint256 riskyAmount = swapper.swap(address(baseToken), address(riskyToken), baseTokenAmount, minRiskyAmount);

        for(uint256 i=0; i<users.length(); ++i){
            address user = users.at(i);
            UserInfo storage profile = userInfo[user];
            uint256 userAvailableLp = profile.riskyAllowedLp - profile.lockedLp;
            uint256 shareLockLp = tradeLpAmountEquivalent * userAvailableLp / totalAvailableLp;  // todo discuss dust
            require(shareLockLp <= userAvailableLp, "CRITICAL: shareLockLp is to high");  // this should not be possible! this means data inconsistency
            profile.lockedLp += shareLockLp;
            // price is changing, user1 allow100 buy 100, then user2 allow 100 buy 200
            // todo allowance is fixed
            uint256 shareRiskyAmount = riskyAmount * userAvailableLp / totalAvailableLp;
            profile.riskyTokenAmount += shareRiskyAmount;
        }

        // lock
        totalLockedLp += tradeLpAmountEquivalent;
        return riskyAmount;
    }

    // todo insuranceFund controlled by Gov collects the dust неучтенные токены

    // по идее если происходит loss -> burn то должно происходить уменьшенеие allowance
    // если минтятся lp новые то происходит увеличение allowance

    event E0(string name);
    event E1(string name, uint256 value);
    event E2(string name1, uint256 value1, string name2, uint256 value2);
    event E3(string name1, uint256 value1, string name2, uint256 value2, string name3, uint256 value3);

    function sellRiskyToken(uint256 riskyTokenAmount, uint256 minBaseTokenAmount) external onlyOwner returns(uint256) {
        emit E0("call sellRiskyToken");
        emit E1("riskyTokenAmount", riskyTokenAmount);
        emit E1("minBaseTokenAmount", minBaseTokenAmount);
        
        require(riskyTokenAmount > 0, "NOT riskyTokenAmount > 0");
        uint256 riskyBalanceBefore = riskyToken.balanceOf(address(this));
        emit E1("riskyBalanceBefore", riskyBalanceBefore);
        require(riskyBalanceBefore >= riskyTokenAmount, "NOT riskyToken.balanceOf(address(this)) >= riskyTokenAmount");

        // swap
        riskyToken.safeIncreaseAllowance(address(swapper), riskyTokenAmount);
        uint256 baseTokenAmount = swapper.swap(
                address(riskyToken), address(baseToken),
                riskyTokenAmount, minBaseTokenAmount);
        emit E1("baseTokenAmount", baseTokenAmount);

        // вот мы получили результат в baseToken
        // теперь нужно перевести его в lpToken
        FractionLib.Fraction memory currentLpPrice = lpTokenPrice();  // todo ошибка здесь потому что оценка без бейзТокенов
        emit E1("currentLpPrice.denominator", currentLpPrice.denominator);
        emit E1("currentLpPrice.numerator", currentLpPrice.numerator);

        uint256 tradeLpAmountEquivalent = baseTokenAmount * currentLpPrice.denominator / currentLpPrice.numerator;
        emit E1("tradeLpAmountEquivalent = baseTokenAmount * currentLpPrice.denominator / currentLpPrice.numerator", tradeLpAmountEquivalent);

        // это как раз тот эквивалент который нужно теперь распределить по юзерам
        // по идее конечно надо бы закрывать юзеров которые участвовали в первых сделках первыми
        // потом тех кто вступил в риск сделки позже
        // но это бы усложнило вычисления поэтому мы рассчитываем как бы общий результат

        // сколько было как бы залочено чтобы этот трейд стал возможен

        uint256 releventLockedLpAmount = totalLockedLp * riskyTokenAmount / riskyBalanceBefore;
        emit E1("totalLockedLp", totalLockedLp);
        emit E1("riskyTokenAmount", riskyTokenAmount);
        emit E1("riskyBalanceBefore", riskyBalanceBefore);
        emit E1("releventLockedLpAmount = totalLockedLp * riskyTokenAmount / riskyBalanceBefore", releventLockedLpAmount);

        for(uint256 i=0; i<users.length(); ++i){
            address user = users.at(i);
            UserInfo storage profile = userInfo[user];
            if (profile.riskyTokenAmount == 0) {
                emit E2("user", i, "skip because riskyTokenAmount=", 0);
                continue;
            }
//            uint256 shareRiskyTradeAmount = riskyTokenAmount * profile.riskyTokenAmount / riskyBalanceBefore;
//            uint256 shareRelevantLp = releventLockedLpAmount * shareRiskyTradeAmount / riskyTokenAmount;
//            uint256 shareTradeLpEq = tradeLpAmountEquivalent * shareRiskyTradeAmount / riskyTokenAmount;

            //1
            uint256 shareRelevantLp = releventLockedLpAmount * profile.riskyTokenAmount / riskyBalanceBefore;
            emit E2("user", i, "profile.riskyTokenAmount", profile.riskyTokenAmount);
            emit E2("user", i, "shareRelevantLp = releventLockedLpAmount * profile.riskyTokenAmount / riskyBalanceBefore", shareRelevantLp);
            uint256 shareTradeLpEq = tradeLpAmountEquivalent * profile.riskyTokenAmount / riskyBalanceBefore;
            emit E2("user", i, "shareTradeLpEq = tradeLpAmountEquivalent * profile.riskyTokenAmount / riskyBalanceBefore", shareTradeLpEq);

//            uint256 shareRelevantLp = releventLockedLpAmount * profile.riskyTokenAmount / riskyTokenAmount;
//            emit E2("user", i, "profile.riskyTokenAmount", profile.riskyTokenAmount);
//            emit E2("user", i, "shareRelevantLp = releventLockedLpAmount * profile.riskyTokenAmount / riskyTokenAmount", shareRelevantLp);
//            uint256 shareTradeLpEq = tradeLpAmountEquivalent * profile.riskyTokenAmount / riskyTokenAmount;
//            emit E2("user", i, "shareTradeLpEq = tradeLpAmountEquivalent * profile.riskyTokenAmount / riskyTokenAmount", shareTradeLpEq);

            if (shareRelevantLp > profile.lockedLp) {
                profile.lockedLp = 0;
            } else {
                profile.lockedLp -= shareRelevantLp;
            }

            if (shareTradeLpEq > shareRelevantLp) {
                uint256 x = shareTradeLpEq - shareRelevantLp;
                emit E2("user", i, "mint x", x);
                lpToken.mint(user, x);
                profile.riskyAllowedLp += x;
            } else {  // shareTradeLpEq < shareRelevantLp
                uint256 x = shareRelevantLp - shareTradeLpEq;
                emit E2("user", i, "burn x", x);
                lpToken.burnFrom(user, x);
                profile.riskyAllowedLp -= x;
            }
        }

        // unlock
        totalLockedLp -= releventLockedLpAmount;
        emit E1("totalLockedLp", totalLockedLp);
        return baseTokenAmount;
    }
}
