# Ward — anti-liquidation autopilot on Robinhood Chain

> **Emprunte contre tes actions tokenisées sans le cauchemar de te faire liquider pendant que tu dors.**
> Un protocole de crédit adossé aux stockTokens de Robinhood Chain, dont le héros est **Ward** : un autopilote borné qui désendette ta position AVANT la liquidation — et qui, par construction, ne peut **que** te rendre plus safe.

Arbitrum Open House London Buildathon — track Robinhood Chain.

## La formule honnête

Le squelette de prêt est éprouvé façon Aave ; ce qu'on ajoute :
1. **Un autopilote anti-liquidation** — Aave te liquide ; Ward essaie de l'empêcher avant (remboursement précoce depuis TON buffer, selon TES règles).
2. **Un moteur de risque dynamique conscient de la volatilité** — calculé on-chain en **Stylus (Rust)**, là où Aave se contente de seuils statiques. **Câblé et actif** (pas un stretch).
3. **L'asset & le contexte** — actions tokenisées sur la chaîne de Robinhood : « du cash sans vendre tes actions ».

## L'invariant de sécurité (le cœur)

**Le keeper (bot Ward) ne peut appeler QUE `WardVault.protect(user)`** :
- `protect` rembourse la dette de l'utilisateur **depuis son propre buffer USDG**, jusqu'à restaurer son health factor cible. Rien d'autre.
- Aucune fonction de ré-emprunt, swap, réinvestissement ou retrait vers le keeper n'existe dans l'ABI (prouvé par allowlist exacte des sélecteurs dans `WardSecurityInvariant.t.sol`).
- Le keeper ne reçoit jamais un wei ; chaque USDG dépensé = réduction de dette exacte ; le collatéral est intouchable.

→ **Pire cas : ton buffer est consommé. Jamais pire.**

## Le moteur de risque dynamique (le différenciateur, sécurisé)

Seuil de liquidation **conscient de la volatilité**, dérivé d'un historique de prix **on-chain non-manipulable** :

- **`PriceHistory`** — ring buffer dont la seule porte d'entrée est `poke()`, qui lit le feed Chainlink lui-même. Aucun setter : personne ne peut injecter un prix ou une vol arbitraire **(F2)**.
- **`RiskEngine` (Stylus, Rust)** — vol réalisée + seuil, en fixed-point, pur/stateless.
- **`DynamicRiskModel`** — durcissement **borné en temps réel** (`rate × min(elapsed, 60s)` par refresh) : un refresh après un long trou ne peut pas effondrer le seuil et liquider une position que le prix seul n'aurait pas liquidée **(F3, anti-procyclicité)**. Données périmées → relâche vers la base au lieu de durcir sur du mort.
- **`ChainlinkPriceOracle`** — valorisation ET vol lisent le **même feed** : aucune divergence de prix.

Sur testnet, le feed est un `MockV3Aggregator` **owner-gated** (l'opérateur pilote le prix pour la démo) ; en prod, on remplace l'adresse par un vrai feed Chainlink — **0 changement de code**.

## Vérifications jour-1 sur le testnet réel (chain 46630)

Voir [DECISIONS.md](./DECISIONS.md) :
- ✅ **Stylus ACTIVÉ** (`ArbWasm.stylusVersion() = 3`)
- ✅ **TSLA transférable** → vrai stockToken en collatéral
- ⚠️ **USDG = 6 decimals** → géré on-chain (le prix oracle est un prix WAD propre, normalisé via `decimals()`)

## Architecture

```
src/
  interfaces/        IPriceOracle · IRiskModel · IInterestModel · IRiskEngine · AggregatorV3Interface
  oracles/           ChainlinkPriceOracle (prod) · MockV3Aggregator (feed testnet) · SettablePriceOracle (tests)
  models/            StaticRiskModel · DynamicRiskModel (vol-aware) · LinearInterestModel
  PriceHistory.sol   ring buffer on-chain alimenté par poke()->feed (source de vol non-manipulable)
  LendingCore.sol    deposit/borrow/repay/withdraw/health + liquidation + repayFor + setRiskModel
  WardVault.sol      buffer + policy + protect() — dé-risquant uniquement
stylus/src/lib.rs    RiskEngine Rust : vol réalisée + seuil dynamique (fixed-point, déployé via cargo stylus)
bot/                 keeper TS (viem) : maintenance (poke+refresh) puis protect()
script/
  DeployDynamic.s.sol  ★ LE déploiement (moteur dynamique actif)
  Deploy.s.sol         variante statique (StaticRiskModel) — pour comparaison/debug
test/                73 tests Foundry, dont MoneyShot v1 (statique) et MoneyShotV2 (moteur dynamique actif)
```

**89 tests verts au total** : **73 Foundry** (contrats) + **12 vitest** (bot) + **4 cargo** (Stylus).

## Le money shot

- `test/MoneyShot.t.sol` (statique) et **`test/MoneyShotV2.t.sol` (moteur dynamique ACTIF)** : deux positions identiques, le prix crashe.
- **A (sans Ward)** → HF < 1 → liquidé, perd tout son collatéral.
- **B (avec Ward)** → Ward rembourse depuis le buffer → HF ≥ 1.5, **garde ses 10 TSLA**, `liquidate(B)` revert `"healthy"`.
- En v2, le seuil **bouge** sous la volatilité (moteur Stylus actif), tout en restant borné (anti-procyclicité).

## Lancer

```bash
# tests contrats (73)
forge test

# tests bot (12)
cd bot && npm install && npm test

# tests RiskEngine Stylus (4) — la feature stylus-test est OBLIGATOIRE
#   (sans elle, stylus_sdk::testing n'est pas compilé et `cargo test` nu échoue)
cd stylus && cargo test --features stylus-test

# vérifier que le RiskEngine compile/déploie sur Robinhood Chain
cd stylus && cargo stylus check --endpoint=https://rpc.testnet.chain.robinhood.com

# déployer (moteur dynamique) — 2 étapes :
#   1) déployer le RiskEngine Stylus -> récupérer son adresse
cd stylus && cargo stylus deploy --endpoint=https://rpc.testnet.chain.robinhood.com --private-key=$DEPLOYER_KEY
#   2) déployer le reste en pointant dessus
export DEPLOYER_KEY=0x... RISK_ENGINE=0x<adresse_du_RiskEngine>
forge script script/DeployDynamic.s.sol --rpc-url rh_testnet --broadcast

# bot keeper (poke+refresh+protect)
cd bot && LENDING_CORE=0x... WARD_VAULT=0x... PRICE_HISTORY=0x... RISK_MODEL=0x... KEEPER_KEY=0x... TRACKED_USERS=0x...,0x... npm start
```

## Roadmap (pitch)

- **Taux fixe daté** — la dette est déjà `principal + intérêt` via `IInterestModel` interchangeable : le mode fixe se branche sans toucher au collatéral, au risque ni à l'autopilote.
- **VaR multi-collatéral** (covariance) en Stylus · actions dé-risquantes additionnelles · front consumer · cross-chain.

## Docs projet

- [STATUS.md](./STATUS.md) — rapport d'avancement (référentiel de suivi)
- [2026-06-12-ward-design.md](./2026-06-12-ward-design.md) — le spec validé
- [pitch-framing.md](./pitch-framing.md) — le positionnement honnête pour la présentation
- [DECISIONS.md](./DECISIONS.md) — les vérifications jour-1 sur le testnet réel
