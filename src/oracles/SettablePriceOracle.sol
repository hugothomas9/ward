// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice Owner-settable price feed. Demo price source (lets us crash the price on command).
/// A Chainlink adapter implementing the same IPriceOracle plugs in for production.
contract SettablePriceOracle is IPriceOracle, Ownable {
    mapping(address => uint256) private _price;

    event PriceSet(address indexed asset, uint256 priceWad);

    constructor(address owner_) Ownable(owner_) {}

    function setPrice(address asset, uint256 priceWad) external onlyOwner {
        _price[asset] = priceWad;
        emit PriceSet(asset, priceWad);
    }

    function price(address asset) external view returns (uint256) {
        uint256 p = _price[asset];
        require(p != 0, "price unset");
        return p;
    }
}
