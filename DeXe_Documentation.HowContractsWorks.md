# DeXe Documetation. How Uniswap works

#draft
<!--
https://uniswap.org/static/402f9d4fd5e78d4a7977a938e69343f2/5e6fc/anatomy.jpg
-->
![](img/img02.png)

*DeXe* works on Uniswap V2 technology.
**Uniswap** is an *automated liquidity* protocol powered by a [constant product formula](Dexe_Documentation.Glossary.md) and implemented in a system of non-upgradeable smart contracts on the *Ethereum blockchain*. It obviates the need for trusted intermediaries, prioritizing **decentralization**, **censorship resistance**, and **security**. 


<!--
**Uniswap** is open-source software licensed under the [GPL](https://en.wikipedia.org/wiki/GNU_General_Public_License).
-->

Each *DeXe* platform Contract   is a smart contract, or pair, manages a liquidity pool made up of reserves of two [ERC-20](https://eips.ethereum.org/EIPS/eip-20) tokens.

Anyone can become a `Liquidity Provider` (LP) for a pool by depositing an equivalent value of each underlying token in return for pool tokens. These tokens track pro-rata LP shares of the total reserves, and can be redeemed for the underlying assets at any time.

<!--
https://uniswap.org/static/94f9a497b001a6b27df2c37adadc05b4/824f2/lp.jpg
>
-->
![](img/img01.png)

Pairs act as automated market makers, standing ready to accept one token for the other as long as the *“constant product”* formula is preserved. This formula, most simply expressed as ` x * y = k`, states that trades must not change the product (`k`) of a pair’s reserve balances (`x` and `y`). Because `k` remains unchanged from the reference frame of a trade, it is often referred to as the invariant. This formula has the desirable property that larger trades (relative to reserves) execute at exponentially worse rates than smaller ones.

In practice, *DeXe* contract applies a **0.30%** fee to trades, which is added to reserves. As a result, each trade actually increases `k`. This functions as a payout to *LP*s, which is realized when they burn their pool tokens to withdraw their portion of total reserves. In the future, this fee may be reduced to **0.25%**, with the remaining **0.05%** withheld as a protocol-wide charge.
<!--
https://uniswap.org/static/44107880cfc491ce551133741015ac19/4eea2/trade.jpg
-->

![](img/img04.png)

Because the relative price of the two pair assets can only be changed through trading, divergences between the Uniswap price and external prices create arbitrage opportunities. This mechanism ensures that Uniswap prices always trend toward the market-clearing price.


