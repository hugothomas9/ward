# Ward — décisions jour-1 (vérifications réelles sur chain 46630)

## Stylus on RH Chain (chain 46630)
- Probed: 2026-06-12
- Méthode : `eth_call` sur le précompile ArbWasm `0x0000000000000000000000000000000000000071`, fonction `stylusVersion()`
- Result: **ENABLED** — `stylusVersion() = 3`
- Consequence: le RiskEngine Stylus (Phase 5) se déploie **nativement sur RH Chain**. Pas besoin du fallback Arbitrum Sepolia.

## Collateral token (chain 46630)
- TSLA (`0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E`) :
  - `symbol()` = "TSLA", `decimals()` = **18**
  - Transfert simulé (`eth_call`, `transfer(dead, 1e18)` depuis le top holder `0xFfEf1147...`) : **true → TRANSFERABLE**
  - Le contrat est un proxy (pattern de délégation visible dans le bytecode)
- USDG (`0x7E955252E15c84f5768B83c41a71F9eba181802F`) :
  - `symbol()` = "USDG", `decimals()` = **6** ⚠️ (pas 18 !)
  - Transfert simulé : true
- Consequence:
  - **On utilise le VRAI stockToken TSLA comme collatéral** (pas de stand-in WTSLA). « Réel d'abord » pleinement satisfait.
  - **USDG = 6 decimals** : **[mis à jour par F13]** — au lieu d'encoder les décimales dans le prix (fragile), `LendingCore` lit `decimals()` des deux tokens au constructeur et normalise on-chain. Le prix oracle est désormais un **prix WAD USD propre** (250 USD = `250e18`), identique en test (18/18) et en prod (18/6). Plus de footgun ×1e12. Cf. `test/LendingCoreDecimals.t.sol`.

## Intel concurrentiel (découvert pendant les probes)
- Le 2e holder de TSLA testnet est un **AToken** (implémentation `0xC3Ad3194...`) : un fork Aave existe déjà sur le testnet RH Chain. Nos différenciateurs (autopilote Ward + risque dynamique Stylus) sont d'autant plus le bon angle — le squelette Aave brut est déjà pris.

## cargo stylus check — RiskEngine (2026-06-12)
- `cargo stylus check --endpoint=https://rpc.testnet.chain.robinhood.com` → **PASS**
- Contract size: 10.7 KB · wasm data fee ~0.000083 ETH
- Zéro opcode floating-point (math 100% fixed-point WAD) — déployable sur RH Chain tel quel.
- 6 tests Rust natifs verts (TestVM) : isqrt, vol réalisée (10% exact sur swings symétriques), seuil dynamique (8000→7600→4000), init one-shot.
