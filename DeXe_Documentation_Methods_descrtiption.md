# DeXe Documentation. Methods' description 
#b21200115d
<!---
{{TOC}}
+++
--->
## Methods

### Module *TraderPool.sol*

Path to module [contracts/TraderPool.sol](contracts/TraderPool.sol) 

#### *init*

```solidity
function init(address _traderWallet, address _basicToken, address _pltAddress, bool _isFixedSupply, uint8 _tcNom, uint8 _tcDenom, bool _actual) public onlyOwner
```
Init function. Invoked by the Factory when TraderPool is created.

---

#### *init2*

```solidity
function init2(address _dexeComm, address _insurance, address _paramkeeper, address _positiontoolmanager) public onlyOwner
```
Throws if called by any account other than the one with the Manager role granted.

---

#### *addTraderAddress*

```solidity
function addTraderAddress (address _traderAddress) public onlyTrader
```
Adds new trader address (tokens received from this address considered to be the traders' tokens)

---

#### *removeTraderAddress*

```solidity
function removeTraderAddress (address _traderAddress) public onlyTrader
```
Removes trader address (tokens received from trader address considered to be the traders' tokens)

---

#### *preparePosition*

```solidity
function preparePosition(uint8 _manager, address _toToken, uint256 _amount, uint256 _deadline) public onlyTrader returns (uint256)
```
Prepare position for trade (not actually used, stays here for back compatibility.)

<!-- `return _praparePosition(_manager, address(basicToken), _toToken, _amount, _deadline);-->

---

#### *openPosition*

```solidity
function openPosition(uint8 _manager, uint16 _index, address _toToken, uint256 _amount, uint256 _deadline) public onlyTrader returns (uint256, uint256)
```
Opens trading position. Swaps a specified amount of Basic Token to Destination Token. 
 
***Input Parameters:*** 

|parameter|type|description|
|:----|:----|:---| 
|_manager|uint8|the ID of the Position Manager contract that will execute trading operation|
|_index|uint16|the index of the Position in the positions array. (closed positions can be overwritten by new positions to save some storage)|
|_toToken|address|the address of the ERC20 token (destination token) to swap BasicToken to.| 
|_amount|uint256|the amount of Basic Token to be swapped to destination token.| 
|_deadline|uint256|the timestamp of the deadline an operation have to complete before. Another way transaction will be reverted.|

---

#### *rewardPosition*


```solidity
function rewardPosition(uint16 _index, uint256 _ltAmount, uint256 _deadline) public onlyTrader returns (uint256)
```
Get *Reward* from the position (not actually used, stays here for back compatibility). Can be used in future

---


#### *exitPosition*

```solidity
function exitPosition(uint16 _index, uint256 _ltAmount, uint256 _deadline) public onlyTrader returns (uint256)
```

Exit trading position. Swaps a specified amount of Destination Token back to Basic Token and calculates finacial result (profit or loss), that affects pool totalCap param. 
  
***Input Parameters:*** 

|parameter|type|description|
|:---|:---|:---|
|_index|uint16|the index of the Position in the positions array.|
|_ltAmount|uint256|the amount of Destination token to be swapped back (position can be partially closed, so this might not equal full LT amount of the position)|
|_deadline|uint256|the timestamp of the deadline an operation have to complete before. Another way transaction will be reverted.|
  
---

#### *adjustTotalCap*

```solidity
function adjustTotalCap() public onlyTrader
```
Method that adjusts `totalCap` higher to be equal to actual amount of *BasicTokens* on the balance of this smart contract. 

---

#### *getPositionTool*

```solidity
function getPositionTool(uint8 _index) external view returns (address)
```
Returns address of the PositionManager contract implementation. The functional contract that is used to operate positions. 

---

#### *withdrawTraderCommission*

```solidity
function withdrawTraderCommission(uint256 amount) public onlyTrader
```
Initiates withdraw of the Trader commission onto the Trader Commission address. Used by Trader to get his commission out from this contract. 

---

#### *setTraderCommissionAddress*

```solidity
function setTraderCommissionAddress(address _traderCommissionAddress) public onlyTrader 
```
Set new `traderCommission` address. The address that trader receives his commission out from this contract. 

---

<!--TODO: apply governance here-->

#### *setExternalCommissionPercent*

```solidity
function setExternalCommissionPercent(uint8 _nom, uint8 _denom) public onlyOwner 
```
Set external commission percent in a form of natural fraction: `_nom|_denom`. 

---

#### *pause*

```solidity
function pause() onlyOwner public
```
Set contract on hold. Paused contract doesn't accepts Deposits but allows to withdraw funds. 

---

#### *unpause*

```solidity
function unpause() onlyOwner public
```
Unpause the contract (enable deposit operations)

---


#### *getAddress*

```solidity
function getAddress(uint16 key) external override view returns (address)
```
Returns address parameter from central parameter storage operated by the platform. Used by PositionManager contracts to receive settings required for performing operations. 

***Input Parameters:*** 

|parameter|type|description|
|:---|:---|:---|
|key|uint16|ID of address parameter|

---

#### *getUInt256*

```solidity
function getUInt256(uint16 key) external override view returns (uint256)
```

Returns `uint256` parameter from central parameter storage operated by the platform. Used by *PositionManager* contracts to receive settings required for performing operations. 

***Input Parameters:*** 

|parameter|type|description|
|:---|:---|:---|
|key|uint16|ID of uint256 parameter|
   
---

#### *getUserData*

```solidity
function getUserData(address holder) public view returns (uint256, uint256, uint256)
```
Returns the data of the User:
1. total amount of BasicTokens deposited (historical value)
* total amount of BasicTokens withdrawn (historical value)
*  current amount of TraderPool liquidity tokens that User has on the balance. 
    
***Input Parameters:***

|parameter|type|description|
|:---|:---|:---|
|holder|address|address of the User's wallet| 

---

#### *getTotalValueLocked*

```solidity
function getTotalValueLocked() public view returns (uint256, uint256)
```

Returns total cap values for this contract: 
1. totalCap value - total capitalization, including profits and losses, denominated in BasicTokens. i.e. total amount of BasicTokens that porfolio is worhs of.
* totalSupply of the TraderPool liquidity tokens (or total amount of trader tokens sold to Users). 
* Trader token current price = totalCap/totalSupply;

---

<!--2nd File -->

### Module *AssetManagerAB.sol*

Path to module [contracts/assets/AssetManagerAB.sol](contracts/assets/AssetManagerAB.sol) 

#### *positionsLength*

```solidity
function positionsLength() external view returns (uint256) 
```
Returns amount of positions in Positions array.

---


#### *positionAt*

```solidity
function positionAt(uint16 _index) external view returns (uint8,uint256,uint256,address)
```
Returns *Position* data from arrat at the `_index` specified. 

***Return data:***
1. *manager* - Position manager tool ID - the tool position was opened with.
* *amountOpened* - the amount of Basic Tokens a position was opened with.
* *liquidity* - the amount of Destination tokens received from exchange when position was opened.
* *token* - the address of ERC20 token that position was opened to, i.e. the position was opened with  `amountOpened` of BasicTokens and resulted in `liquidity` amount of `token`s. 

---

### Module *Pool.sol*

<!--- 3rd File --->

<!--deposit functions-->

Path to module [/contracts/pool/Pool.sol](/contracts/pool/Pool.sol)

#### *receive*

```solidity
receive() payable external isWrappedEth
```

Deposit ETH by direct transfer. Converts to WETH immediately for further operations. Liquidity tokens are assigned to `msg.sender` address.  

---

#### *depositETHTo*

```solidity
function depositETHTo(address to) payable external isWrappedEth
```
Deposit ETH, converts to WETH and assigns Liquidity tokens to provided address.

***Input Parameters:***

|parameter|type|description|
|:---|:---|:---|
|to|address|address to assign liquidity tokens to|

---

#### *depositTo*

```solidity
function depositTo(uint256 amount,address to) external
```
Deposit ERC20 tokens function, assigns Liquidity tokens to provided address.

|parameter|type|description|
|:---|:---|:---|
|to|address|address to assign liquidity tokens to|

---

#### *deposit*

```solidity
function deposit(uint256 amount) external
```

Deposit ERC20 tokens function, assigns Liquidity tokens to `msg.sender` address.

***Input Parameters:***

|parameter|type|description|
|:---|:---|:---|
|to|address|address to assign liquidity tokens to|

---


#### *withdraw*

```solidity
function withdraw(uint256 amount) external
```

Converts spefied amount of Liquidity tokens to Basic Token and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of 
Liquidity tokens. Resulted amount of tokens are transferred to `msg.sender`
 
***Input Parameters:***

|parameter|type|description|   
|:---|:---|:---|
|amount|uint256|amount of liquidity tokens to exchange to Basic token.|

---

#### *withdrawTo*

```solidity
function withdrawTo(uint256 amount,address to) external
```

Converts spefied amount of Liquidity tokens to Basic Token and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of Liquidity tokens. 
Resulted amount of tokens are transferred to specified address

***Input Parameters:***

|parameter|type|description|
|:---|:---|:---|
|amount|uint256|amount of liquidity tokens to exchange to Basic token.|
|to|address|address to send resulted amount of tokens to|

---

#### *withdrawETH*


```solidity
function withdrawETH(uint256 amount) external isWrappedEth
```

Converts spefied amount of Liquidity tokens to WETH, unwraps it and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of Liquidity tokens specidied. Resulted amount of tokens are transferred to `msg.sender`

***Input Parameters:***

|parameter|type|description|
|:---|:---|:---|
|amount|uint256|amount of liquidity tokens to exchange to ETH|

---

#### *withdrawETHTo*

```solidity
function withdrawETHTo(uint256 amount, address payable to) external isWrappedEth
```

converts spefied amount of Liquidity tokens to WETH, unwraps it and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of Liquidity tokens specidied. Resulted amount of tokens are transferred to specified address

***Input Parameters:***

|parameter|type|description|
|:---|:---|:---|
|amount|uint256|amount of liquidity tokens to exchange to ETH|
|to|address|address to send resulted amount of ETH to|

#### *totalSupply*

```solidity
function totalSupply() public view returns(uint256)
```

Returns amount of liquidity tokens assigned to users (for fixed supply pool this equals to amount sold, for variable supply pool this equals to amount of tokens minted)


---
<!---
- Address
- Events
- Interface
-->