// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChainlinkPriceOracle} from "../src/oracles/ChainlinkPriceOracle.sol";
import {MockV3Aggregator} from "../src/oracles/MockV3Aggregator.sol";

/// The valuation oracle reads the SAME feed as the vol history, so collateral value and
/// volatility can never diverge (fixes the two-disjoint-sources flaw). Price is a clean WAD.
contract ChainlinkPriceOracleTest is Test {
    MockV3Aggregator feed;
    ChainlinkPriceOracle oracle;
    address asset = address(0x7e514);

    function setUp() public {
        feed = new MockV3Aggregator(8, 250e8); // 250 USD, 8-dec Chainlink feed
        oracle = new ChainlinkPriceOracle(address(feed), asset, 1 hours);
    }

    function test_priceIsWadFromFeed() public {
        assertEq(oracle.price(asset), 250e18); // 250e8 (8-dec) -> 250e18 WAD
    }

    function test_priceTracksFeed() public {
        vm.warp(block.timestamp + 100);
        feed.updateAnswer(210e8);
        assertEq(oracle.price(asset), 210e18);
    }

    function test_unknownAssetReverts() public {
        vm.expectRevert(bytes("unknown asset"));
        oracle.price(address(0xdead));
    }

    function test_staleFeedReverts() public {
        vm.warp(block.timestamp + 1 hours + 1);
        vm.expectRevert(bytes("stale feed"));
        oracle.price(asset);
    }

    function test_nonPositivePriceReverts() public {
        feed.updateAnswer(0);
        vm.expectRevert(bytes("bad price"));
        oracle.price(asset);
    }
}
