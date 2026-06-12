// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";

contract LinearInterestModelTest is Test {
    LinearInterestModel model;

    function setUp() public {
        // 10% APR, expressed as ratePerYearWad = 0.10e18
        model = new LinearInterestModel(0.10e18);
    }

    function test_noTimeNoInterest() public {
        assertEq(model.accrue(1000e18, 0), 1000e18);
    }

    function test_oneYearTenPercent() public {
        // 1000 grown 10% over 365 days
        uint256 oneYear = 365 days;
        assertEq(model.accrue(1000e18, oneYear), 1100e18);
    }

    function test_halfYearFivePercent() public {
        // linear: 1000 grown 5% over half a year (365/2 days, integer-exact with even split)
        uint256 halfYear = 365 days / 2;
        // interest = 1000e18 * 0.10e18 * halfYear / (365d * 1e18)
        uint256 expected = 1000e18 + (1000e18 * 0.10e18 * halfYear) / (uint256(365 days) * 1e18);
        assertEq(model.accrue(1000e18, halfYear), expected);
    }
}
