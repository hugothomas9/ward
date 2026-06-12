// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockV3Aggregator} from "../src/oracles/MockV3Aggregator.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";

contract MockV3AggregatorTest is Test {
    MockV3Aggregator agg;

    function setUp() public {
        // Chainlink USD feeds use 8 decimals. Initial: 250 USD (250e8).
        agg = new MockV3Aggregator(8, 250e8);
    }

    function test_initialRoundData() public {
        assertEq(agg.decimals(), 8);
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = agg.latestRoundData();
        assertEq(answer, 250e8);
        assertEq(roundId, 1);
        assertEq(answeredInRound, 1);
        assertEq(updatedAt, block.timestamp);
    }

    function test_updateAnswerAdvancesRoundAndTimestamp() public {
        vm.warp(block.timestamp + 100);
        agg.updateAnswer(210e8);
        (uint80 roundId, int256 answer,, uint256 updatedAt,) = agg.latestRoundData();
        assertEq(answer, 210e8);
        assertEq(roundId, 2);
        assertEq(updatedAt, block.timestamp);
    }

    function test_conformsToAggregatorV3Interface() public {
        AggregatorV3Interface i = AggregatorV3Interface(address(agg));
        (, int256 answer,,,) = i.latestRoundData();
        assertEq(answer, 250e8);
    }
}
