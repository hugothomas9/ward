// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice Wraps a Chainlink AggregatorV3 feed as an IPriceOracle.
/// Converts feed decimals → WAD on-chain so callers always receive a clean 1e18 price.
/// Reverts on stale data, non-positive answers, or wrong asset — never silently returns bad data.
contract ChainlinkOracleAdapter is IPriceOracle {
    address public immutable asset;
    AggregatorV3Interface public immutable feed;
    uint256 public immutable maxStaleness; // seconds

    // pre-computed at construction: WAD / 10**feedDecimals
    uint256 private immutable _scale;

    constructor(address asset_, address feed_, uint256 maxStaleness_) {
        asset = asset_;
        feed = AggregatorV3Interface(feed_);
        maxStaleness = maxStaleness_;
        uint8 dec = AggregatorV3Interface(feed_).decimals();
        _scale = 10 ** (18 - dec); // safe: Chainlink decimals are always <= 18
    }

    function price(address asset_) external view override returns (uint256) {
        require(asset_ == asset, "wrong asset");
        (, int256 answer, , uint256 updatedAt,) = feed.latestRoundData();
        require(answer > 0, "non-positive price");
        require(block.timestamp - updatedAt <= maxStaleness, "stale price");
        return uint256(answer) * _scale;
    }
}
