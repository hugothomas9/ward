// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPriceOracle {
    /// @return price USD per 1 whole collateral token, in WAD (1e18). LendingCore normalises
    ///         on-chain using each token's decimals() — do NOT encode decimals into this value.
    function price(address asset) external view returns (uint256);
}
