// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../../GSN/Context.sol";
import "../../access/Ownable.sol";
import "./ERC20.sol";

abstract contract ERC20Mintable is Context, ERC20, Ownable {

    function mint(uint256 amount) onlyOwner public virtual {
        _mint(_msgSender(), amount);
    }

    function mintTo(address account, uint256 amount) onlyOwner public virtual {
        _mint(account, amount);
    }
}
