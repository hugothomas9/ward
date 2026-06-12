// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardVault} from "../src/WardVault.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";

contract IT is ERC20 {
    constructor() ERC20("T","T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// Documents and enforces the security invariant: the keeper's ONLY reachable state-changing
/// surface on WardVault is protect(), and protect() can ONLY reduce the user's debt using the
/// user's own buffer. Funds can never leave toward the keeper.
contract WardSecurityInvariantTest is Test {
    IT collateral; IT usdg;
    SettablePriceOracle oracle; StaticRiskModel risk; LinearInterestModel interest;
    LendingCore core; WardVault vault;
    address alice = address(0xA11CE);
    address keeper = address(0x1234);

    function setUp() public {
        collateral = new IT(); usdg = new IT();
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

        collateral.mint(alice, 10e18);
        usdg.mint(alice, 2000e18);
        vm.startPrank(alice);
        collateral.approve(address(core), type(uint256).max);
        core.deposit(10e18);
        core.borrow(1900e18);
        usdg.approve(address(vault), type(uint256).max);
        vault.fund(2000e18);
        vault.setPolicy(1.2e18, 1.5e18, keeper);
        vm.stopPrank();
    }

    /// PROOF (not documentation): the WardVault ABI is EXACTLY this allowlist.
    /// This reads the compiled artifact's method set and asserts it equals the intended
    /// surface. ANY function added — whatever its name, args, or internal guards — grows
    /// the set and fails this test. That is what makes "de-risking only" provable rather
    /// than an honor system: a keeper-callable `borrowFor` guarded by require(msg.sender ==
    /// keeper) would still appear here and break the build.
    ///
    /// Surface classification:
    ///   views (read-only)        : bufferOf, core, policyOf, usdg
    ///   user-only (msg.sender)   : fund, defund, setPolicy
    ///   keeper-callable mutating : protect            <-- the ONLY one
    function test_exactSelectorAllowlist() public view {
        string memory json = vm.readFile("out/WardVault.sol/WardVault.json");
        string[] memory sigs = vm.parseJsonKeys(json, ".methodIdentifiers");

        string[8] memory allowed = [
            "bufferOf(address)",
            "core()",
            "policyOf(address)",
            "usdg()",
            "fund(uint256)",
            "defund(uint256)",
            "setPolicy(uint256,uint256,address)",
            "protect(address)"
        ];

        assertEq(
            sigs.length,
            allowed.length,
            "WardVault ABI surface changed -- a function was added/removed; justify and update the allowlist"
        );
        for (uint256 i = 0; i < sigs.length; i++) {
            bool ok;
            for (uint256 j = 0; j < allowed.length; j++) {
                if (keccak256(bytes(sigs[i])) == keccak256(bytes(allowed[j]))) {
                    ok = true;
                    break;
                }
            }
            assertTrue(ok, string.concat("forbidden function on WardVault: ", sigs[i]));
        }
    }

    /// No fallback/receive escape hatch that could route value or arbitrary calls.
    function test_noFallbackEscapeHatch() public {
        (bool s,) = address(vault).call(hex"deadbeef");
        assertFalse(s, "WardVault must have no fallback");
        (bool s2,) = address(vault).call{value: 0}("");
        assertFalse(s2, "WardVault must have no receive");
    }

    /// protect() must never move funds to the keeper, and must only ever DECREASE debt.
    function test_protectOnlyDecreasesDebtAndPaysNothingToKeeper() public {
        oracle.setPrice(address(collateral), 210e18); // trigger
        (, uint256 debtBefore) = core.positionOf(alice);
        uint256 keeperBalBefore = usdg.balanceOf(keeper);
        uint256 vaultBalBefore = usdg.balanceOf(address(vault));

        vm.prank(keeper);
        vault.protect(alice);

        (, uint256 debtAfter) = core.positionOf(alice);
        assertLt(debtAfter, debtBefore, "debt must decrease");
        assertEq(usdg.balanceOf(keeper), keeperBalBefore, "keeper must receive nothing");
        // every USDG that left the vault went into the lending pool as repayment
        uint256 spent = vaultBalBefore - usdg.balanceOf(address(vault));
        assertEq(spent, debtBefore - debtAfter, "all spent buffer == debt reduction");
    }

    /// The user's collateral must be untouchable by the keeper through any vault path.
    function test_protectNeverTouchesCollateral() public {
        oracle.setPrice(address(collateral), 210e18);
        (uint256 colBefore,) = core.positionOf(alice);
        vm.prank(keeper);
        vault.protect(alice);
        (uint256 colAfter,) = core.positionOf(alice);
        assertEq(colAfter, colBefore, "collateral untouched");
    }
}
