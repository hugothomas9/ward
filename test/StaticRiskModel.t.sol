// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";

contract StaticRiskModelTest is Test {
    StaticRiskModel model;
    address asset = address(0xA11CE);

    function setUp() public {
        model = new StaticRiskModel(address(this));
        model.setThreshold(asset, 8000); // 80%
    }

    function test_threshold() public {
        assertEq(model.liquidationThresholdBps(asset), 8000);
    }

    function test_healthFactor_safe() public {
        // collateral 1000, debt 500, threshold 80% => HF = 1000*0.8/500 = 1.6
        uint256 hf = model.healthFactor(1000e18, 500e18, 8000);
        assertEq(hf, 1.6e18);
    }

    function test_healthFactor_zeroDebt_isMax() public {
        uint256 hf = model.healthFactor(1000e18, 0, 8000);
        assertEq(hf, type(uint256).max);
    }

    function test_healthFactor_liquidatable() public {
        // collateral 600, debt 500, threshold 80% => HF = 600*0.8/500 = 0.96 < 1
        uint256 hf = model.healthFactor(600e18, 500e18, 8000);
        assertLt(hf, 1e18);
    }

    function test_thresholdOver100PctReverts() public {
        vm.expectRevert(bytes("bps>100%"));
        model.setThreshold(asset, 10001);
    }
}
