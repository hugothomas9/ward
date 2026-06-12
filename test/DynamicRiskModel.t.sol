// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DynamicRiskModel} from "../src/models/DynamicRiskModel.sol";
import {PriceHistory} from "../src/PriceHistory.sol";
import {MockV3Aggregator} from "../src/oracles/MockV3Aggregator.sol";
import {IRiskEngine} from "../src/interfaces/IRiskEngine.sol";

/// Lets the test drive the engine's target threshold directly, so the anti-procyclicity logic
/// (the adapter's job) is tested in isolation from the vol math (the Stylus engine's job, which
/// has its own Rust tests). vol->threshold mapping is NOT re-tested here on purpose.
contract MockRiskEngine is IRiskEngine {
    uint256 public vol;
    uint256 public target;
    bool public useTarget;

    function setVol(uint256 v) external { vol = v; }
    function setTarget(uint256 t) external { target = t; useTarget = true; }

    function realizedVol(uint256[] calldata) external view returns (uint256) { return vol; }
    function dynamicThresholdBps(uint256 baseBps, uint256) external view returns (uint256) {
        return useTarget ? target : baseBps;
    }
}

contract DynamicRiskModelTest is Test {
    MockV3Aggregator feed;
    PriceHistory history;
    MockRiskEngine engine;
    DynamicRiskModel model;

    address asset = address(0x7e514);
    uint256 constant BASE = 8000;
    uint256 constant RATE = 1; // max 1 bps tighten per second (F3 circuit breaker)

    function setUp() public {
        feed = new MockV3Aggregator(8, 250e8);
        history = new PriceHistory(address(feed), 1 hours, 60);
        engine = new MockRiskEngine();
        model = new DynamicRiskModel(address(history), address(engine), asset, BASE, RATE);
    }

    function test_startsAtBaseThreshold() public {
        assertEq(model.liquidationThresholdBps(asset), BASE);
    }

    function test_unknownAssetReverts() public {
        vm.expectRevert(bytes("unknown asset"));
        model.liquidationThresholdBps(address(0xdead));
    }

    // --- F3: tightening is rate-limited, never instant ---

    function test_tighteningIsRateLimited() public {
        engine.setTarget(6800); // a vol spike implies a much tighter target
        vm.warp(block.timestamp + 5);
        model.refresh();
        // only 5 bps of tightening allowed in 5s -> 7995, nowhere near 6800
        assertEq(model.liquidationThresholdBps(asset), 7995);
    }

    /// THE chiffré scenario from the review: position with collateralValue/debt = 1.4375 (after an
    /// 8% price drop). An INSTANT tighten to 6800 would liquidate it (HF 0.9775); the rate limit
    /// keeps the in-effect threshold near base for one refresh, so HF stays above 1.0 and Ward has
    /// time to act.
    function test_noInstantLiquidationUnderVolSpike() public {
        uint256 colValue = 14375e18; // ratio 1.4375 vs debt
        uint256 debt = 10000e18;

        engine.setTarget(6800);
        vm.warp(block.timestamp + 5);
        model.refresh();
        uint256 thr = model.liquidationThresholdBps(asset); // 7995

        uint256 hf = model.healthFactor(colValue, debt, thr);
        assertGe(hf, 1e18, "rate-limited threshold must keep the position out of liquidation");

        // proof the unsmoothed target WOULD have liquidated it:
        uint256 hfInstant = model.healthFactor(colValue, debt, 6800);
        assertLt(hfInstant, 1e18);
    }

    /// C1/F3: a SINGLE refresh after a long gap must NOT be able to collapse the threshold.
    /// This is the attack the review found: bot down 2h, then one refresh with an extreme target
    /// previously dropped 8000 -> 4000 in one block and liquidated healthy positions. The drop per
    /// refresh is now capped to rate * min(elapsed, MAX_TIGHTEN_STEP), independent of the gap.
    function test_longGapDoesNotCollapseThreshold() public {
        engine.setTarget(4000); // extreme-vol target (the floor)
        vm.warp(block.timestamp + 7200); // 2h with no refresh
        model.refresh();
        uint256 thr = model.liquidationThresholdBps(asset);
        // one refresh can drop at most rate(1) * MAX_TIGHTEN_STEP(60) = 60 bps, NOT down to 4000
        assertEq(thr, 8000 - 60);
        assertGt(thr, 4000);
    }

    /// C1/F3: the chiffré scenario, now via a long gap — a position the price alone left healthy
    /// (ratio 1.30 -> HF 1.04 at base) must stay above 1.0 after one post-gap refresh.
    function test_singleRefreshAfterGapCannotLiquidateHealthyPosition() public {
        uint256 colValue = 13000e18; // ratio 1.30 vs debt
        uint256 debt = 10000e18;

        engine.setTarget(4000);
        vm.warp(block.timestamp + 7200);
        model.refresh();
        uint256 thr = model.liquidationThresholdBps(asset); // 7940

        uint256 hf = model.healthFactor(colValue, debt, thr);
        assertGe(hf, 1e18, "one post-gap refresh must not push a healthy position into liquidation");
    }

    function test_tighteningReachesTargetOverManyRefreshes() public {
        engine.setTarget(6800); // 1200 bps below base
        // capped to 60 bps/refresh -> needs >= 20 refreshes spaced by >= MAX_TIGHTEN_STEP
        for (uint256 i = 0; i < 25; i++) {
            vm.warp(block.timestamp + 60);
            model.refresh();
        }
        assertEq(model.liquidationThresholdBps(asset), 6800); // converges over time, never in one step
    }

    // --- loosening is immediate (safe: it only raises HF, never liquidates) ---

    function test_looseningSnapsBackUp() public {
        engine.setTarget(6800);
        for (uint256 i = 0; i < 25; i++) {
            vm.warp(block.timestamp + 60);
            model.refresh();
        }
        assertEq(model.liquidationThresholdBps(asset), 6800); // converged via many capped steps

        engine.setTarget(8000); // vol dropped back
        model.refresh(); // same block, no elapsed
        assertEq(model.liquidationThresholdBps(asset), 8000); // loosening is immediate, not rate-limited
    }

    function test_neverExceedsBase() public {
        engine.setTarget(9000); // engine can't actually exceed base, but guard anyway
        model.refresh();
        assertEq(model.liquidationThresholdBps(asset), BASE);
    }

    // --- nobody can inject a threshold directly: refresh only moves toward the engine target ---

    function test_noDirectThresholdSetter() public view {
        string memory json = vm.readFile("out/DynamicRiskModel.sol/DynamicRiskModel.json");
        string[] memory sigs = vm.parseJsonKeys(json, ".methodIdentifiers");
        for (uint256 i = 0; i < sigs.length; i++) {
            bytes32 h = keccak256(bytes(sigs[i]));
            require(h != keccak256("setThreshold(uint256)"), "setThreshold exists!");
            require(h != keccak256("setVol(address,uint256)"), "setVol exists!");
        }
    }
}
