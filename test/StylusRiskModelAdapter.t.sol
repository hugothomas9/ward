// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StylusRiskModelAdapter, IStylusRiskEngine} from "../src/models/StylusRiskModelAdapter.sol";

/// Mirrors the Stylus engine's exact fixed-point formula so the adapter is testable in
/// forge (the real engine is the Rust contract, validated by `cargo stylus check` against
/// RH Chain and by its own 6 Rust unit tests).
contract EngineMirror is IStylusRiskEngine {
    uint256 constant WAD = 1e18;
    uint256 public baseBps = 8000;

    function dynamicThresholdBps(uint256 volWad) external view returns (uint256) {
        uint256 cap = volWad > WAD ? WAD : volWad;
        return (baseBps * (WAD - cap / 2)) / WAD;
    }
}

contract StylusRiskModelAdapterTest is Test {
    EngineMirror engine;
    StylusRiskModelAdapter adapter;
    address updater = address(0x1234);
    address asset = address(0xA11CE);

    function setUp() public {
        engine = new EngineMirror();
        adapter = new StylusRiskModelAdapter(address(engine), updater);
    }

    function test_calmMarket_baseThreshold() public {
        // vol 0 => threshold = base 8000
        assertEq(adapter.liquidationThresholdBps(asset), 8000);
    }

    function test_volTightensThreshold() public {
        vm.prank(updater);
        adapter.setVol(asset, 0.1e18); // 10% vol
        assertEq(adapter.liquidationThresholdBps(asset), 7600); // 8000 * 0.95
    }

    function test_extremeVolFloorsAtHalf() public {
        vm.prank(updater);
        adapter.setVol(asset, 2e18);
        assertEq(adapter.liquidationThresholdBps(asset), 4000);
    }

    function test_onlyUpdaterSetsVol() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("not updater"));
        adapter.setVol(asset, 1e18);
    }

    function test_healthFactorMatchesStaticModel() public {
        // identical formula as StaticRiskModel: 1000 col, 500 debt, 80% => 1.6
        assertEq(adapter.healthFactor(1000e18, 500e18, 8000), 1.6e18);
        assertEq(adapter.healthFactor(1000e18, 0, 8000), type(uint256).max);
    }

    /// The volatility story end-to-end: the SAME position is safe in a calm market and
    /// flagged in a volatile one — this is what static-threshold protocols cannot do.
    function test_sameMarkPriceDifferentRiskUnderVol() public {
        uint256 col = 2400e18; uint256 debt = 1900e18;
        // calm: HF = 2400*0.80/1900 = 1.010... >= 1 (safe)
        uint256 hfCalm = adapter.healthFactor(col, debt, adapter.liquidationThresholdBps(asset));
        assertGe(hfCalm, 1e18);
        // volatile (10%): HF = 2400*0.76/1900 = 0.96 < 1 (flagged earlier)
        vm.prank(updater);
        adapter.setVol(asset, 0.1e18);
        uint256 hfVol = adapter.healthFactor(col, debt, adapter.liquidationThresholdBps(asset));
        assertLt(hfVol, 1e18);
    }
}
