// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRiskModel} from "../interfaces/IRiskModel.sol";

/// @notice Baseline risk model with governance-set static thresholds (Aave-style).
/// A future Stylus model implements the same interface with volatility-adjusted thresholds.
contract StaticRiskModel is IRiskModel, Ownable {
    mapping(address => uint256) private _thresholdBps;

    event ThresholdSet(address indexed asset, uint256 bps);

    constructor(address owner_) Ownable(owner_) {}

    function setThreshold(address asset, uint256 bps) external onlyOwner {
        require(bps <= 10000, "bps>100%");
        _thresholdBps[asset] = bps;
        emit ThresholdSet(asset, bps);
    }

    function liquidationThresholdBps(address asset) external view returns (uint256) {
        uint256 bps = _thresholdBps[asset];
        require(bps != 0, "threshold unset");
        return bps;
    }

    function healthFactor(uint256 collateralValue, uint256 debtValue, uint256 thresholdBps)
        external pure returns (uint256)
    {
        if (debtValue == 0) return type(uint256).max;
        // HF = collateralValue * threshold / debtValue, scaled 1e18
        return (collateralValue * thresholdBps * 1e18) / (debtValue * 10000);
    }
}
