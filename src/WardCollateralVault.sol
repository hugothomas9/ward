// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRiskModel} from "./interfaces/IRiskModel.sol";
import {LendingCore} from "./LendingCore.sol";

/// SECURITY INVARIANT: the ONLY keeper-callable state-changing function is topUp().
/// topUp() can only move collateral from the user's own reserve into the user's own lending
/// position. The keeper cannot withdraw, cannot receive funds, cannot reduce collateral.
///
/// @notice Per-user collateral reserve + policy. Complements WardVault (USDG buffer) with a
/// second de-risking lever: adding collateral instead of repaying debt.
contract WardCollateralVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    LendingCore public immutable core;
    IERC20 public immutable collateral;

    uint256 private immutable _collateralScale;
    uint256 private immutable _debtScale;

    struct Policy {
        uint256 triggerHF;
        uint256 targetHF;
        address keeper;
        bool set;
    }

    mapping(address => uint256) private _reserve;
    mapping(address => Policy) private _policy;

    event Reserved(address indexed user, uint256 amount);
    event Released(address indexed user, uint256 amount);
    event PolicySet(address indexed user, uint256 triggerHF, uint256 targetHF, address keeper);
    event ToppedUp(address indexed user, uint256 collateralAdded, uint256 newHealthFactor);

    constructor(LendingCore core_) {
        core = core_;
        collateral = core_.collateralToken();
        _collateralScale = 10 ** IERC20Metadata(address(core_.collateralToken())).decimals();
        _debtScale = 10 ** IERC20Metadata(address(core_.debtToken())).decimals();
    }

    /// @notice User deposits collateral token into their vault reserve.
    function deposit(uint256 amount) external nonReentrant {
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        _reserve[msg.sender] += amount;
        emit Reserved(msg.sender, amount);
    }

    /// @notice User withdraws from their reserve at will.
    function withdraw(uint256 amount) external nonReentrant {
        require(amount <= _reserve[msg.sender], "exceeds reserve");
        _reserve[msg.sender] -= amount;
        collateral.safeTransfer(msg.sender, amount);
        emit Released(msg.sender, amount);
    }

    function setPolicy(uint256 triggerHF, uint256 targetHF, address keeper) external {
        require(triggerHF > 0, "triggerHF=0");
        require(targetHF >= triggerHF, "target<trigger");
        _policy[msg.sender] = Policy(triggerHF, targetHF, keeper, true);
        emit PolicySet(msg.sender, triggerHF, targetHF, keeper);
    }

    /// @notice Keeper-only: move exactly enough collateral from user's reserve into user's
    /// lending position to restore targetHF. Cannot touch debt, cannot send funds elsewhere.
    function topUp(address user) external nonReentrant {
        Policy memory pol = _policy[user];
        require(pol.set, "no policy");
        require(msg.sender == pol.keeper, "not keeper");
        require(core.healthFactor(user) < pol.triggerHF, "not triggered");

        (, uint256 debt) = core.positionOf(user);
        require(debt > 0, "no debt");

        IRiskModel rm = core.riskModel();
        uint256 bps = rm.liquidationThresholdBps(address(collateral));
        uint256 currentCV = core.collateralValue(user);

        // newCV needed to reach targetHF: targetHF = newCV * bps * 1e18 / (10000 * debt)
        uint256 newCV = (pol.targetHF * 10000 * debt) / (bps * 1e18);
        uint256 deltaCV = newCV > currentCV ? newCV - currentCV : 0;
        require(deltaCV > 0, "already at target");

        // convert deltaCV (debt-token units) → collateral token units
        // collateralValue = col * px * debtScale / (1e18 * collateralScale)
        // => deltaCol = deltaCV * 1e18 * collateralScale / (px * debtScale)
        uint256 px = core.oracle().price(address(collateral));
        uint256 deltaCollateral = (deltaCV * 1e18 * _collateralScale) / (px * _debtScale);

        uint256 reserve = _reserve[user];
        if (deltaCollateral > reserve) deltaCollateral = reserve;
        require(deltaCollateral > 0, "empty reserve");

        _reserve[user] -= deltaCollateral;
        collateral.forceApprove(address(core), deltaCollateral);
        core.depositFor(user, deltaCollateral);

        emit ToppedUp(user, deltaCollateral, core.healthFactor(user));
    }

    function reserveOf(address user) external view returns (uint256) {
        return _reserve[user];
    }

    function policyOf(address user)
        external view returns (uint256 triggerHF, uint256 targetHF, address keeper, bool set)
    {
        Policy memory p = _policy[user];
        return (p.triggerHF, p.targetHF, p.keeper, p.set);
    }
}
