// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Solidity view of the Stylus RiskEngine (pure vol + threshold math).
/// Stylus exports snake_case Rust methods as camelCase ABI, so `realized_vol` ->
/// `realizedVol`, `dynamic_threshold_bps` -> `dynamicThresholdBps`.
interface IRiskEngine {
    function realizedVol(uint256[] calldata pricesWad) external view returns (uint256 volWad);

    function dynamicThresholdBps(uint256 baseBps, uint256 volWad) external view returns (uint256 effectiveBps);
}
