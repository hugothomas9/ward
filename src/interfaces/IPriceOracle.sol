// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPriceOracle {
    /// @notice Clean WAD USD price of one whole collateral token (e.g. 250 USD => 250e18),
    /// independent of token decimals. LendingCore converts this into debt-token units on-chain
    /// using each token's decimals() (see LendingCore.collateralValue). Do NOT encode the debt
    /// token's decimals into this price — that re-introduces the ~1e12 mis-scaling footgun.
    /// @return priceWad WAD (1e18-scaled) USD price per 1.0 collateral token
    function price(address asset) external view returns (uint256 priceWad);
}
