// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardVault} from "../src/WardVault.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";
import {DynamicRiskModel} from "../src/models/DynamicRiskModel.sol";
import {PriceHistory} from "../src/PriceHistory.sol";
import {MockV3Aggregator} from "../src/oracles/MockV3Aggregator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Deploys Ward with the DYNAMIC, Stylus-powered risk engine wired in (F1 end-to-end).
///
/// Two-step deploy (the Stylus engine is WASM, deployed separately):
///   1. cd stylus && cargo stylus deploy --endpoint <rpc> --private-key $PK   -> RISK_ENGINE addr
///   2. RISK_ENGINE=0x... forge script script/DeployDynamic.s.sol --rpc-url rh_testnet --broadcast
///
/// On testnet a MockV3Aggregator stands in for the Chainlink feed (demo-controllable). In prod,
/// set FEED=<real Chainlink aggregator> and the same code path uses it unchanged.
contract DeployDynamic is Script {
    address constant TSLA = 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E;
    address constant USDG = 0x7E955252E15c84f5768B83c41a71F9eba181802F;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address engine = vm.envAddress("RISK_ENGINE"); // deployed Stylus RiskEngine
        address usdg = vm.envOr("USDG_ADDR", USDG);
        address collateral = vm.envOr("COLLATERAL", TSLA);
        uint256 initialPriceWad = vm.envOr("INITIAL_PRICE", uint256(250e18));
        require(initialPriceWad >= 1e16, "INITIAL_PRICE looks unscaled (expect WAD)");
        require(initialPriceWad <= 1e30, "INITIAL_PRICE too large");

        vm.startBroadcast(pk);

        // price feed for the vol history: real Chainlink aggregator in prod, mock on testnet
        address feed = vm.envOr("FEED", address(0));
        if (feed == address(0)) {
            // 8-dec Chainlink-style feed, seeded at 250 USD
            feed = address(new MockV3Aggregator(8, 250e8));
            console2.log("Deployed MockV3Aggregator feed:", feed);
        }

        SettablePriceOracle oracle = new SettablePriceOracle(vm.addr(pk));
        oracle.setPrice(collateral, initialPriceWad);

        LinearInterestModel interest = new LinearInterestModel(0.05e18);

        PriceHistory history = new PriceHistory(feed, 1 hours, 60);

        // base 80% threshold, tighten at most 1 bps/sec (F3 circuit breaker)
        DynamicRiskModel dyn = new DynamicRiskModel(address(history), engine, collateral, 8000, 1);

        // boot with a static model then swap to the dynamic engine (F11)
        StaticRiskModel boot = new StaticRiskModel(vm.addr(pk));
        boot.setThreshold(collateral, 8000);
        LendingCore core = new LendingCore(collateral, usdg, oracle, boot, interest);
        core.setRiskModel(address(dyn));

        WardVault vault = new WardVault(core, IERC20(usdg));

        console2.log("== Ward (dynamic engine) on chain 46630 ==");
        console2.log("RiskEngine (Stylus):", engine);
        console2.log("PriceHistory:", address(history));
        console2.log("DynamicRiskModel:", address(dyn));
        console2.log("Oracle:", address(oracle));
        console2.log("LendingCore:", address(core));
        console2.log("WardVault:", address(vault));

        vm.stopBroadcast();
    }
}
