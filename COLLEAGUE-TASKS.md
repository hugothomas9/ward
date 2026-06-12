# Ward — features pour le binôme (parallèle au Bloc 2)

> Salut 👋 Voici 3 features de la roadmap à attaquer **en parallèle** pendant que le moteur de
> risque dynamique (Bloc 2) est câblé de l'autre côté. Prends-les dans l'ordre ; si tu n'as le
> temps que pour une ou deux, pas grave — le reste reste en roadmap pour le pitch.

## Point de départ

Le **Bloc 2 (moteur de risque dynamique) est mergé sur `main` avant que tu commences** — donc
tu pars d'un core complet et tu peux **t'appuyer dessus** si utile (p.ex. taux fixe pricé par la
yield-curve Stylus, intégration des seuils dynamiques). Pas de contrainte d'isolation stricte.

Bon réflexe quand même : **pars sur des fichiers neufs** (nouveaux contrats + tests) et une branche
`feature/...`, pour des merges propres. Tu modifies le core seulement si ta feature l'exige
vraiment — et dans ce cas, `git pull` d'abord + préviens-moi.

## Conventions du projet (à respecter)

- **TDD** : test d'abord (RED) → implémentation (GREEN) → commit. Un commit par étape.
- **Foundry** : `forge test`. SPDX `MIT`, `pragma ^0.8.24`.
- **Fixed point** : tout ratio en `1e18` (WAD). Le health factor est en WAD (≥ 1e18 = sain).
- **Décimales** : ne JAMAIS encoder les décimales dans un prix. Le prix oracle est un **prix WAD
  USD** ; la conversion en unités-dette se fait via `decimals()` (cf. `LendingCore.collateralValue`
  pour le pattern). USDG = 6 décimales, TSLA = 18.
- **Interfaces réutilisables** : `src/interfaces/IPriceOracle.sol`, `IRiskModel.sol`,
  `IInterestModel.sol`. Réutilise-les, ne les duplique pas.
- **Sécurité** : `ReentrancyGuard` sur toute fonction qui mute + bouge des fonds.

---

## Feature 1 — Emprunt à taux fixe daté ★ (priorité 1, le plus fort en pitch)

**Le pitch :** « crédit adossé à tes actions, à **taux fixe** » — l'emprunteur verrouille son taux
pour une durée datée, au lieu du taux variable actuel. Comme Aave juxtapose taux variable et taux
stable. C'est le #1 de la roadmap et ça complète l'histoire fixed-income.

**Pourquoi c'est propre à paralléliser :** un **contrat séparé** `FixedRateMarket.sol`, qui
réutilise `IPriceOracle` + `IRiskModel` (en lecture, pour health/liquidation) mais stocke un **taux
verrouillé par position**. Zéro conflit avec le Bloc 2.

**Pourquoi on ne fait PAS juste un nouvel `IInterestModel` :** l'interface
`accrue(principal, elapsed)` est globale/sans état — elle ne porte pas le taux verrouillé par
position. Le taux fixe a besoin d'un état par emprunt (`taux`, `début`, `maturité`).

**Fichiers (tous neufs) :**
- `src/models/TermRateModel.sol` — la source de taux : `rateFor(uint256 tenorSeconds) → rateWad`.
  MVP = une courbe gouvernance-settable (mapping tenor → taux, owner-set). *(Plus tard : pricée par
  la yield-curve Stylus — pas un blocage pour toi.)*
- `src/FixedRateMarket.sol` — le marché. Position = `{collateral, principal, fixedRateWad, start, maturity}`.
- `test/TermRateModel.t.sol`, `test/FixedRateMarket.t.sol`.

**Étapes TDD suggérées :**
1. `TermRateModel` : owner pose un taux par tenor ; `rateFor` le renvoie ; revert si tenor non configuré.
2. `FixedRateMarket.deposit` / `borrow(amount, tenor)` : verrouille `fixedRateWad = termRate.rateFor(tenor)`,
   stocke `start = now`, `maturity = now + tenor`. Health check à l'ouverture (réutilise `IRiskModel`).
3. Dette accrue **au taux fixe** : `debt = principal * (1 + fixedRate * min(elapsed, tenor) / YEAR)`
   (linéaire pour le MVP, comme `LinearInterestModel`). Après maturité : l'intérêt **n'augmente plus**
   au taux fixe — soit pénalité de retard, soit rollover (choisis : MVP = la dette gèle au montant à
   maturité + petite pénalité fixe). Documente le choix.
4. `repay` / `liquidate` (réutilise le même pattern que `LendingCore`, health < 1e18 → liquidable).
5. Décimales : copie EXACTEMENT le pattern `collateralValue` de `LendingCore` (lecture `decimals()`,
   prix WAD).

**Démo / pitch :** « ouvre un emprunt TSLA à 5 % fixe sur 90 jours » — le taux ne bouge pas quoi
qu'il arrive au marché. À montrer à côté du taux variable.

**Intégration Ward (optionnel, plus tard) :** Ward pourra aussi protéger les positions à taux fixe ;
pour l'instant garde le marché **autonome**.

---

## Feature 2 — Plus d'actions anti-liquidation pour Ward (priorité 2)

**Le pitch :** aujourd'hui l'autopilote Ward **rembourse** la dette depuis un buffer USDG. On lui
ajoute un 2ᵉ levier dé-risquant : **auto-ajouter du collatéral** depuis une réserve que l'user a
pré-déposée. Certains préfèrent ne pas réduire leur position, juste remettre de la marge.

**⚠️ Contrainte de parallélisation :** ne **modifie pas** `src/WardVault.sol` (je le touche
potentiellement au Bloc 2 et il a un invariant de sécurité testé). → fais un **contrat séparé**
`src/WardCollateralVault.sol` sur le même modèle : une réserve de collatéral par user + une action
keeper `topUp(user)` qui **ajoute du collatéral** à la position pour remonter le health factor.

**Invariant de sécurité À RESPECTER absolument** (c'est l'ADN du projet) :
- Le keeper ne peut **QUE** dé-risquer : `topUp` ne fait qu'**ajouter du collatéral** depuis la
  réserve **de l'user** vers la position **de l'user**. Jamais retirer, jamais vers le keeper.
- Reproduis le test d'allowlist exacte des sélecteurs (cf. `test/WardSecurityInvariant.t.sol`) :
  la surface keeper-callable de ton contrat = exactement `{topUp}`.
- Post-condition façon F9 : `topUp` ne consomme la réserve que si ça remonte HF ≥ 1.0 (sinon revert).

**Fichiers (neufs) :** `src/WardCollateralVault.sol`, `test/WardCollateralVault.t.sol`.

**Étapes TDD :** `fund/defund` de la réserve collatéral → `setPolicy` (seuils) → `topUp(user)`
keeper-only, dé-risquant, avec post-condition → test d'allowlist + test « le keeper ne peut pas
retirer ».

---

## Feature 3 — Protocole d'assurance / cover (priorité 3, la plus libre)

**Le pitch :** une pool qui couvre les **risques spécifiques aux actions tokenisées** qu'aucun
prêteur classique ne couvre : gel KYC du collatéral, défaillance de l'oracle, liquidation due à un
trou d'oracle. Les acheteurs paient une prime, les vendeurs de couverture touchent les primes et
paient les sinistres prouvés.

**Scope MVP (garde-le serré, sinon ça déborde) :** **un seul type de couverture** au choix, p.ex.
« remboursement si liquidation alors que l'oracle était périmé (stale) ». Tout le reste = roadmap.

**Fichiers (tous neufs, zéro conflit) :** `src/CoverPool.sol`, `test/CoverPool.t.sol`.

**Squelette :**
- Vendeurs de cover déposent USDG (capital de couverture), touchent les primes.
- Acheteurs paient une prime (% du notionnel couvert) pour une durée.
- Sinistre : pour le MVP, **gouvernance-attestée** (un owner/oracle valide l'événement) → payout
  borné au capital. *(Plus tard : preuve on-chain via les events de LendingCore.)*
- Respecte les conventions (WAD, ReentrancyGuard).

---

## Ordre recommandé

1. **Taux fixe** (le plus fort en pitch + archi prête) — fais celui-là en premier.
2. **Actions Ward** (renforce le héros).
3. **Assurance** (si le temps — sinon roadmap).

**Avant de commencer :** `forge test` doit être vert (59 tests). Crée une branche
(`git checkout -b feature/fixed-rate`) pour ne pas entrer en conflit avec mes pushs sur `main`, et
on mergera proprement. Ping-moi si tu dois toucher un fichier de la liste « ne pas modifier ».
