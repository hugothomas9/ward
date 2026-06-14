# Ward — déploiement testnet (Robinhood Chain, chain 46630)

> Déploiement réel du **moteur dynamique actif** (DeployDynamic.s.sol), le 2026-06-12.
> RPC : `https://rpc.testnet.chain.robinhood.com` · Explorer : `https://explorer.testnet.chain.robinhood.com`

## Adresses

| Contrat | Adresse |
|---|---|
| **RiskEngine** (Stylus, Rust) | `0x65d5dc0C78b390b50aBd1f62F0F8F2e5AF18db13` |
| **PriceHistory** | `0xBe61f02a744Bb55a2577e877BD4C0A7Fe160d1e2` |
| **DynamicRiskModel** | `0x4bAD15Dc970519486D13EF830A0544b2D236e3dF` |
| **ChainlinkPriceOracle** | `0x7D38Fd1982C78fA35dd179a1E86A008b2063df99` |
| **LendingCore** | `0x55994C3D261dc2c0CE9348530090e81663020aa5` |
| **WardVault** | `0x1e9F327fAaa14BB2Dc41B2A0080317547788bF1D` |
| **MockV3Aggregator** (feed démo, owner-gated) | `0xFf71D6a695363e96efDF62fD96e30c8889aDA4e7` |
| Collateral (vrai TSLA) | `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` |
| Dette (vrai USDG, 6 dec) | `0x7E955252E15c84f5768B83c41a71F9eba181802F` |

Deployer : `0xDA547bb1e6a9ED39c375703A75e13a82FCefc85E`

## Marché DÉMO opérationnel (DeployDemo, 2026-06-14)

> Le vrai USDG Paxos est verrouillé sur le testnet (mint restreint, aucun faucet).
> Pour un front 100% opérationnel : collatéral = **vrai TSLA**, prix = **cours réel**,
> dette = **USDG de testnet mintable** (même nom/symbole/6 déc). Réutilise l'oracle,
> le DynamicRiskModel (Stylus) et l'interestModel d'origine.

| Contrat | Adresse |
|---|---|
| **LendingCore** (démo) | `0x193C18301695d38Faf9393887c3a6a2A69A7783b` |
| **WardVault** (démo) | `0x72FabE6972BfF5F21D208701bC59e94A29F05558` |
| **USDG** (mintable, "Global Dollar") | `0x7d6ac1CBC33d15B5A6d7371d59d501c1CF6acd64` |

- Pool seedé : **200 000 USDG** de liquidité.
- Feed calé sur le **cours réel de TSLA** (~$406), resynchronisé par `POST /api/crash`.
- C'est ce marché que le front (`web/`) utilise.

## Preuves on-chain (vérifiées par `cast call`)

- `LendingCore.riskModel()` = `0x4bAD15Dc…` (le **DynamicRiskModel**) → câblage F1+F11 prouvé sur la vraie chaîne.
- `DynamicRiskModel.liquidationThresholdBps(TSLA)` = **8000** (base, avant tout poke).
- **Le moteur Stylus calcule en direct**, appelé depuis Solidity :
  - `RiskEngine.dynamicThresholdBps(8000, 0)` = **8000**
  - `RiskEngine.dynamicThresholdBps(8000, 1e17)` = **7600** (seuil resserré à 10 % de vol — le Rust tourne on-chain)

## Lancer le bot contre ce déploiement

```bash
cd bot
LENDING_CORE=0x55994C3D261dc2c0CE9348530090e81663020aa5 \
WARD_VAULT=0x1e9F327fAaa14BB2Dc41B2A0080317547788bF1D \
PRICE_HISTORY=0xBe61f02a744Bb55a2577e877BD4C0A7Fe160d1e2 \
RISK_MODEL=0x4bAD15Dc970519486D13EF830A0544b2D236e3dF \
KEEPER_KEY=0x... TRACKED_USERS=0x...,0x... npm start
```

## Refaire un déploiement

`./deploy-testnet.sh` (le wallet `.env` doit être fundé via le faucet).
