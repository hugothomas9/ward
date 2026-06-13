// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardVault} from "../src/WardVault.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";

contract TT is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract WardVaultTest is Test {
    TT collateral; TT usdg;
    SettablePriceOracle oracle; StaticRiskModel risk; LinearInterestModel interest;
    LendingCore core; WardVault vault;
    address alice = address(0xA11CE);
    address keeper = address(0x1234); // the Ward bot

    function setUp() public {
        collateral = new TT("Wrapped TSLA","WTSLA");
        usdg = new TT("Global Dollar","USDG");
        oracle = new SettablePriceOracle(address(this));
        risk = new StaticRiskModel(address(this));
        interest = new LinearInterestModel(0);
        core = new LendingCore(address(collateral), address(usdg), oracle, risk, interest);
        oracle.setPrice(address(collateral), 250e18);
        risk.setThreshold(address(collateral), 8000);

        usdg.mint(address(this), 1_000_000e18);
        usdg.approve(address(core), type(uint256).max);
        core.provide(100_000e18);

        vault = new WardVault(core, usdg);

        collateral.mint(alice, 100e18);
        usdg.mint(alice, 10_000e18);
    }

    function _openAlice() internal {
        vm.startPrank(alice);
        collateral.approve(address(core), type(uint256).max);
        core.deposit(10e18);    // 2500 value
        core.borrow(1900e18);   // HF 1.05
        vm.stopPrank();
    }

    function test_fundBufferAndSetPolicy() public {
        _openAlice();
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.fund(2000e18);
        vault.setPolicy(1.2e18, 1.5e18, keeper);
        vm.stopPrank();

        assertEq(vault.bufferOf(alice), 2000e18);
        (uint256 trig, uint256 tgt, address k,) = vault.policyOf(alice);
        assertEq(trig, 1.2e18);
        assertEq(tgt, 1.5e18);
        assertEq(k, keeper);
    }

    function test_defundReturnsBuffer() public {
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.fund(2000e18);
        uint256 before = usdg.balanceOf(alice);
        vault.defund(500e18);
        vm.stopPrank();
        assertEq(vault.bufferOf(alice), 1500e18);
        assertEq(usdg.balanceOf(alice), before + 500e18);
    }

    function test_cannotDefundMoreThanBuffer() public {
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.fund(100e18);
        vm.expectRevert(bytes("exceeds buffer"));
        vault.defund(101e18);
        vm.stopPrank();
    }

    function test_policyTargetMustBeAboveTrigger() public {
        vm.prank(alice);
        vm.expectRevert(bytes("target<trigger"));
        vault.setPolicy(1.5e18, 1.2e18, keeper);
    }

    // R2: setPolicy(0, ...) must revert — a policy that never triggers is a false sense of security
    function test_policyZeroTriggerReverts() public {
        vm.prank(alice);
        vm.expectRevert(bytes("triggerHF=0"));
        vault.setPolicy(0, 0, keeper);
    }

    function _fundAndPolicy(uint256 amount) internal {
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.fund(amount);
        vault.setPolicy(1.2e18, 1.5e18, keeper);
        vm.stopPrank();
    }

    function test_protectRestoresHealth() public {
        _openAlice();
        _fundAndPolicy(2000e18);

        // crash: 250 -> 210 => value 2100, HF = 2100*0.8/1900 = 0.884 < trigger
        oracle.setPrice(address(collateral), 210e18);
        assertLt(core.healthFactor(alice), 1.2e18);

        vm.prank(keeper);
        vault.protect(alice);

        // HF restored to >= targetHF, debt reduced, buffer spent
        assertGe(core.healthFactor(alice), 1.5e18);
        assertLt(vault.bufferOf(alice), 2000e18);
    }

    function test_onlyKeeperCanProtect() public {
        _openAlice();
        _fundAndPolicy(2000e18);
        oracle.setPrice(address(collateral), 210e18);

        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("not keeper"));
        vault.protect(alice);
    }

    function test_protectNoopWhenHealthy() public {
        _openAlice();
        _fundAndPolicy(2000e18);
        oracle.setPrice(address(collateral), 400e18); // HF = 4000*0.8/1900 = 1.68 > trigger
        vm.prank(keeper);
        vm.expectRevert(bytes("not triggered"));
        vault.protect(alice);
    }

    /// F9: a buffer too small to lift the position back ABOVE the 1.0 liquidation line must
    /// NOT be spent — otherwise Ward burns the user's buffer right before an unavoidable
    /// liquidation. Here value=2100, debt=1900, buffer=100 -> best HF = 2100*0.8/1800 = 0.93
    /// still liquidatable, so protect() must revert and leave the buffer intact.
    function test_protectRevertsIfCannotLiftAboveLiquidation() public {
        _openAlice();
        _fundAndPolicy(100e18);

        oracle.setPrice(address(collateral), 210e18);
        vm.prank(keeper);
        vm.expectRevert(bytes("cannot restore above liquidation"));
        vault.protect(alice);

        assertEq(vault.bufferOf(alice), 100e18, "buffer must be untouched on revert");
    }

    /// F9: a buffer that cannot reach the TARGET but CAN lift HF above 1.0 must still act
    /// (spec: "s'il peut passer au-dessus de 1.0 sans atteindre la cible, il agit").
    /// value=2100, debt=1900, buffer=600 -> repay 600 -> debt 1300 -> HF = 2100*0.8/1300
    /// = 1.292 (>= 1.0, < target 1.5).
    function test_protectPartialAboveLiquidation() public {
        _openAlice();
        _fundAndPolicy(600e18);

        oracle.setPrice(address(collateral), 210e18);
        vm.prank(keeper);
        vault.protect(alice);

        assertEq(vault.bufferOf(alice), 0, "buffer fully spent");
        (, uint256 debt) = core.positionOf(alice);
        assertEq(debt, 1300e18);
        uint256 hf = core.healthFactor(alice);
        assertGe(hf, 1e18);
        assertLt(hf, 1.5e18); // acted below target but above liquidation
    }

    function test_protectRevertsOnEmptyBuffer() public {
        _openAlice();
        _fundAndPolicy(0);
        oracle.setPrice(address(collateral), 210e18);
        vm.prank(keeper);
        vm.expectRevert(bytes("empty buffer"));
        vault.protect(alice);
    }

    function test_protectRevertsWithoutPolicy() public {
        _openAlice();
        vm.prank(keeper);
        vm.expectRevert(bytes("no policy"));
        vault.protect(alice);
    }
}
