// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Maps borrow tenors (seconds) to annual fixed rates (basis points). Owner-set at MVP.
contract TermRateModel is Ownable {
    mapping(uint256 => uint256) private _rates; // tenor (s) => annual rate bps

    event RateSet(uint256 indexed tenor, uint256 rateBps);

    constructor(address owner_) Ownable(owner_) {}

    function setRate(uint256 tenor, uint256 rateBps) external onlyOwner {
        require(tenor > 0, "tenor=0");
        _rates[tenor] = rateBps;
        emit RateSet(tenor, rateBps);
    }

    function getRate(uint256 tenor) external view returns (uint256) {
        uint256 r = _rates[tenor];
        require(r > 0, "no rate for tenor");
        return r;
    }
}
