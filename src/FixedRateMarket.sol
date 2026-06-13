// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IRiskModel} from "./interfaces/IRiskModel.sol";
import {TermRateModel} from "./models/TermRateModel.sol";

/// @notice Fixed-rate single-collateral lending market. Borrowers lock a rate for a tenor at
/// borrow time; debt accrues linearly. A 2% maturity penalty applies after the tenor expires.
/// Reuses IPriceOracle + IRiskModel so Ward can extend protection to fixed-rate positions.
contract FixedRateMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant YEAR = 365 days;
    uint256 public constant MATURITY_PENALTY_BPS = 200; // 2% of principal

    IERC20 public immutable collateralToken;
    IERC20 public immutable debtToken;
    IPriceOracle public immutable oracle;
    IRiskModel public immutable riskModel;
    TermRateModel public immutable termRates;

    uint256 private immutable _collateralScale;
    uint256 private immutable _debtScale;

    struct Position {
        uint256 collateral;
        uint256 principal;
        uint256 fixedRate;  // bps/year locked at borrow time
        uint256 start;      // timestamp of borrow
        uint256 maturity;   // timestamp after which penalty applies
    }

    mapping(address => Position) private _positions;
    uint256 public availableLiquidity;

    event Provided(address indexed lender, uint256 amount);
    event Deposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount, uint256 fixedRate, uint256 maturity);
    event Repaid(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);

    constructor(
        address collateral_,
        address debt_,
        IPriceOracle oracle_,
        IRiskModel risk_,
        TermRateModel termRates_
    ) {
        collateralToken = IERC20(collateral_);
        debtToken = IERC20(debt_);
        oracle = oracle_;
        riskModel = risk_;
        termRates = termRates_;
        _collateralScale = 10 ** IERC20Metadata(collateral_).decimals();
        _debtScale = 10 ** IERC20Metadata(debt_).decimals();
    }

    function provide(uint256 amount) external nonReentrant {
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
        availableLiquidity += amount;
        emit Provided(msg.sender, amount);
    }

    function deposit(uint256 amount) external nonReentrant {
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        _positions[msg.sender].collateral += amount;
        emit Deposited(msg.sender, amount);
    }

    function borrow(uint256 amount, uint256 tenor) external nonReentrant {
        uint256 rate = termRates.getRate(tenor);
        require(amount <= availableLiquidity, "insufficient liquidity");
        Position storage p = _positions[msg.sender];
        require(p.principal == 0, "existing borrow");
        p.principal = amount;
        p.fixedRate = rate;
        p.start = block.timestamp;
        p.maturity = block.timestamp + tenor;
        availableLiquidity -= amount;
        require(healthFactor(msg.sender) >= 1e18, "unhealthy");
        debtToken.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, rate, p.maturity);
    }

    function repay(uint256 amount) external nonReentrant {
        uint256 owed = currentDebt(msg.sender);
        uint256 pay = amount > owed ? owed : amount;
        debtToken.safeTransferFrom(msg.sender, address(this), pay);
        Position storage p = _positions[msg.sender];
        if (pay >= owed) {
            availableLiquidity += p.principal;
            p.principal = 0; p.fixedRate = 0; p.start = 0; p.maturity = 0;
        } else {
            // checkpoint: remaining owed becomes new principal, reset accrual clock
            availableLiquidity += (p.principal * pay) / owed;
            p.principal = owed - pay;
            p.start = block.timestamp;
        }
        emit Repaid(msg.sender, pay);
    }

    function withdraw(uint256 amount) external nonReentrant {
        Position storage p = _positions[msg.sender];
        require(amount <= p.collateral, "exceeds collateral");
        p.collateral -= amount;
        require(healthFactor(msg.sender) >= 1e18, "unhealthy");
        collateralToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function liquidate(address user) external nonReentrant {
        require(healthFactor(user) < 1e18, "healthy");
        Position storage p = _positions[user];
        uint256 debt = currentDebt(user);
        uint256 col = p.collateral;
        availableLiquidity += p.principal;
        p.principal = 0; p.collateral = 0; p.fixedRate = 0; p.start = 0; p.maturity = 0;
        debtToken.safeTransferFrom(msg.sender, address(this), debt);
        collateralToken.safeTransfer(msg.sender, col);
        emit Liquidated(user, msg.sender, debt, col);
    }

    function positionOf(address user) external view returns (
        uint256 collateral, uint256 principal, uint256 fixedRate, uint256 start, uint256 maturity
    ) {
        Position memory p = _positions[user];
        return (p.collateral, p.principal, p.fixedRate, p.start, p.maturity);
    }

    function currentDebt(address user) public view returns (uint256) {
        Position memory p = _positions[user];
        if (p.principal == 0) return 0;
        uint256 elapsed = block.timestamp - p.start;
        uint256 interest = (p.principal * p.fixedRate * elapsed) / (YEAR * 10000);
        uint256 debt = p.principal + interest;
        if (block.timestamp > p.maturity) {
            debt += (p.principal * MATURITY_PENALTY_BPS) / 10000;
        }
        return debt;
    }

    function collateralValue(address user) public view returns (uint256) {
        uint256 px = oracle.price(address(collateralToken));
        return (_positions[user].collateral * px * _debtScale) / (1e18 * _collateralScale);
    }

    function healthFactor(address user) public view returns (uint256) {
        uint256 debt = currentDebt(user);
        if (debt == 0) return type(uint256).max;
        uint256 bps = riskModel.liquidationThresholdBps(address(collateralToken));
        return riskModel.healthFactor(collateralValue(user), debt, bps);
    }
}
