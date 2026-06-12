// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardVault} from "../src/WardVault.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";
import {DynamicRiskModel} from "../src/models/DynamicRiskModel.sol";
import {PriceHistory} from "../src/PriceHistory.sol";
import {MockV3Aggregator} from "../src/oracles/MockV3Aggregator.sol";
import {SolidityRiskEngineMirror} from "./mocks/SolidityRiskEngineMirror.sol";

contract MT is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// Money shot v2: the SAME demo as v1, but running on the DYNAMIC, Stylus-powered risk model
/// (proves F1 — the engine is ACTIVE, not StaticRiskModel). Two identical positions; the feed
/// crashes; the on-chain price history + RiskEngine move the threshold (dynamic), Ward protects
/// B, and A (no Ward) is liquidated.
contract MoneyShotV2Test is Test {
    MT col; MT usdg;
    SettablePriceOracle oracle;
    MockV3Aggregator feed;
    PriceHistory history;
    SolidityRiskEngineMirror engine;
    DynamicRiskModel dyn;
    LinearInterestModel interest;
    LendingCore core;
    WardVault vault;

    address A = address(0xA); // no Ward
    address B = address(0xB); // Ward-protected
    address keeper = address(0x1234);
    address liquidator = address(0x9999);

    uint256 constant MIN_INTERVAL = 60;

    function setUp() public {
        col = new MT("Wrapped TSLA", "WTSLA");
        usdg = new MT("Global Dollar", "USDG");

        // valuation oracle (WAD) and vol feed (8-dec) — kept consistent through the demo
        oracle = new SettablePriceOracle(address(this));
        oracle.setPrice(address(col), 250e18);
        feed = new MockV3Aggregator(8, 250e8);
        history = new PriceHistory(address(feed), 1 hours, MIN_INTERVAL);
        engine = new SolidityRiskEngineMirror();
        dyn = new DynamicRiskModel(address(history), address(engine), address(col), 8000, 1);

        interest = new LinearInterestModel(0);
        // deploy with a static model, then swap to the dynamic engine (proves F11 wiring)
        StaticRiskModel boot = new StaticRiskModel(address(this));
        boot.setThreshold(address(col), 8000);
        core = new LendingCore(address(col), address(usdg), oracle, boot, interest);
        core.setRiskModel(address(dyn)); // <-- now running on the Stylus-powered engine

        vault = new WardVault(core, usdg);

        usdg.mint(address(this), 1_000_000e18);
        usdg.approve(address(core), type(uint256).max);
        core.provide(500_000e18);

        // seed a flat price history (vol = 0 -> threshold stays at base 8000)
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + MIN_INTERVAL);
            history.poke();
        }
        dyn.refresh();

        _open(A);
        _open(B);

        usdg.mint(B, 2000e18);
        vm.startPrank(B);
        usdg.approve(address(vault), type(uint256).max);
        vault.fund(2000e18);
        vault.setPolicy(1.2e18, 1.5e18, keeper);
        vm.stopPrank();
    }

    function _open(address u) internal {
        col.mint(u, 10e18);
        vm.startPrank(u);
        col.approve(address(core), type(uint256).max);
        core.deposit(10e18);   // 2500 value
        core.borrow(1900e18);  // HF 1.05 at base
        vm.stopPrank();
    }

    function test_engineIsActive_thresholdIsBaseBeforeCrash() public {
        assertEq(dyn.liquidationThresholdBps(address(col)), 8000);
        // and it's the DYNAMIC model that's wired in, not the static one
        assertEq(address(core.riskModel()), address(dyn));
    }

    function test_moneyShotV2_dynamicEngine() public {
        // CRASH the feed and the valuation oracle together: 250 -> 210
        oracle.setPrice(address(col), 210e18);
        vm.warp(block.timestamp + MIN_INTERVAL);
        feed.updateAnswer(210e8);
        history.poke();   // bot's new role: keep the on-chain history fresh
        dyn.refresh();    // recompute the vol-aware threshold

        // the engine is alive: the crash produced volatility, the threshold moved off base
        uint256 thr = dyn.liquidationThresholdBps(address(col));
        assertLt(thr, 8000, "dynamic threshold must move under volatility (engine active)");
        // ...but F3: it did NOT collapse instantly (rate-limited), still near base
        assertGt(thr, 7000, "tightening is rate-limited, not instant");

        // Ward protects B
        vm.prank(keeper);
        vault.protect(B);

        // A (no Ward) is liquidatable from the price crash and gets liquidated
        assertLt(core.healthFactor(A), 1e18);
        usdg.mint(liquidator, 5000e18);
        vm.startPrank(liquidator);
        usdg.approve(address(core), type(uint256).max);
        core.liquidate(A);
        vm.stopPrank();
        (uint256 colA,) = core.positionOf(A);
        assertEq(colA, 0); // A lost everything

        // B survived, healthy, cannot be liquidated
        assertGe(core.healthFactor(B), 1.5e18);
        (uint256 colB,) = core.positionOf(B);
        assertEq(colB, 10e18);
        vm.expectRevert(bytes("healthy"));
        core.liquidate(B);
    }
}
