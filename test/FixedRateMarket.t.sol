// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FixedRateMarket} from "../src/FixedRateMarket.sol";
import {TermRateModel} from "../src/models/TermRateModel.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";

contract Tok is ERC20 {
    uint8 private _dec;
    constructor(string memory n, uint8 d) ERC20(n, n) { _dec = d; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract TermRateModelTest is Test {
    TermRateModel model;

    function setUp() public {
        model = new TermRateModel(address(this));
    }

    function test_setAndGetRate() public {
        model.setRate(30 days, 500); // 5% APR for 30-day tenor
        assertEq(model.getRate(30 days), 500);
    }

    function test_setRate_nonOwnerReverts() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        model.setRate(30 days, 500);
    }

    function test_getRate_unknownTenorReverts() public {
        vm.expectRevert(bytes("no rate for tenor"));
        model.getRate(99 days);
    }

    function test_setRate_zeroTenorReverts() public {
        vm.expectRevert(bytes("tenor=0"));
        model.setRate(0, 500);
    }

    function test_updateRate() public {
        model.setRate(30 days, 500);
        model.setRate(30 days, 600);
        assertEq(model.getRate(30 days), 600);
    }
}

contract FixedRateMarketTest is Test {
    uint256 constant YEAR = 365 days;

    Tok collateral; Tok usdg;
    SettablePriceOracle oracle; StaticRiskModel risk; TermRateModel termRates;
    FixedRateMarket market;

    address alice = address(0xA11CE);
    address liquidator = address(0xD1CE);

    function setUp() public {
        collateral = new Tok("TSLA", 18);
        usdg = new Tok("USDG", 6);
        oracle = new SettablePriceOracle(address(this));
        risk = new StaticRiskModel(address(this));
        termRates = new TermRateModel(address(this));

        oracle.setPrice(address(collateral), 250e18); // $250 per TSLA
        risk.setThreshold(address(collateral), 8000); // 80% LTV
        termRates.setRate(30 days, 500);   // 5% APR
        termRates.setRate(365 days, 800);  // 8% APR

        market = new FixedRateMarket(
            address(collateral), address(usdg), oracle, risk, termRates
        );

        // seed liquidity
        usdg.mint(address(this), 1_000_000e6);
        usdg.approve(address(market), type(uint256).max);
        market.provide(500_000e6);

        // alice gets collateral
        collateral.mint(alice, 100e18);
        usdg.mint(alice, 100_000e6);
        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    function test_depositAndBorrow() public {
        vm.startPrank(alice);
        market.deposit(10e18); // 10 TSLA = $2500 collateral
        market.borrow(1000e6, 30 days); // borrow $1000 at 5% APR
        vm.stopPrank();

        (uint256 col, uint256 principal, uint256 rate, , uint256 maturity) = market.positionOf(alice);
        assertEq(col, 10e18);
        assertEq(principal, 1000e6);
        assertEq(rate, 500);
        assertApproxEqAbs(maturity, block.timestamp + 30 days, 1);
    }

    function test_debtAccruesAtFixedRate() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        market.borrow(1000e6, 365 days); // 8% APR for 1 year
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        uint256 debt = market.currentDebt(alice);
        // expected: 1000e6 + 1000e6 * 800 / 10000 = 1080e6 (8% annual)
        assertApproxEqAbs(debt, 1080e6, 1e3); // within $0.001
    }

    function test_noDebtBeforeBorrow() public {
        assertEq(market.currentDebt(alice), 0);
    }

    function test_borrowRevertsForUnknownTenor() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        vm.expectRevert(bytes("no rate for tenor"));
        market.borrow(1000e6, 90 days);
        vm.stopPrank();
    }

    function test_borrowRevertsIfUnhealthy() public {
        vm.startPrank(alice);
        market.deposit(1e18); // only $250 collateral
        vm.expectRevert(bytes("unhealthy"));
        market.borrow(250e6, 30 days); // 100% LTV — exceeds 80% threshold
        vm.stopPrank();
    }

    function test_fullRepay() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        market.borrow(1000e6, 30 days);
        vm.warp(block.timestamp + 30 days);
        uint256 owed = market.currentDebt(alice);
        market.repay(owed + 1e6); // repay more than owed → capped
        vm.stopPrank();

        (, uint256 principal,,, ) = market.positionOf(alice);
        assertEq(principal, 0);
    }

    function test_withdrawAfterRepay() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        market.borrow(1000e6, 30 days);
        uint256 owed = market.currentDebt(alice);
        market.repay(owed);
        uint256 colBefore = collateral.balanceOf(alice);
        market.withdraw(10e18);
        vm.stopPrank();
        assertEq(collateral.balanceOf(alice), colBefore + 10e18);
    }

    function test_withdrawRevertsIfUnhealthy() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        market.borrow(1500e6, 30 days); // high utilisation
        vm.expectRevert(bytes("unhealthy"));
        market.withdraw(10e18);
        vm.stopPrank();
    }

    function test_maturityPenalty() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        market.borrow(1000e6, 30 days); // 5% APR
        vm.stopPrank();

        // jump past maturity
        vm.warp(block.timestamp + 31 days);
        uint256 debt = market.currentDebt(alice);
        // interest: 1000 * 500 * 31days / (YEAR * 10000)
        uint256 interest = (1000e6 * 500 * 31 days) / (YEAR * 10000);
        uint256 penalty = (1000e6 * 200) / 10000; // 2%
        assertApproxEqAbs(debt, 1000e6 + interest + penalty, 1e3);
    }

    function test_liquidateWhenUnhealthy() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        market.borrow(1000e6, 30 days);
        vm.stopPrank();

        // price crashes → HF < 1
        oracle.setPrice(address(collateral), 100e18); // $100 per TSLA
        assertLt(market.healthFactor(alice), 1e18);

        usdg.mint(liquidator, 10_000e6);
        vm.startPrank(liquidator);
        usdg.approve(address(market), type(uint256).max);
        market.liquidate(alice);
        vm.stopPrank();

        assertEq(collateral.balanceOf(liquidator), 10e18);
        (, uint256 principal,,,) = market.positionOf(alice);
        assertEq(principal, 0);
    }

    function test_liquidateRevertsIfHealthy() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        market.borrow(1000e6, 30 days);
        vm.stopPrank();

        vm.expectRevert(bytes("healthy"));
        market.liquidate(alice);
    }

    function test_healthFactorMaxWhenNoDebt() public {
        vm.prank(alice);
        market.deposit(10e18);
        assertEq(market.healthFactor(alice), type(uint256).max);
    }

    function test_cannotBorrowTwice() public {
        vm.startPrank(alice);
        market.deposit(10e18);
        market.borrow(500e6, 30 days);
        vm.expectRevert(bytes("existing borrow"));
        market.borrow(100e6, 30 days);
        vm.stopPrank();
    }
}
