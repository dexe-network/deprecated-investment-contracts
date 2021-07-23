//// SPDX-License-Identifier: Unlicensed
//pragma solidity 0.8.4;
//
//// пока непонятно, нужно ли включать эту логику в основной пулл
//// скорее всего эффективнее по газу будет включить все эти функции в WhiteListPool
//
///**** ТЕРМИНОЛОГИЯ ****
//BASETOKEN - ETH/BSN
//*/
//
//
///*
//залоченные LpToken не конвертируются в РискиТокен
//но РискиТокен покупается на свободные BaseToken в WhiteListPool
//в том количестве (фиксированнов) в котором их дали юзеры
//
//эти BaseToken перечисляются со счета WhiteListPool на RiskyPool в момент открытия position on RiskToken
//*/
//
//
///*
//что происходит когда пользователь хочет выйти?
//вопрос - сколько нужно наминтить или сжечь токенов ему?
//*/
//
//
//
//
//
//// v2
///*
//Vitalii Maistrenko BillTrade, [03.06.21 11:08]
//LP токены должны лочится в риск пуле в момент открытия   трейдером рискованой позиции
//дальше при закрытии позиции возвращаемое юзеру количество токенов это количество основного ресурса полученого от закрития позитии пропорционально количеству локнутых этому юзеру токенов разделенное на текущую цену LP токена
//
//
//к примеру у юзера было 400 LP
//юзер закинул на риск трейдинг
//200 LP с ценой одного LP 1$
//трейдер открыл рискованую сделку на 100 LP даного юзера
//
//в момент закрытия сделки цена LP изменилась к примеру от трейдинга в основном пуле и составляет 2$
//
//рискованую сделку трейдер закрыл с профитом х10
//cчвсть юзера на его 100 локнутых LP составляет 1000$
//
//100 LP токенов юзера что были локнуты превращаются в
//
//1000$/2$ = 500 LP (нужно довыпустить и начислить 400 LP)
//
//таким образом количество токенов юзера равняется
//(400 LP - 100 LP) + 1000$/2$ = 800 LP
//
//Vitalii Maistrenko BillTrade, [03.06.21 11:10]
//то что мы тогда придумали что в основном пуле нужно что б юзер получал профит только на оставшиеся токены верно но вот для этого количество токенов юзера не нужно уменьшать или увеличивать эту задачу какраз решает лок токенов при открытой позиции в риск токене и изменение его количества по результатам
//
//Vitalii Maistrenko BillTrade, [15.06.21 05:34]
//если юзер хочет вывести свои средства с пула отправив Lp обратно в пул
//берем пропорционально с свободных средств пула + пропорционально закрывает все позиции и что получилось отправляем юзеру
//
//Vitalii Maistrenko BillTrade, [15.06.21 05:35]
//+ все расходы по закрытию в этот момент позиций оплачивает юзер что это все затеял
//
//Vitalii Maistrenko BillTrade, [15.06.21 05:36]
//просто выдавать средства с свободных не вариант так как трейдер оставляет их для усреднения а если мы их отдадим просто юзеру то просто подставим трейдера
//*/
//
//
//contract  RiskyTokenTrading {  // todo extends
//    public IERC20 lpToken;
//    public IERC20 riskToken;
//    public IERC20 baseToken;
//
//    /*
//        в качестве токена, на который трейдер совершат покупку RiskyToken будет выступать BaseToken
//        todo: что если рейт конвертации baseToken в liquidityToken не постоянный
//          а в распоряжение трейдера попадает указанное пользователем количество baseToken из whiteListPool
//          при этом liquidityToken закрепляется за ПНЛ Хтокена.
//          не будет ли такое, что цена baseToken по отношению к liquidityToken будет постоянно меняться
//          и количество закрепленных за ПНЛ-Х liquidityToken нужно постоянно перерассчитывать?
//    */
//
//    struct UserInfo{
//        uint256 nextTradeIndex;
//        uint256 riskyTokenAmount;
//        uint256 allowedBaseTokenAmount;
//        uint256 lockedLpTokenAmount;
//        uint256 unusedBaseTokenAmount;
//    }
//    private mapping(address => UserInfo) userInfo;
//
//
//    address swapper; // uniswap
//
//    // сколько трейдер выйграл на risky trading
//    // когда юзер будет дергать кранк новые токены будут минтится отсюда
//    uint256 wonBaseTokenAmount;
//
//    /*
//    при этом трейдер может динамически менять количество купленных Х токенов?
//    тогда придется держать массив в сторадже trades
//    и когда пользователь хочет снять свой выйгрышь итерироваться по нему чтобы понять сколько он выйграл или проиграл
//    с учетом его доли в трейдингеХ и с учетом количества купленных/проданных Х в каждом трейде
//    see explanations in _recalculateUserDeposit
//    */
//    // нужно как-бы посчитать долю каждого юзера в риск-трейде
//    // на риск трейд будет потрачено Х бейзтокенов
//    // в тот момент фиксируется
//    struct RiskTrade {
//        bool isBuyRiskyToken;  // true=buy, false=sell
//        uint256 poolLpTokenAmountBeforeTrade;  // нужно для оценки доли юзера с его Lp токенами в этом трейде
//          // todo возможно нужно использовать BaseTokens
//        uint256 poolRiskyTokenAmountBeforeTrade;
//        uint256 poolUnusedBaseTokenAmountBeforeTrade;
//        uint256 tradeBaseTokenAmount;
//        uint256 tradeRiskyTokenAmount;
//    }
//    // после успешного трейда allowance lpTokens for risk trade from User не меняется,
//    //   новые Lp идут ему на основной баланс
//    private uint256 riskyTokenAmount;  // общее колво купленных токенов на данный момент
//    private uint256 lpTokenAmount;  // общее колво lp токенов allowed на данный момент
//    // тут еще есть тонкий момент с тем что покупаем riskToken мы не на LpToken а на BaseToken пропоцрионально доле в пуле
//    //   и в разные моменты времени LpToken соответствует разному количество BaseToken
//    RiskTrade[] private[] trades;  // history of trades sorted by time
//
//    function recalculateUserInfo(uint256 maxIterations) external onlyTrader noReentrant {
//        _recalculateUserDeposit(msg.sender, maxIterations);
//    }
//
//    // todo increase or set?
//    function allowLpToken(uint256 _lpTokenAmount) external onlyTrader noReentrant {
//        /*
//        LP токены должны лочится в риск пуле в момент открытия трейдером рискованой позиции
//        */
//        require(
//            _recalculateUserDeposit(msg.sender, 100),
//            "TOO_MANY_UNPROCESSED_ITERATIONS, out-of-gas danger, call recalculateUserInfo over trades manually");
//
//        require(userLpAllowance[msg.sender] == 0, "increase is not implemented yet");  // todo increase or set
//        userLpAllowance[msg.sender] = _lpTokenAmount;
//        _totalLpAllowance += _lpTokenAmount;
//        _unusedLpAllowance += _lpTokenAmount;
//
//        UserInfo memory profile = userInfo[msg.sender];
//        profile.allowedBaseTokenAmount += _lpTokenAmount;
//        profile.unusedBaseTokenAmount += _lpTokenAmount;
//        userInfo[msg.sender] = profile;
//
//        emit UserDeposited(proportionalLpToken, gotRiskyToken);
//    }
//
//    function _recalculateUserDeposit(address user, uint256 maxIterations) internal returns(bool noMoreIterations) {
//        /* pre: на каждой сделке нужно представить что сделки RiskyTokenPool совершал пользователь
//            самостоятельно пропорционально своей доле
//
//           t0. представим что в момент времени t0 было в РискиПуле L[t0] лпТокенов и R[t0] рискиТокенов
//           при этом 1 рискиТокен = Price[t0] лпТокенов (todo discuss slippages)
//
//           t1. в момент t0 заходит юзер с X токенами, тогда пулл нужно ребалансировать в соотношении L[t0] / R[t0]*Price[t0]
//           тогда сразу после транзакции стейт должен стать
//           L[t1] = L[t0] +  Х * L[t0] / (L[t0] + R[t0]*Price[t0])
//           R[t1] = R[t0] + Х * R[t0]*Price[t0] / (L[t0] + R[t0]*Price[t0])
//           покупка РискиТокенов за лпТокен происходит в момент входа в РискиПул
//           >>> ВОПРОС СО СЛИПИДЖАМИ <<<
//           пока короче для простоты считаем что нет слипаджа
//
//           // как выводить средства пользователю если часть их в РискиПуле находятся в виде лпТокенов,
//           // а часть в виде рискиТокенов? По идее нужно разменять соответствующий шейр в рискиТокенах по маркетПрайс
//           // и отдать юзеру (todo страховка от слипаджа и фронтраннинга minLpAmoun argument)
//
//           то есть для юзера заход в пул равносилен самостоятельной сделке
//           userLpAmount[t1] = X * L[t0] / (L[t0] + R[t0]*Price[t0])
//           userRiskyAmount[t1] = Х * R[t0]*Price[t0] / (L[t0] + R[t0]*Price[t0])
//
//           t2. в момент t2 происходит покупка tradeR[t2] рискиТокенов за tradeLp[t2] LpTokens
//           L[t2] = L[t1] - tradeLp[t2]
//           R[t2] = R[t1] + tradeR[t2]
//
//           что если сразу после этого юзер захочет вывести LpToken из RiskyPool?
//           для него эта сделка at the moment t2 равносильна вот такой
//
//           k = userLpAmount[t1] / L[t1]
//           userLpAmount[t2] = userLpAmount[t1] - k * tradeLp[t2]
//           userRAmount[t2] = userRAmount[t1] + k * tradeR[t2]
//
//           ну то есть мы просто масштабируем трейд на основе части лп токенов
//
//           тогда если юзер захочет сейчас вывести лпТокены просто отдаем ему userLpAmount[t2] и конвертируем по курсу
//           userRAmount[t2]
//           // todo вообще можно и даже не конвертировать а напрямую перевести пользователю RiskyToken пусть делает с ним что хочет
//
//           // todo подумать была бы разница если бы мы в качестве k = userRAmount[t2] / R[t1]
//
//           t3. в момент t3 происходит продажа tradeR[t3] за tradeLp[t3]
//
//           ну соответственно для пользователя это эквивалентно сделке
//           k = userRAmount[t2] / L[t2]
//           userLpAmount[t3] = userLpAmount[t2] + k * tradeLp[t3]
//           userRAmount[t3] = userRAmount[t2] - k * tradeR[t3]
//
//            // note обатите внимание что k теперь мы берем как отношение рискиТокенов, я вот слету не понял
//            // имеет ли смысл запариваться над тем как брать k
//
//           !!!!!! ОБЩЕЕ ИНДУКТИВНОЕ ПРАВИЛО !!!!!!
//           def recalcUser():
//               if directionForRiskyToken == BUY:
//                   k = userLpAmount[i] / L[i]
//                   userLpAmount[i+1] = userLpAmount[i] - k * tradeLp[i]
//                   userRAmount[i+1] = userRAmount[i] + k * tradeR[i]
//                if directionForRiskyToken == SELL:
//                   k = userRAmount[i] / R[i]
//                   userLpAmount[i+1] = userLpAmount[i] + k * tradeLp[i]
//                   userRAmount[i+1] = userRAmount[i] - k * tradeR[i]
//         */
//
//
//        UserInfo memory profile = userInfo[msg.sender];  // this remain const during the whole period of recalculation
//
//        if ((info.lpTokenAmount == 0) && (info.riskyTokenAmount == 0)) {
//        /* если депозита нет то и процессить трейды смысла нет */
//            info.nextTradeIndex = trades.length;
//            userInfo[msg.sender] = info;
//            return true;
//        }
//
//        uint256 iter = 0;
//        for (uint256 tradeIndex = info.nextTradeIndex; tradeIndex < trades.length; ++tradeIndex){
//            // !!!!!!!!!!!!!!!!!!!!!!!!!
//            // важное замечание
//            // что если трейдер после того как сделал риски трейдер
//            // перевел бейз токены на А или Б
//            // что делать с юзером все бейз токены которого потерялись в риски трейдинге
//            // !!!!!!!!!!!!!!!!!!!!!!!!!
//            uint256 baseTokenBalance = 0;
//            uint256 riskyTokenBalance = 0;
//            if (iter >= maxIterations) return false;
//            iter += 1;
//            RiskTrade memory trade = trades[tradeIndex];
//            // todo: instead of complex formulas for `k` store `shares` per user.
//            // todo: use BaseToken share instead of LP
//            if (trade.isBuyRiskyToken){  // Buy Risky
//                uint256 shareTradeBaseTokenAmount = trade.tradeBaseTokenAmount * profile.unusedBaseTokenAmount / trade.poolUnusedBaseTokenAmountBeforeTrade;
//                uint256 shareTradeRiskyTokenAmount = trade.tradeRiskyTokenAmount * profile.unusedBaseTokenAmount / trade.poolUnusedBaseTokenAmountBeforeTrade;
//                profile.unusedBaseTokenAmount -= shareTradeBaseTokenAmount;
//                profile.riskyTokenAmount += shareTradeRiskyTokenAmount;
//            } else { // Sell Risky
//                uint256 shareTradeBaseTokenAmount = trade.tradeBaseTokenAmount * profile.riskyTokenAmount / trade.poolRiskyTokenAmountBeforeTrade;
//                uint256 shareTradeRiskyTokenAmount = trade.tradeRiskyTokenAmount * profile.riskyTokenAmount / trade.poolRiskyTokenAmountBeforeTrade;
//                profile.unusedBaseTokenAmount += shareTradeBaseTokenAmount;
//                profile.riskyTokenAmount -= shareTradeRiskyTokenAmount;
//            }
//        }
//        return true;
//    }
//
//    // снимает долю пользователя  todo: partial withdraw
//    function withdrawShare() external onlyTrader noReentrant {
//        /*
//        дальше при закрытии позиции возвращаемое юзеру количество токенов это
//        количество основного ресурса полученого от закрития позитии пропорционально
//        количеству локнутых этому юзеру токенов разделенное на текущую цену LP токена
//        */
//
//        require(
//            _recalculateUserDeposit(msg.sender, 100),
//            "TOO_MANY_UNPROCESSED_ITERATIONS, out-of-gas danger, call recalculateUserInfo over trades manually");
//
//        UserInfo memory profile = userInfo[msg.sender];
//
//        withdrawRiskyAmount = profile.riskyTokenAmount;
//        uint256 baseTokenAmountFromRisky = swapper.swap([riskyToken, baseToken], withdrawRiskyAmount);
//        withdrawBaseAmount = profile.unusedBaseTokenAmount + baseTokenAmountFromRisky;
//        baseToken.safeTransfer(msg.sender, totalLp);
//        emit ShareWithdrawn(/*...*/);
//    }
//
//
//    event ProposalCreated(/*...*/);
//    event UserVotedAndLockedBaseToken(/*...*/);  // todo should be in Governance
//    event ProposalYes(uint256 allowedBaseTokenAmount);  // todo in governance ?
//    event ProposalNoBecauseTimeout();  // todo in governance
//    event ProposalNoBecauseVotes();  // todo in governance
//    event RiskyTokenTradingOffered(address riskyToken, uint256 minTraderShare);
//    function offerRiskyTokenTrading(/*...*/) external onlyTrader noReentrant;
//
//
//    function buyRiskyTokenForLp(uint256 swapBaseTokenAmount, uint256 minRiskyAmount) {
//        uint256 baseTokenAllowance = _unusedLpAllowance * pool.balanceOf(baseToken) / pool.totalLpTokenSupply;
//        require(baseTokenAllowance >= swapBaseTokenAmount, "not enough base tokens");
//        uint256 usedLpTokenAllowance = swapBaseTokenAmount * pool.totalLpTokenSupply / pool.balanceOf(baseToken);
//        _unusedLpAllowance -= usedLpTokenAllowance;
//
//        baseToken.safeTransferFrom(mainPool, address(this), swapBaseTokenAmount);
//        uint256 swapRiskyAmount = uniswap.swap([baseToken, riskyToken], swapBaseTokenAmount, minRiskyAmount);
//        trades.append(RiskTrade({
//            isBuyRiskyToken: true,
//            poolAllowedLpTokenAmountBeforeTrade: lpTokenAmount,
//            poolRiskyTokenAmountBeforeTrade: riskyTokenAmount,
//            tradeLpTokenAmount: swapLpTokenAmount,
//            tradeRiskyTokenAmount: swapRiskyAmount
//        }));
//        lpTokenAmount -= swapLpTokenAmount;
//        riskyTokenAmount += swapRiskyAmount;
//    }
//
//    function sellRiskyTokenForBase(uint256 swapRiskyTokenAmount, uint256 minBaseAmount) {
//        uint256 swapBaseTokenAmount = uniswap.swap([baseToken, riskyToken], swapRiskyTokenAmount, minBaseAmount);
////        trades.append(RiskTrade({
////            isBuyRiskyToken: false,
////            poolAllowedLpTokenAmountBeforeTrade: lpTokenAmount,
////            poolRiskyTokenAmountBeforeTrade: riskyTokenAmount,
////            tradeLpTokenAmount: swapLpTokenAmount,
////            tradeRiskyTokenAmount: swapRiskyTokenAmount
////        }));
////        lpTokenAmount += swapLpTokenAmount;
////        riskyTokenAmount -= swapRiskyAmount;
//    }
//}
//
///*
//
//как конвертация базового токена (например ЕТХ) происходит в ликвидити токен?
//
//getLpAmount = AmountETH *
//
//как конв
//
//*/