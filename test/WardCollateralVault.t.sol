// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardCollateralVault} from "../src/WardCollateralVault.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";

contract FT is ERC20 {
    constructor() ERC20("T","T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract WardCollateralVaultTest is Test {
    FT collateral; FT usdg;
    SettablePriceOracle oracle; StaticRiskModel risk; LinearInterestModel interest;
    LendingCore core; WardCollateralVault vault;

    address alice = address(0xA11CE);
    address keeper = address(0x1234);

    function setUp() public {
        collateral = new FT(); usdg = new FT();
        oracle = new SettablePriceOracle(address(this));
        risk = new StaticRiskModel(address(this));
        interest = new LinearInterestModel(0);
        core = new LendingCore(address(collateral), address(usdg), oracle, risk, interest);
        oracle.setPrice(address(collateral), 250e18);
        risk.setThreshold(address(collateral), 8000);

        usdg.mint(address(this), 1_000_000e18);
        usdg.approve(address(core), type(uint256).max);
        core.provide(500_000e18);

        vault = new WardCollateralVault(core);

        collateral.mint(alice, 100e18);
        vm.startPrank(alice);
        collateral.approve(address(core), type(uint256).max);
        collateral.approve(address(vault), type(uint256).max);
        // borrow against 10 TSLA @ $250 = $2000 value, borrow $1900 (HF ≈ 1.05)
        core.deposit(10e18);
        usdg.mint(alice, 2000e18);
        usdg.approve(address(core), type(uint256).max);
        core.borrow(1500e18); // HF = 2000/1500 ≈ 1.33 > triggerHF 1.2 at $250
        // deposit 20 TSLA as reserve in WardCollateralVault
        vault.deposit(20e18);
        vault.setPolicy(1.2e18, 1.5e18, keeper);
        vm.stopPrank();
    }

    // ── reserve management ──────────────────────────────────────────────────

    function test_depositIncreasesReserve() public view {
        assertEq(vault.reserveOf(alice), 20e18);
    }

    function test_withdrawDecreasesReserve() public {
        vm.prank(alice);
        vault.withdraw(5e18);
        assertEq(vault.reserveOf(alice), 15e18);
    }

    function test_withdrawExceedsReserveReverts() public {
        vm.prank(alice);
        vm.expectRevert(bytes("exceeds reserve"));
        vault.withdraw(100e18);
    }

    // ── policy ──────────────────────────────────────────────────────────────

    function test_setPolicyStored() public view {
        (uint256 trig, uint256 tgt, address kp, bool s) = vault.policyOf(alice);
        assertEq(trig, 1.2e18);
        assertEq(tgt, 1.5e18);
        assertEq(kp, keeper);
        assertTrue(s);
    }

    function test_setPolicyZeroTriggerReverts() public {
        vm.prank(alice);
        vm.expectRevert(bytes("triggerHF=0"));
        vault.setPolicy(0, 0, keeper);
    }

    // ── topUp (security-first) ───────────────────────────────────────────────

    function test_topUpNotKeeperReverts() public {
        oracle.setPrice(address(collateral), 210e18);
        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("not keeper"));
        vault.topUp(alice);
    }

    function test_topUpNoPolicyReverts() public {
        address bob = address(0xB0B);
        vm.prank(keeper);
        vm.expectRevert(bytes("no policy"));
        vault.topUp(bob);
    }

    function test_topUpNotTriggeredReverts() public {
        // HF ≈ 1.05, triggerHF = 1.2 — should not act
        vm.prank(keeper);
        vm.expectRevert(bytes("not triggered"));
        vault.topUp(alice);
    }

    function test_topUpOnlyIncreasesCollateral() public {
        oracle.setPrice(address(collateral), 210e18);
        (uint256 colBefore,) = core.positionOf(alice);
        uint256 keeperColBefore = collateral.balanceOf(keeper);

        vm.prank(keeper);
        vault.topUp(alice);

        (uint256 colAfter,) = core.positionOf(alice);
        assertGt(colAfter, colBefore, "collateral must increase");
        assertEq(collateral.balanceOf(keeper), keeperColBefore, "keeper receives nothing");
    }

    function test_topUpResolvesToTargetHF() public {
        oracle.setPrice(address(collateral), 210e18);
        vm.prank(keeper);
        vault.topUp(alice);
        assertGe(core.healthFactor(alice), 1.5e18 - 1e12); // 1 wei rounding tolerance
    }

    function test_topUpReducesReserve() public {
        oracle.setPrice(address(collateral), 210e18);
        uint256 reserveBefore = vault.reserveOf(alice);
        vm.prank(keeper);
        vault.topUp(alice);
        assertLt(vault.reserveOf(alice), reserveBefore);
    }

    function test_topUpDebtUnchanged() public {
        oracle.setPrice(address(collateral), 210e18);
        (, uint256 debtBefore) = core.positionOf(alice);
        vm.prank(keeper);
        vault.topUp(alice);
        (, uint256 debtAfter) = core.positionOf(alice);
        assertEq(debtAfter, debtBefore, "debt must not change");
    }

    // ── ABI surface (security invariant) ────────────────────────────────────

    /// WardCollateralVault's keeper-callable surface is EXACTLY topUp(address).
    function test_exactSelectorAllowlist() public view {
        string memory json = vm.readFile("out/WardCollateralVault.sol/WardCollateralVault.json");
        string[] memory sigs = vm.parseJsonKeys(json, ".methodIdentifiers");

        string[8] memory allowed = [
            "collateral()",
            "core()",
            "policyOf(address)",
            "reserveOf(address)",
            "deposit(uint256)",
            "withdraw(uint256)",
            "setPolicy(uint256,uint256,address)",
            "topUp(address)"
        ];

        assertEq(sigs.length, allowed.length, "WardCollateralVault ABI surface changed");
        for (uint256 i = 0; i < sigs.length; i++) {
            bool ok;
            for (uint256 j = 0; j < allowed.length; j++) {
                if (keccak256(bytes(sigs[i])) == keccak256(bytes(allowed[j]))) {
                    ok = true;
                    break;
                }
            }
            assertTrue(ok, string.concat("forbidden function on WardCollateralVault: ", sigs[i]));
        }
    }

    function test_noFallback() public {
        (bool s,) = address(vault).call(hex"deadbeef");
        assertFalse(s, "no fallback");
        (bool s2,) = address(vault).call{value: 0}("");
        assertFalse(s2, "no receive");
    }

    /// topUp must never move collateral to the keeper.
    function test_topUpNeverPaysKeeper() public {
        oracle.setPrice(address(collateral), 210e18);
        uint256 keeperBalBefore = collateral.balanceOf(keeper);
        vm.prank(keeper);
        vault.topUp(alice);
        assertEq(collateral.balanceOf(keeper), keeperBalBefore);
    }
}
