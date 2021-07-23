// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ERC20PresetMinterPauser} from '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol';


contract ERC20PresetMinterPauserOwnerBurnable is ERC20PresetMinterPauser {
    constructor(string memory name, string memory symbol) ERC20PresetMinterPauser(name, symbol) {}

    function burnFrom(address account, uint256 amount) public override {  //todo discuss
        if(hasRole(MINTER_ROLE, _msgSender())) {
            _burn(account, amount);
            return;
        }
        uint256 currentAllowance = allowance(account, _msgSender());
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        unchecked {
            _approve(account, _msgSender(), currentAllowance - amount);
        }
        _burn(account, amount);
    }
}