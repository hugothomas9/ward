// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/// @notice On-chain price history for the dynamic risk engine (F2: non-manipulable source).
///
/// The ONLY way a value enters this buffer is `poke()`, which reads the Chainlink feed itself
/// on-chain and stores the feed's reported price (normalized to 1e18 WAD). There is no setter to
/// inject a chosen price or volatility. Anyone may call `poke()` (it's a public good — keep the
/// history fresh), but a caller can only ever append the real feed value. Volatility derived from
/// this buffer therefore inherits the feed's provenance: nobody can fabricate it.
///
/// Sampling is rate-limited (`minInterval`) so the window is a genuine time series, and stale feed
/// reads are rejected (`maxStaleness`) so a frozen feed can't poison the history.
contract PriceHistory {
    uint256 private constant WINDOW = 16; // ring buffer size

    AggregatorV3Interface public immutable feed;
    uint256 public immutable maxStaleness; // reject feed reads older than this
    uint256 public immutable minInterval; // minimum seconds between stored samples
    uint256 private immutable _feedScale; // 10 ** feed.decimals()

    uint256[WINDOW] private _buf;
    uint256 private _head; // next write slot
    uint256 private _count; // number of valid samples (saturates at WINDOW)
    uint256 public lastUpdate; // timestamp of the last stored sample

    event Poked(uint256 priceWad, uint256 at);

    constructor(address feed_, uint256 maxStaleness_, uint256 minInterval_) {
        feed = AggregatorV3Interface(feed_);
        maxStaleness = maxStaleness_;
        minInterval = minInterval_;
        _feedScale = 10 ** AggregatorV3Interface(feed_).decimals();
    }

    /// @notice Read the feed and append its current price to the history. Permissionless, but can
    /// only store the feed's real value — no arbitrary injection possible.
    function poke() external {
        require(lastUpdate == 0 || block.timestamp >= lastUpdate + minInterval, "too soon");

        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        require(answer > 0, "bad price");
        require(block.timestamp <= updatedAt + maxStaleness, "stale feed");

        uint256 priceWad = (uint256(answer) * 1e18) / _feedScale;

        _buf[_head] = priceWad;
        _head = (_head + 1) % WINDOW;
        if (_count < WINDOW) _count += 1;
        lastUpdate = block.timestamp;

        emit Poked(priceWad, block.timestamp);
    }

    function length() external view returns (uint256) {
        return _count;
    }

    function latestWad() external view returns (uint256) {
        require(_count > 0, "empty");
        return _buf[(_head + WINDOW - 1) % WINDOW];
    }

    /// @notice The stored window, oldest -> newest. Length == min(samples, WINDOW).
    function window() external view returns (uint256[] memory out) {
        out = new uint256[](_count);
        if (_count == 0) return out;
        // oldest element index:
        uint256 start = _count < WINDOW ? 0 : _head;
        for (uint256 i = 0; i < _count; i++) {
            out[i] = _buf[(start + i) % WINDOW];
        }
    }
}
