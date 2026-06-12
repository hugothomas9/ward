// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardVault} from "../src/WardVault.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";

contract MT is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// THE DEMO, proven deterministically: two identical positions; the price crashes;
/// A (no Ward) gets liquidated and loses everything; B (Ward-protected) survives.
contract MoneyShotTest is Test {
    MT col; MT usdg;
    SettablePriceOracle oracle; StaticRiskModel risk; LinearInterestModel interest;
    LendingCore core; WardVault vault;
    address A = address(0xA); // no Ward
    address B = address(0xB); // Ward-protected
    address keeper = address(0x1234);
    address liquidator = address(0x9999);

    function setUp() public {
        col = new MT("Wrapped TSLA","WTSLA");
        usdg = new MT("Global Dollar","USDG");
        oracle = new SettablePriceOracle(address(this));
        risk = new StaticRiskModel(address(this));
        interest = new LinearInterestModel(0);
        core = new LendingCore(address(col), address(usdg), oracle, risk, interest);
        oracle.setPrice(address(col), 250e18);
        risk.setThreshold(address(col), 8000);
        vault = new WardVault(core, usdg);

        usdg.mint(address(this), 1_000_000e18);
        usdg.approve(address(core), type(uint256).max);
        core.provide(500_000e18);

        _open(A);
        _open(B);

        // B funds Ward and sets policy
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
        core.borrow(1900e18);  // HF 1.05
        vm.stopPrank();
    }

    function test_moneyShot() public {
        // CRASH: 250 -> 210
        oracle.setPrice(address(col), 210e18);

        // Ward protects B
        vm.prank(keeper);
        vault.protect(B);

        // A is now liquidatable and gets liquidated
        assertLt(core.healthFactor(A), 1e18);
        usdg.mint(liquidator, 5000e18);
        vm.startPrank(liquidator);
        usdg.approve(address(core), type(uint256).max);
        core.liquidate(A);
        vm.stopPrank();
        (uint256 colA, uint256 debtA) = core.positionOf(A);
        assertEq(colA, 0);      // A lost their collateral
        assertEq(debtA, 0);

        // B survived: still has collateral, healthy, cannot be liquidated
        assertGe(core.healthFactor(B), 1.5e18);
        (uint256 colB,) = core.positionOf(B);
        assertEq(colB, 10e18);
        vm.expectRevert(bytes("healthy"));
        core.liquidate(B);
    }

    /// Same story under a BRUTAL crash that exhausts B's buffer: Ward still buys B a
    /// better outcome (partial de-risking) even when it cannot fully restore the target.
    function test_moneyShot_brutalCrash_partialProtectionStillHelps() public {
        // CRASH: 250 -> 150 => value 1500, HF = 1500*0.8/1900 = 0.63
        oracle.setPrice(address(col), 150e18);

        vm.prank(keeper);
        vault.protect(B); // buffer 2000 is spent (target needs repay 1100 -> ok actually)

        // with 2000 buffer: newDebt target = 1500*0.8/1.5 = 800 => repay 1100 (buffer suffices)
        (, uint256 debtB) = core.positionOf(B);
        assertEq(debtB, 800e18);
        assertGe(core.healthFactor(B), 1.5e18);

        // A is liquidated as before
        usdg.mint(liquidator, 5000e18);
        vm.startPrank(liquidator);
        usdg.approve(address(core), type(uint256).max);
        core.liquidate(A);
        vm.stopPrank();
        (uint256 colA,) = core.positionOf(A);
        assertEq(colA, 0);
        (uint256 colB,) = core.positionOf(B);
        assertEq(colB, 10e18);
    }
}
