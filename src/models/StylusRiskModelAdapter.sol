// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRiskModel} from "../interfaces/IRiskModel.sol";

interface IStylusRiskEngine {
    function dynamicThresholdBps(uint256 volWad) external view returns (uint256);
}

/// @notice Bridges the Stylus RiskEngine (Rust, volatility-aware) into IRiskModel so it
/// plugs into LendingCore without touching it. An updater (the Ward bot) refreshes the
/// realized vol from a Chainlink price window; the Stylus engine converts vol into an
/// effective liquidation threshold. Updating vol is de-risking-only in spirit: a higher
/// vol can only TIGHTEN the threshold (earlier alerts), never loosen it past the base.
contract StylusRiskModelAdapter is IRiskModel {
    IStylusRiskEngine public immutable engine;
    address public immutable updater;

    mapping(address => uint256) public latestVolWad; // asset => realized vol (1e18)

    event VolUpdated(address indexed asset, uint256 volWad);

    constructor(address engine_, address updater_) {
        engine = IStylusRiskEngine(engine_);
        updater = updater_;
    }

    function setVol(address asset, uint256 volWad) external {
        require(msg.sender == updater, "not updater");
        latestVolWad[asset] = volWad;
        emit VolUpdated(asset, volWad);
    }

    function liquidationThresholdBps(address asset) external view returns (uint256) {
        return engine.dynamicThresholdBps(latestVolWad[asset]);
    }

    function healthFactor(uint256 collateralValue, uint256 debtValue, uint256 thresholdBps)
        external pure returns (uint256)
    {
        if (debtValue == 0) return type(uint256).max;
        return (collateralValue * thresholdBps * 1e18) / (debtValue * 10000);
    }
}
