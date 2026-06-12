// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";

contract TestToken is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract LendingCoreTest is Test {
    TestToken collateral;
    TestToken usdg;
    SettablePriceOracle oracle;
    StaticRiskModel risk;
    LinearInterestModel interest;
    LendingCore core;

    address alice = address(0xA11CE);
    address lp = address(0x11111);

    function setUp() public {
        collateral = new TestToken("Wrapped TSLA", "WTSLA");
        usdg = new TestToken("Global Dollar", "USDG");
        oracle = new SettablePriceOracle(address(this));
        risk = new StaticRiskModel(address(this));
        interest = new LinearInterestModel(0.10e18);

        core = new LendingCore(address(collateral), address(usdg), oracle, risk, interest);

        oracle.setPrice(address(collateral), 250e18); // 1 WTSLA = 250 USDG
        risk.setThreshold(address(collateral), 8000);  // 80%

        // seed lending liquidity (the lender side, real USDG in prod)
        usdg.mint(lp, 1_000_000e18);
        vm.prank(lp);
        usdg.approve(address(core), type(uint256).max);
        vm.prank(lp);
        core.provide(100_000e18);

        // give alice collateral
        collateral.mint(alice, 100e18);
        vm.prank(alice);
        collateral.approve(address(core), type(uint256).max);
    }

    function test_depositAndBorrow() public {
        vm.startPrank(alice);
        core.deposit(10e18);            // 10 WTSLA = 2500 USDG value
        core.borrow(1000e18);           // borrow 1000 USDG
        vm.stopPrank();

        (uint256 col, uint256 debt) = core.positionOf(alice);
        assertEq(col, 10e18);
        assertEq(debt, 1000e18);
        assertEq(usdg.balanceOf(alice), 1000e18);
        // HF = 2500*0.8/1000 = 2.0
        assertEq(core.healthFactor(alice), 2e18);
    }

    function test_cannotBorrowBeyondThreshold() public {
        vm.startPrank(alice);
        core.deposit(10e18); // 2500 value, max borrow = 2500*0.8 = 2000
        vm.expectRevert(bytes("unhealthy"));
        core.borrow(2001e18);
        vm.stopPrank();
    }

    function test_repayReducesDebt() public {
        vm.startPrank(alice);
        core.deposit(10e18);
        core.borrow(1000e18);
        usdg.approve(address(core), type(uint256).max);
        core.repay(400e18);
        vm.stopPrank();
        (, uint256 debt) = core.positionOf(alice);
        assertEq(debt, 600e18);
    }

    function test_interestAccrues() public {
        vm.startPrank(alice);
        core.deposit(10e18);
        core.borrow(1000e18);
        vm.stopPrank();
        // 10% APR linear: after 1 year, debt = 1100
        vm.warp(block.timestamp + 365 days);
        (, uint256 debt) = core.positionOf(alice);
        assertEq(debt, 1100e18);
    }

    function test_withdrawGuardedByHealth() public {
        vm.startPrank(alice);
        core.deposit(10e18);
        core.borrow(1900e18); // HF = 2000/1900 = 1.05
        vm.expectRevert(bytes("unhealthy"));
        core.withdraw(5e18);  // would halve collateral -> HF < 1
        core.withdraw(0.1e18); // small withdraw stays healthy
        vm.stopPrank();
        (uint256 col,) = core.positionOf(alice);
        assertEq(col, 9.9e18);
    }

    function test_cannotBorrowMoreThanLiquidity() public {
        collateral.mint(alice, 10_000e18);
        vm.startPrank(alice);
        core.deposit(10_000e18); // plenty of collateral
        vm.expectRevert(bytes("insufficient liquidity"));
        core.borrow(100_001e18); // pool only has 100k
        vm.stopPrank();
    }

    function test_liquidateWhenUnhealthy() public {
        vm.startPrank(alice);
        core.deposit(10e18);     // 2500 value
        core.borrow(1900e18);    // HF = 2500*0.8/1900 = 1.05
        vm.stopPrank();

        // crash price: 250 -> 200 => collateral value 2000, HF = 2000*0.8/1900 = 0.84 < 1
        oracle.setPrice(address(collateral), 200e18);
        assertLt(core.healthFactor(alice), 1e18);

        // a liquidator repays the debt and seizes collateral
        address liq = address(0x9999);
        usdg.mint(liq, 5000e18);
        vm.startPrank(liq);
        usdg.approve(address(core), type(uint256).max);
        core.liquidate(alice);
        vm.stopPrank();

        (uint256 col, uint256 debt) = core.positionOf(alice);
        assertEq(debt, 0);
        assertEq(col, 0); // fully seized in this simple backstop
        assertGt(collateral.balanceOf(liq), 0);
    }

    function test_setRiskModelOnlyOwner() public {
        StaticRiskModel other = new StaticRiskModel(address(this));
        vm.prank(address(0xBAD));
        vm.expectRevert();
        core.setRiskModel(address(other));
    }

    function test_setRiskModelSwapsModel() public {
        // a new model with a different threshold changes the health factor
        StaticRiskModel other = new StaticRiskModel(address(this));
        other.setThreshold(address(collateral), 5000); // 50% instead of 80%
        core.setRiskModel(address(other)); // owner = this (deployer)
        assertEq(address(core.riskModel()), address(other));

        vm.startPrank(alice);
        core.deposit(10e18); // 2500 value
        core.borrow(1000e18);
        vm.stopPrank();
        // HF = 2500*0.5/1000 = 1.25 (vs 2.0 under the old 80% model)
        assertEq(core.healthFactor(alice), 1.25e18);
    }

    /// F8: an attacker spamming repayFor(victim, 0) every block must NOT be able to freeze
    /// the victim's interest accrual. With a tiny debt whose per-second interest rounds to
    /// zero, the OLD code reset lastAccrued=now on every poke -> debt never grew. Fixed: the
    /// clock only advances when interest is actually charged, so elapsed time accumulates.
    function test_accrualGrindResistance() public {
        vm.startPrank(alice);
        core.deposit(10e18);
        core.borrow(100e6); // tiny debt: per-second interest truncates to 0
        vm.stopPrank();
        (, uint256 d0) = core.positionOf(alice);
        assertEq(d0, 100e6);

        address attacker = address(0xBEEF);
        for (uint256 i = 0; i < 20; i++) {
            vm.warp(block.timestamp + 1);
            vm.prank(attacker);
            core.repayFor(alice, 0); // the documented grind attempt
        }

        (, uint256 d1) = core.positionOf(alice);
        assertGt(d1, d0, "interest must accrue despite per-second repayFor(0) grinding");
    }

    function test_cannotLiquidateHealthy() public {
        vm.startPrank(alice);
        core.deposit(10e18);
        core.borrow(1000e18); // HF = 2.0
        vm.stopPrank();
        address liq = address(0x9999);
        usdg.mint(liq, 5000e18);
        vm.startPrank(liq);
        usdg.approve(address(core), type(uint256).max);
        vm.expectRevert(bytes("healthy"));
        core.liquidate(alice);
        vm.stopPrank();
    }
}
