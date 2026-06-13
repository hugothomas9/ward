// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @notice Valuation oracle reading a Chainlink AggregatorV3Interface and returning a clean WAD
/// USD price. Binding LendingCore's collateral valuation to the SAME feed the PriceHistory uses
/// for volatility removes the "two disjoint price sources" flaw (C2/F2): collateral value and
/// volatility can never diverge, and a real crash moves both together. Reverts on a stale feed so
/// liquidations can't run on a frozen price.
contract ChainlinkPriceOracle is IPriceOracle {
    AggregatorV3Interface public immutable feed;
    address public immutable asset;
    uint256 public immutable maxStaleness;
    uint256 private immutable _feedScale; // 10 ** feed.decimals()

    constructor(address feed_, address asset_, uint256 maxStaleness_) {
        feed = AggregatorV3Interface(feed_);
        asset = asset_;
        maxStaleness = maxStaleness_;
        _feedScale = 10 ** AggregatorV3Interface(feed_).decimals();
    }

    function price(address asset_) external view returns (uint256) {
        require(asset_ == asset, "unknown asset");
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        require(answer > 0, "bad price");
        require(block.timestamp <= updatedAt + maxStaleness, "stale feed");
        return (uint256(answer) * 1e18) / _feedScale;
    }
}
