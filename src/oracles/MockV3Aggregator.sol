// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @notice Chainlink-standard mock aggregator. On testnet it stands in for a real Chainlink feed
/// (the demo operator calls updateAnswer to simulate market moves). In production the same code
/// path reads a real AggregatorV3Interface — only the address changes. The Ward price history
/// reads this feed itself on-chain, so the operator's control here does NOT let anyone inject an
/// arbitrary VOLATILITY: the history only ever stores whatever the feed reports.
contract MockV3Aggregator is AggregatorV3Interface {
    uint8 public immutable override decimals;
    uint256 public constant override version = 0;

    int256 public latestAnswer;
    uint256 public latestTimestamp;
    uint80 public latestRound;

    mapping(uint80 => int256) public getAnswer;
    mapping(uint80 => uint256) public getTimestamp;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        _set(_initialAnswer);
    }

    function updateAnswer(int256 _answer) external {
        _set(_answer);
    }

    function _set(int256 _answer) internal {
        latestAnswer = _answer;
        latestTimestamp = block.timestamp;
        latestRound += 1;
        getAnswer[latestRound] = _answer;
        getTimestamp[latestRound] = block.timestamp;
    }

    function description() external pure override returns (string memory) {
        return "MockV3Aggregator";
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (latestRound, latestAnswer, latestTimestamp, latestTimestamp, latestRound);
    }
}
