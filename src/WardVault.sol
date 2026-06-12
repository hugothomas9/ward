// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRiskModel} from "./interfaces/IRiskModel.sol";
import {LendingCore} from "./LendingCore.sol";

/// SECURITY INVARIANT: the ONLY keeper-callable state-changing function is protect().
/// protect() can only repay a user's own debt from that user's own buffer. Do NOT add any
/// keeper-callable function that borrows, swaps, reinvests, opens positions, or moves funds
/// anywhere except (a) repaying debt or (b) returning funds to the user.
///
/// @notice Per-user anti-liquidation buffer + policy. The keeper (Ward bot) may ONLY call
/// protect(), which repays the user's own debt from the user's own buffer. By construction
/// the keeper cannot borrow, swap, reinvest, open positions, or move funds anywhere else.
contract WardVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    LendingCore public immutable core;
    IERC20 public immutable usdg;

    struct Policy {
        uint256 triggerHF;  // act when HF < triggerHF (1e18)
        uint256 targetHF;   // restore up to targetHF (1e18)
        address keeper;     // the only address allowed to call protect for this user
        bool set;
    }

    mapping(address => uint256) private _buffer; // user => USDG buffer
    mapping(address => Policy) private _policy;

    event Funded(address indexed user, uint256 amount);
    event Defunded(address indexed user, uint256 amount);
    event PolicySet(address indexed user, uint256 triggerHF, uint256 targetHF, address keeper);

    constructor(LendingCore core_, IERC20 usdg_) {
        core = core_;
        usdg = usdg_;
    }

    function fund(uint256 amount) external nonReentrant {
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        _buffer[msg.sender] += amount;
        emit Funded(msg.sender, amount);
    }

    /// @notice User withdraws their own buffer at will (de-risking the bot's reach).
    function defund(uint256 amount) external nonReentrant {
        require(amount <= _buffer[msg.sender], "exceeds buffer");
        _buffer[msg.sender] -= amount;
        usdg.safeTransfer(msg.sender, amount);
        emit Defunded(msg.sender, amount);
    }

    function setPolicy(uint256 triggerHF, uint256 targetHF, address keeper) external {
        require(targetHF >= triggerHF, "target<trigger");
        _policy[msg.sender] = Policy(triggerHF, targetHF, keeper, true);
        emit PolicySet(msg.sender, triggerHF, targetHF, keeper);
    }

    event Protected(address indexed user, uint256 repaid, uint256 newHealthFactor);

    /// @notice Keeper-only, de-risking-only: repay just enough of `user`'s debt from their
    /// buffer to restore targetHF. Cannot do anything else.
    function protect(address user) external nonReentrant {
        Policy memory pol = _policy[user];
        require(pol.set, "no policy");
        require(msg.sender == pol.keeper, "not keeper");
        require(core.healthFactor(user) < pol.triggerHF, "not triggered");

        (, uint256 debt) = core.positionOf(user);
        uint256 colValue = core.collateralValue(user);
        IRiskModel rm = core.riskModel();
        uint256 bps = rm.liquidationThresholdBps(address(core.collateralToken()));

        // target: colValue * bps/1e4 * 1e18 / newDebt = targetHF
        // => newDebt = colValue * bps * 1e18 / (1e4 * targetHF)
        uint256 newDebt = (colValue * bps * 1e18) / (10000 * pol.targetHF);
        uint256 repayAmount = debt > newDebt ? debt - newDebt : 0;
        require(repayAmount > 0, "nothing to repay");

        uint256 buf = _buffer[user];
        if (repayAmount > buf) repayAmount = buf; // spend at most the buffer
        require(repayAmount > 0, "empty buffer");

        // F9: never spend the buffer on a position that would stay liquidatable. The actual
        // (possibly buffer-capped) repayment must lift HF strictly above the 1.0 liquidation
        // line; otherwise we'd burn the user's buffer right before an unavoidable liquidation.
        // If it can clear 1.0 without reaching the target, we still act (partial protection).
        uint256 resultingDebt = debt - repayAmount;
        require(rm.healthFactor(colValue, resultingDebt, bps) >= 1e18, "cannot restore above liquidation");

        usdg.forceApprove(address(core), repayAmount);
        uint256 paid = core.repayFor(user, repayAmount);
        _buffer[user] -= paid;
        emit Protected(user, paid, core.healthFactor(user));
    }

    function bufferOf(address user) external view returns (uint256) {
        return _buffer[user];
    }

    function policyOf(address user)
        external view returns (uint256 triggerHF, uint256 targetHF, address keeper, bool set)
    {
        Policy memory p = _policy[user];
        return (p.triggerHF, p.targetHF, p.keeper, p.set);
    }
}
