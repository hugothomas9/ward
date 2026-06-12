# Ward — Design Spec

- **Date :** 2026-06-12
- **Statut :** Design validé, prêt pour le plan d'implémentation
- **Contexte :** Arbitrum Open House London Buildathon — track Robinhood Chain
- **Équipe :** 2 devs (Solidity OK, background Rust/Solana)
- **Positionnement pitch :** voir `ward/pitch-framing.md` (différenciation honnête vs Aave — à garder pour la présentation)

---

## 1. Résumé

**Ward** est une ligne de crédit adossée aux actions tokenisées, sur Robinhood Chain. Tu déposes tes stockTokens (TSLA, AMZN…) en collatéral et tu empruntes des USDG contre eux — *« débloque du cash de tes actions sans les vendre »*.

Le **héros** est un **autopilote anti-liquidation (Ward)** qui surveille ta position 24/7 et, selon des règles que tu fixes, prend des actions **strictement dé-risquantes** pour t'éviter la liquidation — piloté par un **moteur de risque on-chain en Stylus** qui calcule un risque temps-réel conscient de la volatilité, là où les protocoles façon Aave utilisent des paramètres statiques.

**Pitch une ligne :** *« Emprunte contre tes actions sans le cauchemar de te faire liquider pendant que tu dors — un moteur de risque on-chain et un autopilote te gardent en sécurité. »*

---

## 2. Positionnement (honnête)

Le **socle de prêt est assumé comme du collateralized lending façon Aave** (dépôt collatéral, emprunt, health factor, liquidation sous 1). On ne réinvente pas ça. Les différences :

1. **Moteur de risque dynamique** (vs paramètres statiques d'Aave), rendu possible par Stylus.
2. **Autopilote anti-liquidation** (Aave n'a aucune protection : il te liquide ; Ward te désendette avant).
3. **Asset & contexte** : actions tokenisées sur la chaîne de Robinhood, narrative « du cash sans vendre tes actions ».

Détail complet du framing dans `ward/pitch-framing.md`.

---

## 3. Goals / Non-goals

### Goals
- Un protocole de prêt fonctionnel : dépôt collatéral stockToken → emprunt USDG → health factor → backstop de liquidation.
- Un moteur de risque en Stylus calculant vol réalisée + health factor dynamique + time-to-danger.
- L'autopilote Ward : actions dé-risquantes automatiques, strictement bornées par le contrat.
- Une démo « money shot » lisible en 30 s : position protégée par Ward vs position non protégée, lors d'un crash.

### Non-goals (MVP)
- Pas de taux fixe au MVP (→ roadmap, architecture déjà prête à l'accueillir).
- Pas de VaR portefeuille multi-collatéral au MVP (→ roadmap).
- Pas de conseil / pas de décision d'investissement de l'agent.
- Pas de marché secondaire, pas de cross-chain.

---

## 4. Principe « réel d'abord » (pas de mock)

On construit en **réel partout où c'est possible** ; un stand-in n'est introduit que si une vérification jour-1 bloque l'usage du composant réel.

| Composant | Réel visé | Stand-in seulement si… |
|---|---|---|
| Déploiement Stylus | Sur RH Chain testnet (chain 46630) | …`cargo stylus check` échoue → plan B : déploiement sur Arbitrum Sepolia |
| USDG | Stablecoin natif testnet (faucet Paxos) | — (réel dispo) |
| Collatéral stockToken | Vrais stockTokens testnet (TSLA…) | …s'ils sont non-transférables (Phase 1) → token de collatéral transférable minimal |
| Oracle prix / vol | Vrais feeds Chainlink testnet | …si pas de feed publié sur RH Chain → source de prix testnet la plus proche |
| Côté prêteur (liquidité USDG) | On amorce le pool avec de vrais USDG | — (c'est du bootstrap, pas un mock : la source de rendement = intérêt emprunteur, réelle) |
| Venue de liquidation | Chemin de liquidation réel | …pas de liquidateurs sur testnet → liquidation simplifiée (et le produit vise de toute façon à l'éviter) |

**Deux vérifications jour-1 décident de ces fallbacks :**
1. `cargo stylus check --endpoint=https://rpc.testnet.chain.robinhood.com` → Stylus activé ?
2. Transférabilité d'un stockToken (`cast send transfer…`) → utilisable en collatéral ?

---

## 5. L'invariant de sécurité (cœur du concept)

**Ward ne peut prendre que des actions DÉ-RISQUANTES, jamais offensives.**

- ✅ **Seule action keeper (MVP)** : `protect()` — rembourser la dette de l'utilisateur depuis son propre buffer, à concurrence de ce qui le ramène au-dessus du seuil de liquidation. Rien d'autre n'est exposé au keeper.
- ❌ Interdit **par construction** (le contrat n'expose pas ces fonctions au keeper) : ré-emprunter, re-lever, swap, réinvestir, ouvrir une position, déplacer des fonds ailleurs que vers le remboursement de la dette de l'utilisateur.
- 👤 **Retour de fonds à l'utilisateur** : fait par l'**utilisateur lui-même** via `defund()` (il récupère son buffer quand il veut). *[F10 — choix du côté sûr]* Un retrait keeper-initié « rendre des fonds à l'user une fois dé-risqué » **n'est volontairement PAS implémenté** au MVP : chaque fonction keeper-callable élargit la surface d'attaque et l'allowlist de sécurité (cf. §6 et `test/WardSecurityInvariant.t.sol`). → **roadmap** (cf. §10 « Plus d'actions dé-risquantes »), seulement si un cas d'usage le justifie, et alors avec son propre garde dé-risquant.

**Conséquence :** par construction, le keeper ne peut que rendre l'utilisateur plus safe (réduire sa dette), jamais plus risqué, et ne reçoit jamais aucun fonds. Pire cas = le buffer de l'utilisateur est consommé pour réduire sa dette, jamais pire. La surface keeper-callable se limite **exactement** à `protect()`, prouvé par l'allowlist exacte des sélecteurs.

---

## 6. Architecture

### Composants

| Composant | Langage | Rôle |
|---|---|---|
| **LendingCore** | Solidity | Socle de prêt : prêteurs déposent USDG, emprunteurs déposent collatéral stockToken + empruntent USDG. Suit dette, collatéral, health factor. Dette modélisée comme **principal + intérêt accru via une fonction d'intérêt interchangeable** (prépare le taux fixe en roadmap). |
| **RiskEngine** | **Stylus (Rust)** | Vol réalisée (fenêtre glissante) + health factor dynamique (seuil ajusté à la vol) + time-to-danger. Vues lues par LendingCore et par Ward. Fallback Solidity si Stylus indisponible. |
| **WardVault** | Solidity | Détient le buffer USDG de l'utilisateur + sa policy (seuils, actions dé-risquantes autorisées). Expose à Ward **uniquement** des fonctions dé-risquantes (`protect()`). Custody verrouillée. |
| **Ward runtime** | off-chain (TypeScript) | Surveille les positions via RiskEngine ; quand un seuil de la policy est franchi → appelle `WardVault.protect()`. Strictement borné : ne peut appeler que des fonctions dé-risquantes. |
| **Liquidation backstop** | Solidity | Chemin de liquidation façon Aave si Ward échoue / buffer épuisé. |
| **Front** | Next.js + viem/wagmi | Ouvrir une position, régler la policy Ward, dashboard health + actions de Ward. |
| Oracle | Chainlink | Prix du collatéral + source de la vol. |

### Flux d'une protection (séquence)

```
1. Le prix du collatéral baisse (oracle Chainlink)
2. RiskEngine (Stylus) recalcule : vol réalisée → health factor dynamique → time-to-danger
3. Ward runtime lit la position + la policy de l'utilisateur
4. Si health < seuil_policy → Ward appelle WardVault.protect()
5. WardVault valide : action ∈ {dé-risquantes autorisées} ? buffer suffisant ?
   → rembourse une partie de la dette depuis le buffer pour restaurer le health cible
   → (option policy) retire/rend des fonds à l'utilisateur pour le mettre safe
6. Si buffer épuisé / Ward inactif → le backstop de liquidation standard reste le filet
```

---

## 7. Le moteur de risque (RiskEngine, Stylus)

**Ce qu'il calcule :**
- **Vol réalisée** sur une fenêtre glissante d'observations de prix.
- **Health factor dynamique** : seuil de liquidation effectif ajusté à la vol récente (plus volatile → plus conservateur → alerte plus tôt).
- **Time-to-danger** : estimation, à la vol actuelle, du délai avant d'atteindre le seuil → donne à Ward son urgence d'agir.

**Pourquoi Stylus :** vol réalisée sur fenêtre (et, en roadmap, covariance multi-collatéral pour du VaR) = boucles + `sqrt` chères en Solidity, cheap en Rust/WASM. Math en **fixed-point** (`fixed`/`rust_decimal`) — Stylus interdit le floating-point.

**Input de vol :** vol réalisée depuis une fenêtre d'observations Chainlink. *La résistance à la manipulation (médiane/TWAP, multi-sources) est traitée dans le pitch (`pitch-framing.md`), pas un sujet du MVP.*

---

## 8. MVP — ce qui doit tourner pour la démo

1. **Collatéral** : vrai stockToken testnet (ou stand-in transférable si non-transférable — décision jour-1).
2. **LendingCore** : dépôt collatéral → emprunt USDG (taux variable), health factor, backstop de liquidation.
3. **RiskEngine (Stylus)** : vol réalisée + health factor dynamique + time-to-danger (fallback Solidity si besoin).
4. **WardVault** : buffer USDG + policy (seuils, actions dé-risquantes).
5. **Ward runtime** : surveille, appelle `protect()` quand le seuil est franchi.
6. **Front minimal** : ouvrir position, régler la policy Ward, dashboard health + log des actions de Ward.

---

## 9. La démo (money shot, ~30 s)

**Deux positions identiques. Le prix du collatéral crashe en live.**
- Position A (sans Ward) → health < 1 → **liquidée**, pénalité, collatéral vendu au plus bas.
- Position B (avec Ward) → à health = seuil, Ward rembourse depuis le buffer → **survit**, pas de pénalité.

Côte à côte : visuel, vrais enjeux, lisible en 30 secondes.

---

## 10. Roadmap (à pitcher, hors MVP)

- **Emprunt à taux fixe (terme daté)** : mode taux fixe en complément du variable ; l'utilisateur verrouille un taux pour une durée, calculé depuis la courbe de taux du moteur Stylus. Les deux modes coexistent (comme Aave variable/stable). L'archi MVP est prête : dette = principal + intérêt accru via une **fonction d'intérêt interchangeable**, donc le mode fixe se branche sans toucher au collatéral, au moteur de risque ni à l'autopilote.
- **VaR portefeuille multi-collatéral** (covariance) dans Stylus.
- **Plus d'actions dé-risquantes** (retrait vers safe, top-up collatéral depuis une réserve).
- **Vrais stockTokens** comme collatéral une fois la Phase 3 (composabilité) live.

---

## 11. Risques & validations jour-1

| Risque | Mitigation |
|---|---|
| Stylus pas activé sur RH Chain | Test J1 ; fallback Arb Sepolia (le RiskEngine reste appelable cross-chain ou la démo tourne sur Sepolia) |
| Stylus floating-point interdit | Fixed-point (`fixed`/`rust_decimal`) dès le départ |
| stockTokens non-transférables (Phase 1) | Test J1 ; sinon token de collatéral transférable minimal |
| Pas de feed Chainlink sur RH Chain | Source de prix testnet la plus proche ; vérifier les adresses |
| Scope (2 devs) | MVP = socle prêt + RiskEngine + Ward + money shot ; taux fixe & VaR en roadmap |
| Focus splitté | Mener la démo avec l'autopilote (le plus solide) ; le RiskEngine en soutien |

---

## 12. Stack technique

- **Contrats :** Solidity (LendingCore, WardVault, backstop) + Stylus/Rust (RiskEngine, fixed-point)
- **Runtime Ward :** TypeScript (monitoring + appels `protect()` bornés)
- **Oracle :** Chainlink (prix + vol)
- **Stablecoin :** USDG natif
- **Front :** Next.js + viem + wagmi
- **Chaîne :** Robinhood Chain testnet (chain 46630), fallback Arbitrum Sepolia pour le composant Stylus
