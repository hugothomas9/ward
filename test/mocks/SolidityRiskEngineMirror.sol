// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRiskEngine} from "../../src/interfaces/IRiskEngine.sol";

/// @notice FORGE-ONLY mirror of the Stylus RiskEngine (`stylus/src/lib.rs`). Foundry cannot
/// execute WASM, so this Solidity copy reproduces the EXACT fixed-point formulas to drive
/// end-to-end demos/tests. The deployed Rust engine is the source of truth (tested in Rust +
/// `cargo stylus check`); if you change the math in lib.rs, mirror it here.
contract SolidityRiskEngineMirror is IRiskEngine {
    uint256 constant WAD = 1e18;

    function realizedVol(uint256[] calldata prices) external pure returns (uint256) {
        uint256 n = prices.length;
        if (n < 2) return 0;
        int256[] memory rets = new int256[](n - 1);
        int256 sum;
        for (uint256 i = 1; i < n; i++) {
            uint256 prev = prices[i - 1];
            uint256 cur = prices[i];
            if (prev == 0) {
                rets[i - 1] = 0;
                continue;
            }
            int256 diff = int256(cur) - int256(prev);
            rets[i - 1] = (diff * int256(WAD)) / int256(prev);
            sum += rets[i - 1];
        }
        int256 mean = sum / int256(n - 1);
        uint256 varAcc;
        for (uint256 i = 0; i < rets.length; i++) {
            uint256 d = uint256(rets[i] >= mean ? rets[i] - mean : mean - rets[i]);
            varAcc += (d * d) / WAD;
        }
        uint256 variance = varAcc / (n - 1);
        return _isqrt(variance * WAD);
    }

    function dynamicThresholdBps(uint256 baseBps, uint256 volWad) external pure returns (uint256) {
        uint256 cap = volWad > WAD ? WAD : volWad;
        return (baseBps * (WAD - cap / 2)) / WAD;
    }

    function _isqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = x / 2 + 1;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
