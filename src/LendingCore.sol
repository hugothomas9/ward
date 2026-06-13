// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IRiskModel} from "./interfaces/IRiskModel.sol";
import {IInterestModel} from "./interfaces/IInterestModel.sol";

/// @notice Aave-style single-collateral lending core. Health/threshold behind IRiskModel,
/// interest behind IInterestModel (so fixed-rate can be added without touching this).
contract LendingCore is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;
    IERC20 public immutable debtToken; // USDG
    IPriceOracle public oracle;
    IRiskModel public riskModel;
    IInterestModel public interestModel;

    struct Position {
        uint256 collateral;   // collateral token amount
        uint256 principal;    // borrowed principal (USDG)
        uint256 lastAccrued;  // timestamp of last interest accrual
    }

    mapping(address => Position) private _positions;
    uint256 public availableLiquidity; // USDG provided by lenders, free to borrow

    // F13: decimals-correctness baked on-chain. The oracle price is a clean WAD USD price
    // (e.g. 250e18 = 250 USD per 1.0 collateral) regardless of token decimals; these scales
    // convert collateral value into debt-token units. No implicit "encode the decimals into
    // the price" convention to get wrong.
    uint256 private immutable _collateralScale; // 10 ** collateralDecimals
    uint256 private immutable _debtScale;       // 10 ** debtDecimals

    event Provided(address indexed lender, uint256 amount);
    event Deposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, address indexed payer, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(
        address collateral_,
        address debt_,
        IPriceOracle oracle_,
        IRiskModel risk_,
        IInterestModel interest_
    ) Ownable(msg.sender) {
        collateralToken = IERC20(collateral_);
        debtToken = IERC20(debt_);
        oracle = oracle_;
        riskModel = risk_;
        interestModel = interest_;
        _collateralScale = 10 ** IERC20Metadata(collateral_).decimals();
        _debtScale = 10 ** IERC20Metadata(debt_).decimals();
    }

    event RiskModelSet(address indexed riskModel);

    /// @notice F11: swap the risk model (e.g. Static -> Dynamic Stylus engine) without
    /// redeploying the core. Owner-gated.
    function setRiskModel(address risk_) external onlyOwner {
        require(risk_ != address(0), "zero");
        riskModel = IRiskModel(risk_);
        emit RiskModelSet(risk_);
    }

    // --- lender side (real USDG liquidity) ---
    function provide(uint256 amount) external nonReentrant {
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
        availableLiquidity += amount;
        emit Provided(msg.sender, amount);
    }

    // --- borrower side ---
    function deposit(uint256 amount) external nonReentrant {
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        _positions[msg.sender].collateral += amount;
        if (_positions[msg.sender].lastAccrued == 0) {
            _positions[msg.sender].lastAccrued = block.timestamp;
        }
        emit Deposited(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        _accrue(msg.sender);
        require(amount <= availableLiquidity, "insufficient liquidity");
        _positions[msg.sender].principal += amount;
        availableLiquidity -= amount;
        require(healthFactor(msg.sender) >= 1e18, "unhealthy");
        debtToken.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant {
        _accrue(msg.sender);
        Position storage p = _positions[msg.sender];
        uint256 pay = amount > p.principal ? p.principal : amount;
        debtToken.safeTransferFrom(msg.sender, address(this), pay);
        p.principal -= pay;
        availableLiquidity += pay;
        emit Repaid(msg.sender, msg.sender, pay);
    }

    function withdraw(uint256 amount) external nonReentrant {
        _accrue(msg.sender);
        Position storage p = _positions[msg.sender];
        require(amount <= p.collateral, "exceeds collateral");
        p.collateral -= amount;
        require(healthFactor(msg.sender) >= 1e18, "unhealthy");
        collateralToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice De-risking primitive: caller repays `user`'s debt. Only ever reduces debt.
    function repayFor(address user, uint256 amount) external nonReentrant returns (uint256 paid) {
        _accrue(user);
        Position storage p = _positions[user];
        paid = amount > p.principal ? p.principal : amount;
        debtToken.safeTransferFrom(msg.sender, address(this), paid);
        p.principal -= paid;
        availableLiquidity += paid;
        emit Repaid(user, msg.sender, paid);
    }

    // --- liquidation backstop ---
    event Liquidated(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);

    /// @notice Simple full-position backstop: liquidator repays debt, seizes all collateral.
    /// The product's POINT is that Ward prevents reaching this; kept minimal on purpose.
    function liquidate(address user) external nonReentrant {
        _accrue(user);
        require(healthFactor(user) < 1e18, "healthy");
        Position storage p = _positions[user];
        uint256 debt = p.principal;
        uint256 col = p.collateral;
        p.principal = 0;
        p.collateral = 0;
        availableLiquidity += debt;
        debtToken.safeTransferFrom(msg.sender, address(this), debt);
        collateralToken.safeTransfer(msg.sender, col);
        emit Liquidated(user, msg.sender, debt, col);
    }

    // --- views ---
    function positionOf(address user) external view returns (uint256 collateral, uint256 debt) {
        Position memory p = _positions[user];
        return (p.collateral, _currentDebt(p));
    }

    function collateralValue(address user) public view returns (uint256) {
        uint256 px = oracle.price(address(collateralToken)); // WAD USD price per 1.0 collateral
        // value in debt-token units:
        //   collateral / collateralScale  (whole tokens)
        //   * px / 1e18                    (USD)
        //   * debtScale                    (to debt-token units)
        return (_positions[user].collateral * px * _debtScale) / (1e18 * _collateralScale);
    }

    function healthFactor(address user) public view returns (uint256) {
        Position memory p = _positions[user];
        uint256 debt = _currentDebt(p);
        uint256 bps = riskModel.liquidationThresholdBps(address(collateralToken));
        return riskModel.healthFactor(collateralValue(user), debt, bps);
    }

    // --- internal ---
    function _currentDebt(Position memory p) internal view returns (uint256) {
        if (p.principal == 0) return 0;
        uint256 elapsed = block.timestamp - p.lastAccrued;
        return interestModel.accrue(p.principal, elapsed);
    }

    function _accrue(address user) internal {
        Position storage p = _positions[user];
        if (p.principal == 0) {
            p.lastAccrued = block.timestamp;
            return;
        }
        uint256 newDebt = _currentDebt(p);
        // F8: if interest rounded down to zero over this interval, do NOT advance the clock.
        // Resetting lastAccrued here is what let an attacker grind a victim's accrual to a
        // permanent standstill by poking (e.g. repayFor(victim, 0)) every block on a small
        // debt. Keeping the old timestamp lets elapsed time accumulate until it charges
        // real interest, making the grind impossible regardless of poke frequency.
        if (newDebt == p.principal) {
            return;
        }
        p.principal = newDebt;
        p.lastAccrued = block.timestamp;
    }
}
