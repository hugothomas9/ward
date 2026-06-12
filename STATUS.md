# Ward — Rapport d'avancement

> Référentiel de suivi du projet. Mis à jour à la fin de chaque bloc de travail.
> Dernière mise à jour : **2026-06-12** (après Bloc 1 + re-review).
> Source de vérité granulaire : le `git log`. Ce fichier en est la synthèse lisible.

**État global :** MVP on-chain solide et testé (**59 tests verts**) ; le moteur de risque dynamique (le différenciateur) est **validé mais pas encore câblé** → c'est le Bloc 2.

- Tests : **46 Foundry** + **7 vitest (bot)** + **6 cargo (Stylus)** = **59 verts, 0 échec**
- Déploiement réel : **pas encore broadcast** (nécessite un wallet fundé)

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

| Item | Source | Détail |
|---|---|---|
| Commentaire `IPriceOracle` périmé | R1 (MED) | Dit « USDG per 1 collateral, scaled 1e18 » → c'est un prix WAD désormais. **À corriger avec le câblage Bloc 2** (sinon l'adapter oracle ré-introduit le footgun ×1e12). |
| `setPolicy` accepte `(0,0)` zombie | R2 (LOW) | `require(triggerHF > 0)` pour éviter une policy qui ne protège jamais. |
| `Deploy.s.sol` sans borne haute de prix | R4 (LOW) | Ajouter `require(initialPrice <= 1e30)`. |
| `LIQUIDATION_BONUS_BPS` mort | R6 (INFO) | Le câbler (liquidation partielle + bonus) ou le supprimer. |
| Scales décimales figées vs proxy upgradeable | R5 (LOW) | TSLA est un proxy ; documenter l'hypothèse `decimals()` stable. |
| **Adapter Chainlink réel** | — | `SettablePriceOracle` est la source démo ; un `ChainlinkOracleAdapter` (IPriceOracle) lisant un vrai feed reste à écrire. |
| **Durcissement du bot** | review #1/#2 | Validation des env vars (`config.ts`), binding de `chain` (anti-replay, `chain: null` aujourd'hui), `simulateContract` avant envoi, `waitForTransactionReceipt`, guard anti-chevauchement du `setInterval`. |

### 🟢 Déploiement réel
- **Broadcast `Deploy.s.sol` sur le testnet** (nécessite un wallet fundé via faucet) + seed de liquidité USDG + ouverture d'une position de démo. Jamais fait.

### 🔵 Roadmap (hors MVP, à pitcher)
- **Emprunt à taux fixe daté** (mode fixe via `IInterestModel` interchangeable — archi déjà prête)
- **VaR portefeuille multi-collatéral** (covariance) dans Stylus
- Actions dé-risquantes additionnelles (retrait keeper-initié vers safe, top-up collatéral)
- Cross-chain (LayerZero OFT)
- Vrais stockTokens en Phase 3 (composabilité)

---

## 4. Synthèse — stack technique restante (front exclu)

Du plus prioritaire au moins :

1. **Le moteur dynamique end-to-end (Bloc 2)** — historique de prix on-chain non-manipulable, anti-procyclicité, `setRiskModel`, `init` sécurisé, et le câblage complet + money shot sous moteur actif. *C'est le différenciateur ; tout le reste est secondaire.*
2. **Adapter oracle réel** (Chainlink) + correction du commentaire `IPriceOracle` (R1).
3. **Durcissement du bot** (validation, anti-replay, simulate, receipt).
4. **Petits garde-fous contractuels** (R2, R4, R6).
5. **Déploiement réel** (broadcast + seed).
6. **Roadmap** (taux fixe, VaR…) — hors périmètre hackathon immédiat.

> Non concerné ici : **le front** (dashboard + démo visuelle), traité dans un plan séparé.
