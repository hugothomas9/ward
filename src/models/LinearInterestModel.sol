// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IInterestModel} from "../interfaces/IInterestModel.sol";

/// @notice Simple linear (non-compounding) variable interest. Roadmap fixed-rate swaps this out.
contract LinearInterestModel is IInterestModel {
    uint256 public immutable ratePerYearWad; // e.g. 0.10e18 == 10% APR
    uint256 private constant YEAR = 365 days;

    constructor(uint256 ratePerYearWad_) {
        ratePerYearWad = ratePerYearWad_;
    }

    function accrue(uint256 principal, uint256 elapsed) external view returns (uint256) {
        uint256 interest = (principal * ratePerYearWad * elapsed) / (YEAR * 1e18);
        return principal + interest;
    }
}
