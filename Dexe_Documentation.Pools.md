# DeXe Documentation.Pools

## Introduction


A pool is a server that evenly distributes work among the connected computers. They have special calculation techniques that allow to evaluate the individual contribution of each equipment to solving a code or block. According to this ratio, miners get a profit.
Pool allows users to make money by providing liquidity. This is possible by depositing tokens in smart contracts in exchange for pool tokens.

The liquidity pool is an electronic trading platform for a pair of ERC20 tokens. To start trading in a pool, someone has to make an initial deposit of each token. Thus, this first liquidity provider sets the initial pool price. Therefore, it is recommended to add tokens of equal value to the pool. Since when the first liquidity provider places tokens with odds different from the current market rate, it creates a profitable arbitrage opportunity that can be exploited by an outside party.
When other *Liquidity Providers* add to an existing pool, they must deposit pair tokens proportional to the current price. If they don’t, the liquidity they added is at risk of being arbitraged as well. If they believe the current price is not correct, they may arbitrage it to the level they desire, and add liquidity at that price.


## Pool tokens

Whenever liquidity is deposited into a pool, unique tokens known as liquidity tokens are minted and sent to the provider’s address. These tokens represent a given liquidity provider’s contribution to a pool. The proportion of the pool’s liquidity provided determines the number of liquidity tokens the provider receives. If the provider is minting a new pool, the number of liquidity tokens they will receive will equal sqrt(x * y), where x and y represent the amount of each token provided.

Whenever a trade occurs, a 0.3% fee is charged to the transaction sender. This fee is distributed pro-rata to all LPs in the pool upon completion of the trade.

To retrieve the underlying liquidity, plus any fees accrued, liquidity providers must “burn” their liquidity tokens, effectively exchanging them for their portion of the liquidity pool, plus the proportional fee allocation.

As liquidity tokens are themselves tradable assets, liquidity providers may sell, transfer, or otherwise use their liquidity tokens in any way they see fit.



When liquidity is deposited into a *pool*, unique tokens known as *liquidity tokens* are created and sent to the provider's address. These tokens represent the contribution of the given *liquidity provider* to the *pool*. The share of the provided liquidity in the pool determines the number of liquidity tokens that the provider will receive. If the provider creates a new pool, the number of liquidity tokens they will receive will be `sqrt (x * y)`, where `x` and `y` represent the amount of each provided token. Simultaneously, each time a transaction is made, a commission of `0.3%` is charged from the sender. This fee will be distributed proportionately across all liquidity providers in the pool upon completion of the trade. To receive basic liquidity, as well as any fees charged, liquidity providers must “burn” their liquidity tokens. To do this, you need to effectively exchange them for your part of the liquidity pool plus proportional distribution of commissions. Because the Liquidity tokens are themselves tradable assets, liquidity providers can sell, transfer or otherwise use their liquidity tokens in any way they see fit. 

> Learn more with advanced topics:

<!--
Understanding Returns

Fees
-->


## Why pools?

The peculiarity of the *Uniswap* platform is that it does not use the order book to determine the price of an asset or compare buyers and sellers of tokens. Instead, it uses what are called liquidity pools. Liquidity is usually represented by individual orders placed by individuals on a centrally managed order book. A participant looking to provide liquidity or create markets needs to actively manage their orders. To do this, you need to constantly update them in response to the actions of other market participants. 

While order books are the basis for funding and work great in certain cases, they suffer from several important limitations, which are especially magnified when applied to a decentralized or native blockchain environment. Order books require intermediate infrastructure for order book placement and order matching. This creates points of control and adds additional levels of difficulty. They also require active participation and management by market makers, who usually use complex infrastructure and algorithms, limiting the participation of advanced traders. Since order books were invented earlier with relatively small assets trading, they are not ideal for an ecosystem where everyone can create their own token. These tokens usually have low liquidity. 

*Uniswap* focuses on the strengths of Ethereum to reimagine the token swap. A blockchain-based liquidity protocol must take advantage of a trusted code execution environment, an autonomous and always running virtual machine, and an open, unrestricted and pervasive access model that creates an exponentially growing virtual asset ecosystem. It's important to remember that a pool is just a smart contract that is controlled by users who call functions on it. The exchange of tokens causes an exchange in the instance of the pool contract, while providing liquidity causes a deposit. End users can interact with the *Uniswap* protocol through an interface (which, in turn, interacts with the underlying contracts). Developers can interact directly with smart contracts and integrate *Uniswap* functionality into their own applications without requiring permission or relying on any intermediaries. 


<!-- ## Developer resources

To see how to pool tokens in a smart contract read Providing Liquidity. -->