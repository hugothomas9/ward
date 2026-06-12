// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRiskModel {
    /// @notice Liquidation threshold in basis points (e.g. 8000 = 80%) for an asset.
    /// @dev A dynamic model may adjust this by recent volatility. Static model returns a constant.
    function liquidationThresholdBps(address asset) external view returns (uint256);

    /// @notice Health factor scaled by 1e18. >= 1e18 is safe, < 1e18 is liquidatable.
    /// @param collateralValue USDG value of collateral, scaled 1e18
    /// @param debtValue USDG value of debt, scaled 1e18
    /// @param thresholdBps liquidation threshold in bps for the collateral asset
    function healthFactor(uint256 collateralValue, uint256 debtValue, uint256 thresholdBps)
        external pure returns (uint256);
}
