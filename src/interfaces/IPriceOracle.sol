// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPriceOracle {
    /// @return price USDG per 1 whole collateral token, scaled by 1e18
    function price(address asset) external view returns (uint256);
}
