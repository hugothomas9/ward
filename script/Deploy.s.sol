// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardVault} from "../src/WardVault.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// NOTE: STATIC-risk-model variant (StaticRiskModel), kept for comparison/debug. THE production
/// deployment is `DeployDynamic.s.sol` (dynamic Stylus risk engine — the differentiator).
///
/// Deploys Ward against the REAL Robinhood Chain testnet tokens (day-1 verified):
///   TSLA  0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E (18 dec, transferable)
///   USDG  0x7E955252E15c84f5768B83c41a71F9eba181802F (6 dec)
///
/// F13: the oracle price is a CLEAN WAD USD PRICE (250 USD per TSLA = 250e18), the natural
/// reflex. LendingCore reads each token's decimals() and normalizes on-chain, so there is no
/// "encode the 6 decimals into the price" footgun. The sanity check below still rejects an
/// obviously mis-scaled price (e.g. a raw integer) as defense in depth.
///
/// Usage:
///   export DEPLOYER_KEY=0x...
///   forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast
contract Deploy is Script {
    address constant TSLA = 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E;
    address constant USDG = 0x7E955252E15c84f5768B83c41a71F9eba181802F;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address usdg = vm.envOr("USDG_ADDR", USDG);
        address collateral = vm.envOr("COLLATERAL", TSLA);
        // WAD USD price: 250 USD per TSLA = 250e18 (decimals handled on-chain by LendingCore)
        uint256 initialPrice = vm.envOr("INITIAL_PRICE", uint256(250e18));
        // defense in depth: a WAD price for a stock is ~1e18..1e24; reject a raw/unscaled value
        require(initialPrice >= 1e16, "INITIAL_PRICE looks unscaled (expect WAD, e.g. 250e18)");

        vm.startBroadcast(pk);

        SettablePriceOracle oracle = new SettablePriceOracle(vm.addr(pk));
        StaticRiskModel risk = new StaticRiskModel(vm.addr(pk));
        LinearInterestModel interest = new LinearInterestModel(0.05e18); // 5% APR

        oracle.setPrice(collateral, initialPrice);
        risk.setThreshold(collateral, 8000); // 80%

        LendingCore core = new LendingCore(collateral, usdg, oracle, risk, interest);
        WardVault vault = new WardVault(core, IERC20(usdg));

        console2.log("== Ward deployment (chain 46630) ==");
        console2.log("Collateral (TSLA):", collateral);
        console2.log("USDG:", usdg);
        console2.log("Oracle:", address(oracle));
        console2.log("RiskModel:", address(risk));
        console2.log("InterestModel:", address(interest));
        console2.log("LendingCore:", address(core));
        console2.log("WardVault:", address(vault));

        vm.stopBroadcast();
    }
}
