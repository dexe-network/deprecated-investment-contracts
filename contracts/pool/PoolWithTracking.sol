pragma solidity 0.6.6;

import "./Pool.sol";

struct PoolEntry {
    uint32 blocknumber;
    uint256 amountLocked;
    uint256 deposited;
    uint256 withdrawn;
}

contract PoolWithTracking is Pool{

    mapping (address => PoolEntry) internal entries;

    constructor(address _basicToken) 
        Pool (_basicToken) 
    public {
    }

    function getPoolEntry(address user) public view returns (uint32, uint256, uint256, uint256){
        return (entries[user].blocknumber, entries[user].amountLocked, entries[user].deposited, entries[user].withdrawn);
    }

    function _afterDeposit(uint256 amount, address holder, address to) internal override {
        entries[msg.sender].deposited = entries[msg.sender].deposited.add(amount);     
    }

    function _afterWithdraw(uint256 amount, address holder, address to) internal override {
        entries[msg.sender].withdrawn = entries[msg.sender].withdrawn.add(amount);     
    }


}
