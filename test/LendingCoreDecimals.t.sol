// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";

contract Token18 is ERC20 {
    constructor() ERC20("TSLA", "TSLA") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract Token6 is ERC20 {
    constructor() ERC20("Global Dollar", "USDG") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// F13: mirror the REAL deployment — 18-dec collateral (TSLA), 6-dec debt (USDG) — and prove
/// the system is decimals-correct ON-CHAIN. The oracle price is a clean WAD USD price (250e18),
/// the natural reflex; LendingCore normalizes via each token's decimals(), so there is no
/// "set 250e6 or blow up the collateral by 1e12" footgun anymore.
contract LendingCoreDecimalsTest is Test {
    Token18 col;
    Token6 usdg;
    SettablePriceOracle oracle;
    StaticRiskModel risk;
    LinearInterestModel interest;
    LendingCore core;
    address alice = address(0xA11CE);

    function setUp() public {
        col = new Token18();
        usdg = new Token6();
        oracle = new SettablePriceOracle(address(this));
        risk = new StaticRiskModel(address(this));
        interest = new LinearInterestModel(0);
        core = new LendingCore(address(col), address(usdg), oracle, risk, interest);

        oracle.setPrice(address(col), 250e18); // clean WAD USD price: 250 USD per TSLA
        risk.setThreshold(address(col), 8000);

        usdg.mint(address(this), 1_000_000e6);
        usdg.approve(address(core), type(uint256).max);
        core.provide(100_000e6);

        col.mint(alice, 100e18);
        vm.prank(alice);
        col.approve(address(core), type(uint256).max);
    }

    function test_collateralValueIsInSixDecDebtUnits() public {
        vm.prank(alice);
        core.deposit(10e18); // 10 TSLA @ 250 USD = 2500 USDG
        // value must be 2500e6 (6-dec), NOT 2500e18
        assertEq(core.collateralValue(alice), 2500e6);
    }

    function test_borrowAndHealthAreSixDecCorrect() public {
        vm.startPrank(alice);
        core.deposit(10e18);     // 2500e6 value
        core.borrow(1000e6);     // 1000 USDG (6-dec)
        vm.stopPrank();
        (, uint256 debt) = core.positionOf(alice);
        assertEq(debt, 1000e6);
        // HF = 2500*0.8/1000 = 2.0 (in WAD, decimals cancel)
        assertEq(core.healthFactor(alice), 2e18);
    }

    function test_cannotBorrowBeyondSixDecThreshold() public {
        vm.startPrank(alice);
        core.deposit(10e18); // 2500e6 value, max borrow = 2000e6
        vm.expectRevert(bytes("unhealthy"));
        core.borrow(2001e6);
        vm.stopPrank();
    }
}
