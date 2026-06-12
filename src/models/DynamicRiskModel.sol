// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRiskModel} from "../interfaces/IRiskModel.sol";
import {IRiskEngine} from "../interfaces/IRiskEngine.sol";
import {PriceHistory} from "../PriceHistory.sol";

/// @notice Volatility-aware risk model (the differentiator vs Aave's static thresholds).
///
/// It derives the liquidation threshold from realized volatility computed by the Stylus RiskEngine
/// over the on-chain PriceHistory. Two properties make it safe:
///
///  - F2 (non-manipulable): vol is computed from PriceHistory, whose only writer is poke() reading
///    the Chainlink feed. There is NO setter to inject a threshold or a vol here either; refresh()
///    can only move the in-effect threshold toward the engine's honest target.
///
///  - F3 (no procyclical liquidation): TIGHTENING is rate-limited — the in-effect threshold can
///    only DROP by `maxTightenBpsPerSec` per second. A vol spike therefore cannot instantly tighten
///    the threshold and liquidate a position the price alone would not have. The keeper/Ward gets
///    time to act. LOOSENING (vol falls) is immediate, because it only raises HF — never dangerous.
contract DynamicRiskModel is IRiskModel {
    PriceHistory public immutable history;
    IRiskEngine public immutable engine;
    address public immutable asset; // single collateral (MVP)
    uint256 public immutable baseBps;
    uint256 public immutable maxTightenBpsPerSec;

    /// C1/F3: caps how much wall-clock a SINGLE refresh may convert into tightening budget.
    /// Without it, the drop per refresh = rate * (now - lastRefresh), so one refresh after a long
    /// gap (bot down, RPC outage, patient attacker) could collapse the threshold in one block and
    /// liquidate positions the price alone left healthy. With the cap, a single refresh drops at
    /// most rate * MAX_TIGHTEN_STEP bps regardless of the gap; the threshold can only tighten at
    /// `rate` bps per second of REAL time, spread across refreshes.
    uint256 public constant MAX_TIGHTEN_STEP = 60; // seconds

    /// C2/F2: if the price history hasn't been updated within this window, its volatility is
    /// computed on dead data. Rather than tighten on a frozen feed (which could keep liquidating
    /// at a stale-derived threshold), refresh() relaxes toward base — the safe direction.
    uint256 public constant MAX_HISTORY_AGE = 1 hours;

    uint256 public currentBps; // the in-effect, smoothed threshold
    uint256 public lastRefresh;

    event Refreshed(uint256 volWad, uint256 targetBps, uint256 effectiveBps, uint256 at);

    constructor(
        address history_,
        address engine_,
        address asset_,
        uint256 baseBps_,
        uint256 maxTightenBpsPerSec_
    ) {
        require(baseBps_ > 0 && baseBps_ <= 10000, "bad base");
        history = PriceHistory(history_);
        engine = IRiskEngine(engine_);
        asset = asset_;
        baseBps = baseBps_;
        maxTightenBpsPerSec = maxTightenBpsPerSec_;
        currentBps = baseBps_; // start safe, at base
        lastRefresh = block.timestamp;
    }

    /// @notice Recompute the in-effect threshold from current volatility, applying the F3 rate
    /// limit on tightening. Permissionless: it can only move toward the engine's honest target.
    function refresh() external {
        uint256 vol;
        uint256 target;
        uint256 lu = history.lastUpdate();
        if (lu == 0 || block.timestamp - lu > MAX_HISTORY_AGE) {
            // C2/F2: stale or absent data -> do not act on it; relax toward base (safe direction)
            target = baseBps;
        } else {
            uint256[] memory w = history.window();
            vol = engine.realizedVol(w);
            target = engine.dynamicThresholdBps(baseBps, vol);
            if (target > baseBps) target = baseBps; // never looser than base
        }

        uint256 cur = currentBps;
        if (target >= cur) {
            // loosening (or unchanged): immediate, it only raises HF
            cur = target;
        } else {
            // tightening: clamp the drop to rate * min(elapsed, MAX_TIGHTEN_STEP) so a single
            // refresh after a long gap cannot collapse the threshold (C1/F3).
            uint256 elapsed = block.timestamp - lastRefresh;
            if (elapsed > MAX_TIGHTEN_STEP) elapsed = MAX_TIGHTEN_STEP;
            uint256 maxDrop = maxTightenBpsPerSec * elapsed;
            uint256 floorBps = cur > maxDrop ? cur - maxDrop : 0;
            cur = target > floorBps ? target : floorBps;
        }
        currentBps = cur;
        lastRefresh = block.timestamp;
        emit Refreshed(vol, target, cur, block.timestamp);
    }

    function liquidationThresholdBps(address asset_) external view returns (uint256) {
        require(asset_ == asset, "unknown asset");
        return currentBps;
    }

    function healthFactor(uint256 collateralValue, uint256 debtValue, uint256 thresholdBps)
        external pure returns (uint256)
    {
        if (debtValue == 0) return type(uint256).max;
        return (collateralValue * thresholdBps * 1e18) / (debtValue * 10000);
    }
}
