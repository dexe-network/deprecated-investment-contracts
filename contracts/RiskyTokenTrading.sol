// пока непонятно, нужно ли включать эту логику в основной пулл
// скорее всего эффективнее по газу будет включить все эти функции в WhiteListPool

/**** ТЕРМИНОЛОГИЯ ****
BASETOKEN - ETH/BSN
*/


/*
залоченные LpToken не конвертируются в РискиТокен
но РискиТокен покупается на свободные BaseToken в WhiteListPool
в том количестве (фиксированнов) в котором их дали юзеры

эти BaseToken перечисляются со счета WhiteListPool на RiskyPool
и при покупке RiskyToken конвертируются через ЮниСвоп
*/


/*
что по поводу shares?
когда пользователь заносит X baseToken
а в пулле в этот момент A BaseToken и B RiskyToken
какой у него share?
предположим трейдер докупает Z RiskyToken за Q baseToken
тогда эта сделка засчитывается юзеру как X * Q / (X + B)
аналогично при продаже (но доля считается по тому, сколько за пользователем числится РискиТокенов)

интересный момент:
t0: L[0] Lp                   R[0] Risky
t1: L[1]=L[0]-T[1].LP         R[1]=R[0]+T[1].R     buy Risky
t2: L[2]=L[1]+UserEnter       R[2]=R[1]            user enter RiskyPool
t3: L[3]=L[2]-T[3].LP         R[3]=R[2]+T[3].R     buy more Risky   (some Risky counts for User)
t4:                           R[4]=0, T[4].R=-R[r] sell all Risky
закрытие сделки на весь объем отражается на пользователе только с того момента как он вошел


lets say, user entered the pool with L0 LPToknes ~ B0 BaseTokens




when Trader moves funds between tokens in WhitePool
this should not count for locked BaseTokens funds in RiskyPool

вся идея таких пулов в том что все владеют в равных пропорциях всем балансом
и сделки засчитываются всем исходя из их доли
а тут получается что когда трейдер делает покупку на БейзТокен в ВайтПуле
она как бы не происходит для тех юзеров для которых БейзТокены были залочены
даже еще сложнее, она происходит но в доле (UserLpToken/AllLpToken*AllBaseTokens - LockedUserBaseTokens) / AllBaseTokens






что происходит когда пользователь хочет выйти?
пробегаемся по всем trades
получаем B BaseToken, R riskyTokens которые получены по сделкам
смотрим в UserInfo
отделяем от РискиПула B and R
convert R to BaseToken
finally user has Bexit = B+Rswapped BaseTokens

а заходил он с B0 BaseTokens

вопрос - сколько нужно наминтить или сжечь токенов ему?


if B0 < Bexit:
    # seems easy
    newLP := WhitePool.enter(Bexit)
    transfer newLP to User


if B0 > Bexit:
    lost = B0 - Bexit
    # у всех юзеров так e.g.
    # 2000 baseToken, 3000 Atoken, 6000 Btoken    ~ 2000 LP
    # у нашего юзера который лочил baseToken, делал типа сделки вслед за RiskyPool пропорционально своей доле и потерял токены, теперь так
    # 100 baseToken, 300 Atoken, 600 Btoken       ~ раньше было 200LP но теперь дизбаланс
    # нужно перевести баланс с других токенов в baseToken до того момента пока пропорции не станут такие же, как у остальных юзеров
    # станет как-то так
    # 130 base     195 A        390 B             ~ теперь 130LP

    #нужно сделать этот перевод и сжечь LP tokens



at enter time:
   WhitePool Tbase, T1, T2

at exit time:
   балансы всех токенов WhitePool изменились
   пропорции поменялись чтобы



*/


contract  RiskyTokenTrading {  // todo extends

    /*
        в качестве токена, на который трейдер совершат покупку RiskyToken будет выступать LpToken
        т.к. если бы выступал underlyingToken то см. замечание ниже

        если рейт конвертации baseToken в liquidityToken не постоянный
        а в распоряжение трейдера попадает указанное пользователем количество baseToken из whiteListPool
        при этом liquidityToken закрепляется за ПНЛ Хтокена

        не будет ли такое, что цена baseToken по отношению к liquidityToken будет постоянно меняться
        и количество закрепленных за ПНЛ-Х liquidityToken нужно постоянно перерассчитывать?
    */
    // todo: remove, userInfo will be used , see explanations in _recalculateUserDeposit
    //    private mapping(address => uint256) userLockedLpTokenAmounts;


    /* здесь будет время с которого юзер еще не получал вознаграждение */
    // todo: remove, userInfo will be used see explanations in _recalculateUserDeposit
    //    private mapping(address => uint256) userClaimableTimeStart;  // maybe use indexOf trades

    struct UserInfo{
        uint256 nextTradeIndex;
        uint256 lpTokenAmount;
        uint256 riskyTokenAmount;
        // todo: share
    }
    private mapping(address => UserInfo) userInfo;


    address lpSwapper; // умный контракт конвертирующий lpToken в рискиТокен и обратно,
    // там должен происходить withdraw lpTokens из whiteListPool в underlyingToken и потом обмен на юнисвоп underlying -> risky


    /*
    при этом трейдер может динамически менять количество купленных Х токенов?
    тогда придется держать массив в сторадже trades
    и когда пользователь хочет снять свой выйгрышь итерироваться по нему чтобы понять сколько он выйграл или проиграл с учетом его доли в трейдингеХ и с учетом количества купленных/проданных Х в каждом трейде
    see explanations in _recalculateUserDeposit
    */
    struct Trade {
        bool isBuyRiskyToken;  // true=buy, false=sell
        uint256 poolLpTokenAmountBeforeTrade;
        uint256 poolRiskyTokenAmountBeforeTrade;
        uint256 tradeLpTokenAmount;
        uint256 tradeRiskyTokenAmount;
    }
    private uint256 riskyTokenAmount;  // общее колво купленных токенов на данный момент
    private uint256 lpTokenAmount;  // общее колво lp токенов in the RiskyPool на данный момент
    Trade[] private[] trades;  // history of trades sorted by time

    function recalculateUserInfo(uint256 maxIterations) external onlyTrader noReentrant {
        _recalculateUserDeposit(msg.sender, maxIterations);
    }

    function depositLpToken(uint256 _depositLpTokenAmount) external onlyTrader noReentrant {
        require(
            _recalculateUserDeposit(msg.sender, 100),
            "TOO_MANY_UNPROCESSED_ITERATIONS, out-of-gas danger, call recalculateUserInfo over trades manually");

        lpToken.safeTransferFrom(msg.sender, address(this), _depositLpTokenAmount);
        riskyTokenEquivalentInLpTokens = lpSwapper.calculateRiskyInLp(lpRiskyTokenAmount)  // сколько будут стоит риски Токены пула в ЛпТокен

        uint256 proportionalLpToken = _depositLpTokenAmount * lpTokenAmount / (lpTokenAmount + riskyTokenEquivalentInLpTokens);
        uint256 proportionalConvertToRiskyToken = _depositLpTokenAmount - proportionalLpToken;

        lpToken.approve(0);
        lpToken.approve(address(lpSwapper), proportionalConvertToRiskyToken);
        gotRiskyToken = lpSwapper.swapLpToRisky(proportionalConvertToRiskyToken);

        UserInfo memory profile = userInfo[msg.sender];
        profile.lpTokenAmount += proportionalLpToken;
        profile.riskyTokenAmount += gotRiskyToken;
        userInfo[msg.sender] = profile;

        emit UserDeposited(proportionalLpToken, gotRiskyToken);
    }

    function _recalculateUserDeposit(address user, uint256 maxIterations) internal returns(bool noMoreIterations) {
        /* pre: на каждой сделке нужно представить что сделки RiskyTokenPool совершал пользователь
            самостоятельно пропорционально своей доле

           t0. представим что в момент времени t0 было в РискиПуле L[t0] лпТокенов и R[t0] рискиТокенов
           при этом 1 рискиТокен = Price[t0] лпТокенов (todo discuss slippages)

           t1. в момент t0 заходит юзер с X токенами, тогда пулл нужно ребалансировать в соотношении L[t0] / R[t0]*Price[t0]
           тогда сразу после транзакции стейт должен стать
           L[t1] = L[t0] +  Х * L[t0] / (L[t0] + R[t0]*Price[t0])
           R[t1] = R[t0] + Х * R[t0]*Price[t0] / (L[t0] + R[t0]*Price[t0])
           покупка РискиТокенов за лпТокен происходит в момент входа в РискиПул
           >>> ВОПРОС СО СЛИПИДЖАМИ <<<
           пока короче для простоты считаем что нет слипаджа

           // как выводить средства пользователю если часть их в РискиПуле находятся в виде лпТокенов,
           // а часть в виде рискиТокенов? По идее нужно разменять соответствующий шейр в рискиТокенах по маркетПрайс
           // и отдать юзеру (todo страховка от слипаджа и фронтраннинга minLpAmoun argument)

           то есть для юзера заход в пул равносилен самостоятельной сделке
           userLpAmount[t1] = X * L[t0] / (L[t0] + R[t0]*Price[t0])
           userRiskyAmount[t1] = Х * R[t0]*Price[t0] / (L[t0] + R[t0]*Price[t0])

           t2. в момент t2 происходит покупка tradeR[t2] рискиТокенов за tradeLp[t2] LpTokens
           L[t2] = L[t1] - tradeLp[t2]
           R[t2] = R[t1] + tradeR[t2]

           что если сразу после этого юзер захочет вывести LpToken из RiskyPool?
           для него эта сделка at the moment t2 равносильна вот такой

           k = userLpAmount[t1] / L[t1]
           userLpAmount[t2] = userLpAmount[t1] - k * tradeLp[t2]
           userRAmount[t2] = userRAmount[t1] + k * tradeR[t2]

           ну то есть мы просто масштабируем трейд на основе части лп токенов

           тогда если юзер захочет сейчас вывести лпТокены просто отдаем ему userLpAmount[t2] и конвертируем по курсу
           userRAmount[t2]
           // todo вообще можно и даже не конвертировать а напрямую перевести пользователю RiskyToken пусть делает с ним что хочет

           // todo подумать была бы разница если бы мы в качестве k = userRAmount[t2] / R[t1]

           t3. в момент t3 происходит продажа tradeR[t3] за tradeLp[t3]

           ну соответственно для пользователя это эквивалентно сделке
           k = userRAmount[t2] / L[t2]
           userLpAmount[t3] = userLpAmount[t2] + k * tradeLp[t3]
           userRAmount[t3] = userRAmount[t2] - k * tradeR[t3]

            // note обатите внимание что k теперь мы берем как отношение рискиТокенов, я вот слету не понял
            // имеет ли смысл запариваться над тем как брать k

           !!!!!! ОБЩЕЕ ИНДУКТИВНОЕ ПРАВИЛО !!!!!!
           def recalcUser():
               if directionForRiskyToken == BUY:
                   k = userLpAmount[i] / L[i]
                   userLpAmount[i+1] = userLpAmount[i] - k * tradeLp[i]
                   userRAmount[i+1] = userRAmount[i] + k * tradeR[i]
                if directionForRiskyToken == SELL:
                   k = userRAmount[i] / R[i]
                   userLpAmount[i+1] = userLpAmount[i] + k * tradeLp[i]
                   userRAmount[i+1] = userRAmount[i] - k * tradeR[i]
         */


        UserInfo memory profile = userInfo[msg.sender];

        if ((info.lpTokenAmount == 0) && (info.riskyTokenAmount == 0)) {
        /* если депозита нет то и процессить трейды смысла нет */
            info.nextTradeIndex = trades.length;
            userInfo[msg.sender] = info;
            return true;
        }

        uint256 iter = 0;
        for (uint tradeIndex = info.nextTradeIndex; tradeIndex < trades.length; ++tradeIndex){
            if (iter >= maxIterations) return false;
            iter += 1;
            Trade memory trade = trades[tradeIndex];
            // todo: instead of complex formulas for `k` store `shares` per user.
            if (trade.isBuyRiskyToken){  // Buy Risky
                uint256 newProfileLpAmount = profile.lpTokenAmount - trade.tradeLpTokenAmount * profile.lpTokenAmount / trade.poolLpTokenAmountBeforeTrade;
                uint256 newProfileRiskyTokenAmount = profile.riskyTokenAmount + trade.tradeRiskyTokenAmount * profile.lpTokenAmount / trade.poolLpTokenAmountBeforeTrade;
                profile.lpTokenAmount = newProfileLpAmount;
                profile.riskyTokenAmount = newProfileRiskyTokenAmount;
            } else { // Sell Risky
                uint256 newProfileLpTokenAmount = profile.lpTokenAmount + trade.tradeLpTokenAmount * profile.riskyTokenAmount / trade.poolRiskyTokenAmountBeforeTrade;
                uint256 newProfileRiskyTokenAmount = profile.riskyTokenAmount - trade.tradeRiskyTokenAmount * profile.riskyTokenAmount / trade.poolRiskyTokenAmountBeforeTrade;
                profile.lpTokenAmount = newProfileLpAmount;
                profile.riskyTokenAmount = newProfileRiskyTokenAmount;
            }
        }
        return true;
    }

    // снимает какую-то долю шейра юзера
    // todo вообще эту функицию нужно заменить наверное на указание кол-ва лп токенов который хочет снять юзер
    // и из этого числа высчитывать какую долю шейра снимать
    function withdrawShare(uint256 shareNumerator, uint256 shareDenominator) external onlyTrader noReentrant {
        require(
            _recalculateUserDeposit(msg.sender, 100),
            "TOO_MANY_UNPROCESSED_ITERATIONS, out-of-gas danger, call recalculateUserInfo over trades manually");

        UserInfo memory profile = userInfo[msg.sender];

        withdrawLpAmount = profile.lpTokenAmount * shareNumerator / shareDenominator;
        withdrawRiskyAmount = profile.riskyTokenAmount * shareNumerator / shareDenominator;

        uint256 swapLp = lpSwapper.convertRiskyToLp(withdrawRiskyAmount);
        uint256 totalLp = withdrawLpAmount + swapLp;
        lpToken.safeTransfer(msg.sender, totalLp);
        emit ShareWithdrawn(/*...*/);
    }


    event ProposalCreated(/*...*/);
    event UserVotedAndLockedBaseToken(/*...*/);  // todo should be in Governance
    event ProposalYes(uint256 allowedBaseTokenAmount);  // todo in governance ?
    event ProposalNoBecauseTimeout();  // todo in governance
    event ProposalNoBecauseVotes();  // todo in governance
    event RiskyTokenTradingOffered(address riskyToken, uint256 minTraderShare);
    function offerRiskyTokenTrading(/*...*/) external onlyTrader noReentrant;


    function buyRiskyTokenForLp(uint256 swapLpTokenAmount, uint256 minRiskyAmount) {
        uint256 swapRiskyAmount = uniswap.swap([lpToken, riskyToken], swapLpTokenAmount, minRiskyAmount);
        trades.append(Trade({
            isBuyRiskyToken: true,
            poolLpTokenAmountBeforeTrade: lpTokenAmount,
            poolRiskyTokenAmountBeforeTrade: riskyTokenAmount,
            tradeLpTokenAmount: swapLpTokenAmount,
            tradeRiskyTokenAmount: swapRiskyAmount
        }));
        lpTokenAmount -= swapLpTokenAmount;
        riskyTokenAmount += swapRiskyAmount;
    }

    function sellRiskyTokenForLp(uint256 swapRiskyTokenAmount, uint256 minLpAmount) {
        uint256 swapLpTokenAmount = uniswap.swap([riskyToken, lpToken], swapRiskyTokenAmount, minLpAmount);
        trades.append(Trade({
            isBuyRiskyToken: false,
            poolLpTokenAmountBeforeTrade: lpTokenAmount,
            poolRiskyTokenAmountBeforeTrade: riskyTokenAmount,
            tradeLpTokenAmount: swapLpTokenAmount,
            tradeRiskyTokenAmount: swapRiskyTokenAmount
        }));
        lpTokenAmount += swapLpTokenAmount;
        riskyTokenAmount -= swapRiskyAmount;
    }
}

/*

как конвертация базового токена (например ЕТХ) происходит в ликвидити токен?

getLpAmount = AmountETH *

как конв

*/