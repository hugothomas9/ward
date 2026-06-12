# Ward — anti-liquidation autopilot on Robinhood Chain

> **Emprunte contre tes actions tokenisées sans le cauchemar de te faire liquider pendant que tu dors.**
> Un protocole de crédit adossé aux stockTokens de Robinhood Chain, dont le héros est **Ward** : un autopilote borné qui désendette ta position AVANT la liquidation — et qui, par construction, ne peut **que** te rendre plus safe.

Arbitrum Open House London Buildathon — track Robinhood Chain.

## La formule honnête

Le squelette de prêt est éprouvé façon Aave ; ce qu'on ajoute :
1. **Un autopilote anti-liquidation** — Aave te liquide ; Ward essaie de l'empêcher avant (remboursement précoce depuis TON buffer, selon TES règles).
2. **Un moteur de risque interchangeable** — seuils statiques aujourd'hui, modèle Stylus conscient de la volatilité demain (l'interface `IRiskModel` est prête).
3. **L'asset & le contexte** — actions tokenisées sur la chaîne de Robinhood : « du cash sans vendre tes actions ».

## L'invariant de sécurité (le cœur)

**Le keeper (bot Ward) ne peut appeler QUE `WardVault.protect(user)`** :
- `protect` rembourse la dette de l'utilisateur **depuis son propre buffer USDG**, jusqu'à restaurer son health factor cible. Rien d'autre.
- Aucune fonction de ré-emprunt, swap, réinvestissement ou retrait vers le keeper n'existe dans l'ABI.
- Prouvé par les tests (`WardSecurityInvariant.t.sol`) : le keeper ne reçoit jamais un wei ; chaque USDG dépensé = réduction de dette exacte ; le collatéral est intouchable.

→ **Pire cas : ton buffer est consommé. Jamais pire.**

## Vérifications jour-1 sur le testnet réel (chain 46630)

Voir [DECISIONS.md](./DECISIONS.md) :
- ✅ **Stylus ACTIVÉ** sur Robinhood Chain (`ArbWasm.stylusVersion() = 3`)
- ✅ **TSLA transférable** (simulation `transfer` depuis un vrai holder → `true`) → on utilise le **vrai stockToken** comme collatéral
- ⚠️ **USDG = 6 decimals** → convention de prix oracle encodée dans le deploy script uniquement

## Architecture

```
src/
  interfaces/        IPriceOracle · IRiskModel · IInterestModel (fixed-rate ready)
  oracles/           SettablePriceOracle (démo crash; adapter Chainlink ensuite)
  models/            StaticRiskModel (Aave-style) · LinearInterestModel
  LendingCore.sol    deposit/borrow/repay/withdraw/health + liquidation backstop + repayFor
  WardVault.sol      buffer + policy + protect() — dé-risquant uniquement
bot/                 keeper TypeScript (viem) : monitor → shouldProtect → protect()
script/Deploy.s.sol  déploiement sur les VRAIS tokens RH Chain (TSLA + USDG 6-dec)
stylus/              (stretch) RiskEngine Rust : vol réalisée + seuil dynamique
test/                46 tests Foundry, dont MoneyShot.t.sol
```

**59 tests verts au total** : 46 Foundry (contrats) + 7 vitest (bot) + 6 cargo (Stylus).

## Le money shot (prouvé par test)

`test/MoneyShot.t.sol` : deux positions identiques, le prix crashe.
- **A (sans Ward)** → HF < 1 → liquidé, perd tout son collatéral.
- **B (avec Ward)** → à HF < 1.2, Ward rembourse depuis le buffer → HF ≥ 1.5, **garde ses 10 TSLA**, `liquidate(B)` revert `"healthy"`.

Variante crash brutal incluse : même quand le buffer ne suffit pas à atteindre la cible, Ward améliore quand même l'issue.

## Lancer

```bash
# tests contrats (46)
forge test

# tests bot (7)
cd bot && npm install && npm test

# tests RiskEngine Stylus (6) — la feature stylus-test est OBLIGATOIRE
#   (sans elle, stylus_sdk::testing n'est pas compilé et `cargo test` nu échoue)
cd stylus && cargo test --features stylus-test

# vérifier que le RiskEngine compile/déploie sur Robinhood Chain
cd stylus && cargo stylus check --endpoint=https://rpc.testnet.chain.robinhood.com

# deploy sur RH Chain testnet
export DEPLOYER_KEY=0x...
forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast

# bot keeper
cd bot && LENDING_CORE=0x... WARD_VAULT=0x... KEEPER_KEY=0x... TRACKED_USERS=0x...,0x... npm start
```

## Roadmap (pitch)

- **Taux fixe daté** — la dette est déjà `principal + intérêt` via `IInterestModel` interchangeable : le mode fixe se branche sans toucher au collatéral, au risque ni à l'autopilote.
- **RiskEngine Stylus** — vol réalisée + seuil dynamique + time-to-danger en Rust fixed-point (Stylus confirmé actif sur la chaîne). Même interface `IRiskModel`.
- **VaR multi-collatéral**, actions dé-risquantes additionnelles, front consumer.

## Docs projet

- [2026-06-12-ward-design.md](./2026-06-12-ward-design.md) — le spec validé
- [2026-06-12-ward-plan.md](./2026-06-12-ward-plan.md) — le plan d'implémentation
- [pitch-framing.md](./pitch-framing.md) — le positionnement honnête pour la présentation
- [DECISIONS.md](./DECISIONS.md) — les vérifications jour-1 sur le testnet réel
