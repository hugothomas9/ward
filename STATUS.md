# Ward — Rapport d'avancement

> Référentiel de suivi du projet. Mis à jour à la fin de chaque bloc de travail.
> Dernière mise à jour : **2026-06-13** (après Bloc 1 + Bloc 2 + Bloc 3 finitions).
> Source de vérité granulaire : le `git log`. Ce fichier en est la synthèse lisible.

**État global :** MVP on-chain solide et testé, moteur dynamique câblé, **+ tous les garde-fous et durcissements non-bloquants appliqués (Bloc 3)**.

- Tests : **64 Foundry** (+ 6 nouveau ChainlinkAdapter) + **~17 vitest (bot)** + **5 cargo (Stylus)** = **~86 verts, 0 échec**
- Déploiement local : **`script/DeployLocal.s.sol` disponible pour Anvil** (mocks TSLA + USDG)
- Déploiement testnet réel : pas encore broadcast (nécessite un wallet fundé ; `DeployDynamic.s.sol` prêt)

### Bloc 2 — moteur de risque dynamique (fait)

| Pièce | Fait | Finding |
|---|---|---|
| `AggregatorV3Interface` + `MockV3Aggregator` (feed real-shaped) | ✅ | — |
| `PriceHistory` : ring buffer on-chain, `poke()` lit le feed → **provenance imposée** | ✅ | F2 |
| RiskEngine Stylus rendu **pur/stateless** (plus d'`init`) | ✅ | F7 dissous |
| `DynamicRiskModel` : vol → seuil avec **durcissement borné par bloc** | ✅ | F3 |
| `LendingCore.setRiskModel` owner-gated | ✅ | F11 |
| Câblage + **money shot v2 sous moteur dynamique actif** + bot `poke`/`refresh` | ✅ | F1 |

**Tests d'attaque inclus** : impossible d'injecter une vol arbitraire (F2) ; le scénario chiffré procyclique (HF 1.25→0.98) **ne liquide plus** (F3).

---

## 1. Ce qui a été fait initialement (Phases 0 → 5)

Construit en TDD, un commit par tâche. Vérifications jour-1 faites sur le **vrai testnet** Robinhood Chain (chain 46630).

| Phase | Livrable | État |
|---|---|---|
| **0 — Setup & vérifs jour-1** | Foundry scaffold ; sondes réseau réelles | ✅ Fait |
| | → Stylus **ACTIVÉ** sur RH Chain (`ArbWasm.stylusVersion()=3`) | ✅ Vérifié |
| | → TSLA **transférable** (sim. depuis un vrai holder) → vrai stockToken en collatéral | ✅ Vérifié |
| | → USDG = **6 decimals** (≠ 18) → géré on-chain (cf. F13) | ✅ Vérifié |
| **1 — Lending core** | `IPriceOracle` / `IRiskModel` / `IInterestModel` | ✅ Fait |
| | `SettablePriceOracle` (source prix démo, owner-settable) | ✅ Fait |
| | `StaticRiskModel` (seuils statiques, façon Aave) | ✅ Fait |
| | `LinearInterestModel` (taux variable linéaire, interface interchangeable → prêt taux fixe) | ✅ Fait |
| | `LendingCore` : deposit / borrow / repay / withdraw / healthFactor / liquidate | ✅ Fait |
| **2 — WardVault (le héros)** | buffer USDG + policy par user | ✅ Fait |
| | `protect()` : repay dé-risquant depuis le buffer, borné | ✅ Fait |
| | Invariant de sécurité (le keeper ne fait que `protect`) | ✅ Fait (renforcé au Bloc 1, cf. F4) |
| **3 — Bot Ward** | keeper TypeScript (viem) : monitor → `shouldProtect` → `protect()` | ✅ Fait |
| | Strictement borné aux actions dé-risquantes | ✅ Fait |
| **4 — Deploy & money shot** | `Deploy.s.sol` (vrais tokens RH Chain) | ✅ Fait (pas broadcast) |
| | `MoneyShot.t.sol` : 2 positions, crash, A liquidé / B sauvé par Ward | ✅ Fait (prouvé en test) |
| **5 — RiskEngine Stylus** *(stretch)* | `lib.rs` : vol réalisée + seuil dynamique + time-to-danger, **fixed-point** | ✅ Écrit + `cargo stylus check` PASS sur RH Chain |
| | `StylusRiskModelAdapter` (IRiskModel) | ⚠️ Écrit mais **orphelin** (non câblé — voir Bloc 2) |

---

## 2. Ce qui a été corrigé (Bloc 1, suite à la 1ʳᵉ review ultra)

7 correctifs, chacun en TDD avec son test, un commit par correctif.

| Finding | Gravité | Correctif | Commit |
|---|---|---|---|
| **F4** | HIGH | Faux test d'invariant (passait même avec un `borrowFor` gardé keeper) → remplacé par une **allowlist exacte des sélecteurs** (lit l'ABI compilée). Prouvé : échoue si on injecte une fonction offensive. | `026bc10` |
| **F8** | MED | **Griefing d'accrual** (spam `repayFor(victim,0)` → dette gelée par troncature) → `_accrue` ne réinitialise plus l'horloge quand l'intérêt tronque à 0. | `13cb7f7` |
| **F9** | MED | `protect()` pouvait **vider le buffer sans sauver** la position → post-condition : revert si le repay ne ramène pas HF ≥ 1.0 (protection partielle au-dessus de 1.0 conservée). | `f7582aa` |
| **F12** | MED | User sans policy = **no-op silencieux** côté bot → le bot lit `policy.set`, **warn** au démarrage + chaque cycle ; contrat revert `"no policy"`. | `d556260` |
| **F13** | LOW→fond | Convention décimales en **commentaire** (footgun ×1e12 au redeploy) → `LendingCore` lit `decimals()` des 2 tokens et normalise **on-chain** ; prix = WAD USD propre partout. | `f1e6119` |
| **F10** | MED | Spec promettait une action keeper « rendre des fonds » jamais codée → **côté sûr** : surface keeper = exactement `protect()` ; retrait via `defund()` (user) ; reste en roadmap. Spec alignée. | `cbca293` |
| **F14** | LOW | Doc `cargo test --features stylus-test` ajoutée ; compte de tests corrigé. | `3d2c3cc` |

**Non corrigés volontairement** (décisions assumées, pas des bugs) : **F5** (oracle/risk ownés par un EOA — choix de démo) · **F6** (liquidation full-seizure — backstop minimal assumé).

**2ᵉ review ultra (post-Bloc 1)** : aucun FATAL/HIGH, Bloc 1 confirmé sain (F13 sans overflow, F8 sans fuite de temps, F9 correct, allowlist valide). Findings résiduels reportés → section 3.

---

## 3. Ce qu'il reste à faire

### 🔴 BLOC 2 — câbler le moteur de risque dynamique (LE cœur, priorité absolue)

Le moteur Stylus existe et est validé, mais **déconnecté** : aujourd'hui le système déployé utilise `StaticRiskModel`, et la vol viendrait d'un chiffre poussé à la main. Deux exigences **non-négociables** :

| # | Tâche | Finding lié | Détail |
|---|---|---|---|
| 1 | **Source de prix non-manipulable on-chain** | F2 | Stocker la fenêtre de prix **on-chain** (ring buffer alimenté dans le temps), dériver la vol de cet historique, alimenter via TWAP (+ médiane multi-feed si possible) avec **staleness + bornes**. Critère : plus personne ne peut injecter une vol arbitraire. |
| 2 | **Zéro procyclicité liquidante** | F3 | Hystérésis / grace period / **borne de variation du seuil par bloc**, coordonnés avec `protect()` pour que le durcissement ne liquide jamais un user que le prix seul n'aurait pas liquidé. Test rejouant le scénario chiffré (HF 1.25 → 0.98). |
| 3 | **`setRiskModel` owner-gated** sur `LendingCore` | F11 | Sinon brancher l'adapter = redéployer tout le core. |
| 4 | **Câbler le pipeline complet** | F1 | Déployer `StylusRiskEngine` + adapter, pointer `LendingCore` dessus, construire la boucle prix → vol → seuil. **Le money shot doit tourner avec le moteur Stylus ACTIF.** |
| 5 | **`init()` du moteur Stylus non front-runnable** | F7 | owner-gated ou fixé au constructeur (one-shot permissionless aujourd'hui). |

### 🟡 Durcissements & dette technique (non bloquants, post-review)

| Item | Source | État | Détail |
|---|---|---|---|
| Commentaire `IPriceOracle` périmé | R1 (MED) | ✅ **Fait** | Corrigé : prix = USD WAD, normalisation on-chain explicite. `ChainlinkOracleAdapter` livré. |
| `setPolicy` accepte `(0,0)` zombie | R2 (LOW) | ✅ **Fait** | `require(triggerHF > 0, "triggerHF=0")` ajouté + test. |
| `Deploy.s.sol` sans borne haute de prix | R4 (LOW) | ✅ **Fait** | `require(initialPrice <= 1e30)` dans `Deploy.s.sol` et `DeployDynamic.s.sol`. |
| `LIQUIDATION_BONUS_BPS` mort | R6 (INFO) | ✅ **Fait** | Constante supprimée (n'était jamais lue). |
| Scales décimales figées vs proxy upgradeable | R5 (LOW) | ⏳ Open | Documenter l'hypothèse `decimals()` stable dans le README. |
| **Adapter Chainlink réel** | — | ✅ **Fait** | `src/oracles/ChainlinkOracleAdapter.sol` — decimals→WAD, staleness, prix négatif, 6 tests. |
| **Durcissement du bot** | review #1/#2 | ✅ **Fait** | `validateConfig()`, chain binding anti-replay, `simulateContract` + `waitForReceipt`, guard anti-overlap `makeTickRunner`. |

### 🟢 Déploiement
- **Local (Anvil)** : `script/DeployLocal.s.sol` — mocks TSLA (18 dec) + USDG (6 dec), seed liquidité, instructions dans les logs. ✅ Fait
- **Testnet réel** : `DeployDynamic.s.sol` prêt, pas encore broadcast (nécessite wallet fundé via faucet).

### 🔵 Roadmap (hors MVP, à pitcher)
- **Emprunt à taux fixe daté** (mode fixe via `IInterestModel` interchangeable — archi déjà prête)
- **VaR portefeuille multi-collatéral** (covariance) dans Stylus
- Actions dé-risquantes additionnelles (retrait keeper-initié vers safe, top-up collatéral)
- Cross-chain (LayerZero OFT)
- Vrais stockTokens en Phase 3 (composabilité)

---

## 4. Synthèse — stack technique restante (front exclu)

Du plus prioritaire au moins :

1. ✅ **Le moteur dynamique end-to-end (Bloc 2)** — fait.
2. ✅ **Adapter oracle réel** (Chainlink) + correction commentaire R1 — fait.
3. ✅ **Durcissement du bot** (validation, anti-replay, simulate, receipt, guard overlap) — fait.
4. ✅ **Petits garde-fous contractuels** (R2, R4, R6) — fait.
5. ✅ **Déploiement local Anvil** (`DeployLocal.s.sol`) — fait. Testnet réel : en attente faucet.
6. **Roadmap** (taux fixe, VaR…) — hors périmètre hackathon immédiat.

> Non concerné ici : **le front** (dashboard + démo visuelle), traité dans un plan séparé.
