// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardVault} from "../src/WardVault.sol";
import {SettablePriceOracle} from "../src/oracles/SettablePriceOracle.sol";
import {StaticRiskModel} from "../src/models/StaticRiskModel.sol";
import {LinearInterestModel} from "../src/models/LinearInterestModel.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _dec;
    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) { _dec = d; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// Deploys Ward against LOCAL mock tokens for Anvil development.
/// No DEPLOYER_KEY needed — uses Anvil's default account (index 0).
///
/// Usage:
///   anvil &
///   forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
///
/// The script also seeds liquidity and opens a demo position so the bot can be pointed at it.
/// Export the logged addresses as env vars then: cd bot && npm start
contract DeployLocal is Script {
    function run() external {
        // Anvil default private key (account 0)
        uint256 pk = vm.envOr("DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        // Mock tokens: TSLA (18 dec) + USDG (6 dec, matches mainnet)
        MockERC20 tsla = new MockERC20("Mock TSLA", "mTSLA", 18);
        MockERC20 usdg = new MockERC20("Mock USDG", "mUSDG", 6);

        SettablePriceOracle oracle = new SettablePriceOracle(deployer);
        StaticRiskModel risk = new StaticRiskModel(deployer);
        LinearInterestModel interest = new LinearInterestModel(0.05e18); // 5% APR

        oracle.setPrice(address(tsla), 250e18); // $250 per TSLA, WAD
        risk.setThreshold(address(tsla), 8000); // 80% LTV

        LendingCore core = new LendingCore(address(tsla), address(usdg), oracle, risk, interest);
        WardVault vault = new WardVault(core, IERC20(address(usdg)));

        // --- seed: lender provides 100k USDG liquidity ---
        usdg.mint(deployer, 200_000e6);
        usdg.approve(address(core), type(uint256).max);
        core.provide(100_000e6);

        // --- demo borrower position (Anvil account 1) ---
        address borrower = vm.addr(2); // account index 1 (pk index 2 = 0x59c6...)
        tsla.mint(borrower, 100e18);
        usdg.mint(borrower, 10_000e6);

        vm.stopBroadcast();

        console2.log("=== Ward LOCAL deployment (Anvil) ===");
        console2.log("MockTSLA:    ", address(tsla));
        console2.log("MockUSDG:    ", address(usdg));
        console2.log("Oracle:      ", address(oracle));
        console2.log("RiskModel:   ", address(risk));
        console2.log("InterestModel:", address(interest));
        console2.log("LendingCore: ", address(core));
        console2.log("WardVault:   ", address(vault));
        console2.log("Demo borrower:", borrower);
        console2.log("");
        console2.log("--- Start bot (example) ---");
        console2.log("cd bot && LENDING_CORE=<core> WARD_VAULT=<vault> PRICE_HISTORY=0x0000000000000000000000000000000000000001 RISK_MODEL=0x0000000000000000000000000000000000000001 KEEPER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 RH_RPC_URL=http://127.0.0.1:8545 TRACKED_USERS=<borrower> npm start");
    }
}
