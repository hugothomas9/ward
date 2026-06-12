// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInterestModel {
    /// @notice Accrued debt given principal, the rate state, and elapsed seconds.
    /// @dev MVP = linear variable rate. Fixed-rate (roadmap) plugs in by swapping this contract.
    /// @return newDebt principal grown by interest over `elapsed` seconds
    function accrue(uint256 principal, uint256 elapsed) external view returns (uint256 newDebt);
}
