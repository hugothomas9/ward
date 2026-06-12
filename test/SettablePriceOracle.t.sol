// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";

contract SettablePriceOracleTest is Test {
    SettablePriceOracle oracle;
    address asset = address(0xA11CE);

    function setUp() public {
        oracle = new SettablePriceOracle(address(this));
    }

    function test_setAndReadPrice() public {
        oracle.setPrice(asset, 250e18);
        assertEq(oracle.price(asset), 250e18);
    }

    function test_onlyOwnerCanSet() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        oracle.setPrice(asset, 1e18);
    }

    function test_unsetPriceReverts() public {
        vm.expectRevert(bytes("price unset"));
        oracle.price(address(0xDEAD));
    }
}
