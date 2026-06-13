// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChainlinkOracleAdapter} from "../src/oracles/ChainlinkOracleAdapter.sol";
import {MockV3Aggregator} from "../src/oracles/MockV3Aggregator.sol";

contract ChainlinkOracleAdapterTest is Test {
    address constant ASSET = address(0xCAFE);
    uint256 constant MAX_STALENESS = 3600; // 1 hour

    MockV3Aggregator feed8;  // 8-decimal feed (standard Chainlink USD)
    MockV3Aggregator feed18; // 18-decimal feed (edge case)

    ChainlinkOracleAdapter adapter8;
    ChainlinkOracleAdapter adapter18;

    function setUp() public {
        feed8  = new MockV3Aggregator(8,  250e8);   // $250.00 with 8 decimals
        feed18 = new MockV3Aggregator(18, 250e18);  // $250.00 with 18 decimals
        adapter8  = new ChainlinkOracleAdapter(ASSET, address(feed8),  MAX_STALENESS);
        adapter18 = new ChainlinkOracleAdapter(ASSET, address(feed18), MAX_STALENESS);
    }

    // Nominal: 8-dec feed => WAD price
    function test_8decFeedConvertsToWad() public view {
        uint256 p = adapter8.price(ASSET);
        assertEq(p, 250e18, "8-dec feed: 250e8 -> 250e18");
    }

    // Nominal: 18-dec feed => WAD price unchanged
    function test_18decFeedConvertsToWad() public view {
        uint256 p = adapter18.price(ASSET);
        assertEq(p, 250e18, "18-dec feed: 250e18 -> 250e18");
    }

    // Wrong asset reverts
    function test_wrongAssetReverts() public {
        vm.expectRevert(bytes("wrong asset"));
        adapter8.price(address(0xDEAD));
    }

    // Negative answer reverts
    function test_negativeAnswerReverts() public {
        feed8.updateAnswer(-1);
        vm.expectRevert(bytes("non-positive price"));
        adapter8.price(ASSET);
    }

    // Zero answer reverts
    function test_zeroAnswerReverts() public {
        feed8.updateAnswer(0);
        vm.expectRevert(bytes("non-positive price"));
        adapter8.price(ASSET);
    }

    // Stale feed reverts
    function test_staleFeedReverts() public {
        // advance time past maxStaleness
        vm.warp(block.timestamp + MAX_STALENESS + 1);
        vm.expectRevert(bytes("stale price"));
        adapter8.price(ASSET);
    }

    // Just within staleness window still works
    function test_freshFeedAtBoundaryWorks() public {
        vm.warp(block.timestamp + MAX_STALENESS);
        uint256 p = adapter8.price(ASSET);
        assertEq(p, 250e18);
    }
}
