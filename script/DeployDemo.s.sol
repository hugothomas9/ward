// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LendingCore} from "../src/LendingCore.sol";
import {WardVault} from "../src/WardVault.sol";
import {MockV3Aggregator} from "../src/oracles/MockV3Aggregator.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {IRiskModel} from "../src/interfaces/IRiskModel.sol";
import {IInterestModel} from "../src/interfaces/IInterestModel.sol";

/// USDG de testnet mintable (le vrai USDG Paxos est verrouillé sur le testnet).
/// Même nom/symbole/décimales que le vrai, mais mint public -> faucet opérationnel.
contract DemoUSDG is ERC20 {
    constructor() ERC20("Global Dollar", "USDG") {}
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Redéploie un marché Ward 100% opérationnel sur le testnet :
///   - collatéral = le VRAI token TSLA Robinhood (inchangé)
///   - prix       = le feed existant (mis au cours réel)
///   - dette      = un USDG mintable (liquidité réelle, faucet)
/// Réutilise oracle + DynamicRiskModel (Stylus) + interestModel existants.
contract DeployDemo is Script {
    address constant TSLA = 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E;
    address constant FEED = 0xFf71D6a695363e96efDF62fD96e30c8889aDA4e7;
    address constant ORACLE = 0x7D38Fd1982C78fA35dd179a1E86A008b2063df99;
    address constant RISK_MODEL = 0x4bAD15Dc970519486D13EF830A0544b2D236e3dF;
    address constant INTEREST = 0xb4dc6db81cE6d9668b21e1428d71067a3CAf601B;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(pk);
        // prix réel de TSLA en 8 décimales (ex: 40643000000 = 406.43)
        int256 realPrice = int256(vm.envOr("REAL_PRICE_E8", uint256(40600000000)));
        uint256 seed = vm.envOr("SEED_USDG", uint256(200000)) * 1e6; // 200k USDG par défaut

        vm.startBroadcast(pk);

        DemoUSDG usdg = new DemoUSDG();

        LendingCore core = new LendingCore(
            TSLA,
            address(usdg),
            IPriceOracle(ORACLE),
            IRiskModel(RISK_MODEL),
            IInterestModel(INTEREST)
        );

        WardVault vault = new WardVault(core, IERC20(address(usdg)));

        // seed de liquidité : mint + provide pour que l'emprunt marche tout de suite
        usdg.mint(deployer, seed);
        usdg.approve(address(core), type(uint256).max);
        core.provide(seed);

        // cale le feed sur le cours réel de TSLA
        MockV3Aggregator(FEED).updateAnswer(realPrice);

        console2.log("== Ward DEMO (operationnel) sur chain 46630 ==");
        console2.log("USDG (mintable):", address(usdg));
        console2.log("LendingCore:", address(core));
        console2.log("WardVault:", address(vault));
        console2.log("Liquidite USDG seed:", seed);
        console2.log("Prix TSLA (8dec):", uint256(realPrice));

        vm.stopBroadcast();
    }
}
