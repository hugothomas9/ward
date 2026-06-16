# Ward — Dossier technique complet

> Ligne de crédit adossée aux actions tokenisées, avec un **autopilote anti-liquidation**
> et un **moteur de risque dynamique en Stylus (Rust)**, déployée sur **Robinhood Chain** (testnet).
> Front : **ward-rho.vercel.app**

---

## 0. En une phrase
Tu déposes une action tokenisée (TSLA) en collatéral, tu empruntes du stablecoin (USDG), et un **agent (keeper)** surveille ta position en continu : dès qu'elle approche de la liquidation, il **rembourse une partie de ta dette depuis ton buffer** pour te garder en vie — avant que la liquidation ne tombe. Le seuil de liquidation lui-même est **calculé on-chain par un moteur de risque écrit en Rust/Stylus**, qui s'adapte à la volatilité.

---

## 1. Le principe (problème → solution)

**Le problème.** Emprunter contre un actif volatil est dangereux. Une chute de 16 % d'une action comme Tesla peut faire passer un prêt sain sous sa ligne de liquidation en quelques minutes. Tu perds ton collatéral, vendu de force au pire moment. Les protocoles de prêt classiques se contentent de te liquider.

**La solution — Ward.** Un crédit adossé aux actions tokenisées + un autopilote qui **te sort des krachs automatiquement** :
1. Tu **déposes** du TSLA en collatéral.
2. Tu **empruntes** de l'USDG.
3. Tu mets de côté un petit **buffer** USDG et tu choisis deux seuils : un **trigger** et un **target**.
4. Un **keeper** lit ton *health factor* à chaque bloc. Dès qu'il passe sous le trigger, il rembourse depuis ton buffer juste assez pour te ramener au-dessus du target — **avant** la liquidation. Ton collatéral reste intact : tu traverses le creux et tu profites du rebond.

**Point clé économique.** Le remboursement par Ward n'est **pas une perte** : c'est ton propre cash (buffer) qui paie ta propre dette (valeur nette inchangée). Ce que Ward t'évite, c'est la **liquidation** — là où on perd vraiment (collatéral saisi + décote). La baisse du sous-jacent, elle, reste subie (c'est le marché) ; Ward te permet juste de la traverser sans être vendu de force.

---

## 2. Notre analyse / le raisonnement

- **Pourquoi maintenant.** Les actions tokenisées arrivent on-chain (Robinhood Chain en est l'incarnation). Dès qu'on tokenise des actifs volatils, le besoin de crédit adossé apparaît — et avec lui le risque de liquidation. Personne ne résout proprement « emprunter sans se faire liquider par une mèche ».
- **Pourquoi Robinhood Chain.** C'est là que vivent les actions tokenisées **et** une audience grand public. Le crédit adossé aux actions doit être au plus près des actions elles-mêmes : même chaîne, mêmes actifs (on utilise le **vrai token TSLA** comme collatéral), mêmes utilisateurs.
- **Notre différenciateur (vs un simple money market).** Deux choses : (a) un **moteur de risque conscient de la volatilité** (pas un seuil fixe), et (b) un **agent autonome de dé-risquage** dont le pouvoir est volontairement minuscule (invariant de sécurité). C'est ce couple « moteur Stylus + agent » qui rend Ward unique et défendable.

---

## 3. Architecture d'ensemble (4 couches)

```
┌──────────────────────────────────────────────────────────────┐
│  FRONT (Next.js sur Vercel) — ward-rho.vercel.app             │
│  wagmi/viem · MetaMask/WalletConnect · lectures+écritures      │
└───────────────┬──────────────────────────┬───────────────────┘
                │ reads/writes (wallet)     │ POST (clé serveur)
                ▼                          ▼
┌──────────────────────────┐   ┌───────────────────────────────┐
│  ROUTES SERVEUR (Next API)│   │  CONTRATS (Robinhood Chain)   │
│  /api/crash  (operator)   │──▶│  LendingCore · WardVault       │
│  /api/ward-tick (keeper)  │   │  DynamicRiskModel · Oracle     │
│  /api/sync-price (oracle) │   │  PriceHistory · MockV3Agg      │
└──────────────────────────┘   │            │                  │
                               │            ▼ (appel on-chain)  │
                               │  RISKENGINE (Stylus / Rust WASM)│
                               └───────────────────────────────┘
```

- **Couche on-chain** : tous les contrats (Solidity) + le moteur (Rust/Stylus) sur Robinhood Chain testnet.
- **Couche serveur** : 3 fonctions serverless Next.js qui signent avec la **clé deployer** (jamais exposée au navigateur) : le crash de démo, le keeper, et le rafraîchissement du feed.
- **Couche front** : Next.js + wagmi/viem ; lit l'état on-chain et envoie les transactions signées par le wallet de l'utilisateur.

---

## 4. Les contrats Solidity

### LendingCore (`0x193C…7783b`)
Le cœur de prêt (style Aave simplifié). `Ownable`, `ReentrancyGuard`.
- **Prêteur** : `provide(amount)` (dépose de l'USDG empruntable, suivi par `availableLiquidity`).
- **Emprunteur** : `deposit` (collatéral), `borrow`, `repay`, `withdraw`.
- **Lecture** : `positionOf(user) → (collateral, debt)`, `healthFactor(user)` (en WAD), `collateralValue`.
- **Liquidation** : `liquidate(user)` (backstop : saisie complète si HF < 1).
- **Primitive de dé-risquage** : `repayFor(user, amount)` — n'importe qui peut rembourser la dette d'autrui ; **ne fait que réduire la dette** (c'est ce que Ward appelle).
- **Intérêt interchangeable** : `interestModel` derrière une interface (permet d'ajouter du taux fixe sans toucher au cœur).
- **Durcissements** : `setRiskModel` `onlyOwner` (permet de passer du modèle statique au dynamique — F11) ; `renounceOwnership()` **désactivé** (revert, C4) ; accrual résistant au *grind* (F8 : l'horloge d'intérêt n'avance que si l'intérêt est réellement prélevé).

### WardVault (`0x72Fa…05558`)
Le coffre + la policy + la protection. **Invariant de sécurité** : *la seule fonction mutante appelable par le keeper est `protect()`*.
- `fund(amount)` / `defund(amount)` — l'utilisateur alimente/retire **son** buffer USDG quand il veut.
- `setPolicy(triggerHF, targetHF, keeper)` — garde-fous : `triggerHF > 0` (R2, évite une « policy zombie ») et `targetHF >= triggerHF`.
- `protect(user)` — **keeper-only, dé-risquant uniquement** : rembourse depuis le buffer de l'utilisateur juste assez pour restaurer le target. Conditions : `msg.sender == policy.keeper`, `HF < trigger`, buffer non vide. **Post-condition F9** : si le buffer ne peut pas ramener la position au-dessus de la liquidation (1.0), l'appel **revert** et le buffer reste intact (on ne brûle pas le buffer juste avant une liquidation inévitable).
- `bufferOf` / `policyOf`.
- Le keeper **ne peut jamais** ré-emprunter, swapper, déplacer des fonds ni ouvrir de position.

### Modèles de risque
- **StaticRiskModel** : seuil fixe (utilisé au bootstrap puis remplacé).
- **DynamicRiskModel (`0x4bAD…e3dF`)** : c'est le modèle actif.
  - `refresh()` : lit `PriceHistory`, calcule la volatilité réalisée via le **moteur Stylus**, en déduit le seuil de liquidation dynamique.
  - Si l'historique est périmé (> 1 h), il **relâche** vers le seuil de base (anti-blocage).
  - **Resserrement borné** (C1/F3 — anti-procyclicité) : le seuil ne peut se resserrer que de `maxTightenBpsPerSec × min(temps écoulé, plafond)`. Impossible de faire chuter le seuil d'un coup pour liquider tout le monde.
  - `liquidationThresholdBps(asset)`, `healthFactor(colValue, debt, bps)` (pure).

### InterestModel — LinearInterestModel
Intérêt linéaire (5 % APR au déploiement). Derrière `IInterestModel` → remplaçable (ex. taux fixe daté).

### Oracle de prix
- **ChainlinkPriceOracle (`0x7D38…df99`)** : enveloppe un `AggregatorV3Interface`, convertit les décimales du feed → **WAD** on-chain, **revert si données périmées** (> 1 h) ou prix ≤ 0. Sortie propre en 1e18.
- **MockV3Aggregator (`0xFf71…A4e7`)** : le feed sur testnet. `updateAnswer` est **owner-gated** (seul le deployer peut le bouger — C2/F2 : empêche la fabrication de volatilité par un tiers). En prod on brancherait un vrai feed Chainlink, même code.
- **Un seul feed** sert à la fois la **valorisation** et la **volatilité** (C2) : la valeur du collatéral et la vol ne peuvent jamais diverger.

### PriceHistory (`0xBe61…d1e2`)
Buffer circulaire (fenêtre = 16 observations). `poke()` lit le feed et l'ajoute (avec garde de **staleness** + **minInterval** entre deux pokes). C'est le **seul écrivain** → non-manipulabilité (F2). Expose `window()`, `latestWad()`, `lastUpdate`, `length()`.

---

## 5. Le moteur de risque en Stylus (Rust)

**RiskEngine (`0x65d5…db13`)** — un **smart contract WASM** déployé avec **Arbitrum Stylus** (`cargo stylus deploy`). Pur / sans état :
- `realized_vol(Vec<U256>) → U256` : volatilité réalisée à partir de la fenêtre de prix (en WAD, fixed-point — **aucun flottant**, interdit en Stylus).
- `dynamic_threshold_bps(base_bps, vol_wad) → U256` : `base × (WAD − min(vol, WAD)/2) / WAD`. Plus la vol monte, plus le seuil baisse (on exige plus de collatéral).

**Pourquoi Stylus ?** Ce calcul (vol réalisée + seuil, tout en fixed-point) est lourd. En Rust/WASM via Stylus, il tourne **un ordre de grandeur moins cher** qu'en Solidity — assez peu cher pour s'appliquer **à chaque position, on-chain, de façon vérifiable**. Le binaire fait ~9 Ko. Il est appelé par le `DynamicRiskModel` à chaque `refresh()`.

**Preuve qu'il tourne réellement** : on a observé le seuil descendre de 8000 bps (80 %) à ~7466 bps pendant des séquences de volatilité — c'est le Rust qui calcule on-chain.

---

## 6. Le keeper / l'agent

**Rôle** : surveiller le health factor et appeler `protect()` quand il passe sous le trigger.

Deux incarnations :
- **Le bot standalone** (`bot/`, TypeScript + viem) — durci : `validateConfig` fail-fast, *chain binding*, `simulateContract` avant envoi, `waitForTransactionReceipt`, garde anti-overlap, wallet keeper paresseux. C'est la forme « produit » (tourne 24/7 sur un serveur).
- **Le keeper serveur** (`/api/ward-tick`) — pour la démo/le déploiement web : le front *poll* cette route toutes les 4 s ; la route lit `policyOf` + `healthFactor`, et si `HF < trigger` elle `simulate` puis appelle `protect(user)` avec la **clé deployer** (= le keeper de la policy). Protège tant que la page est ouverte.

**Invariant de sécurité (le cœur du pitch « an agent you don't have to trust »)** : le keeper n'a accès qu'à `protect()`, qui ne fait que rembourser ta dette depuis **ton** buffer. Jamais ré-emprunter, swapper, déplacer des fonds, ouvrir une position. C'est **garanti par le contrat** et **couvert par des tests** (`WardSecurityInvariant.t.sol` : allowlist de sélecteurs, pas de fallback, protect ne touche jamais au collatéral, ne paie jamais le keeper).

---

## 7. Le front (Next.js)

**Stack** : Next.js 16 (App Router), TypeScript, Tailwind v4 (config CSS-first), shadcn/ui, **wagmi v3 + viem**, WalletConnect, Motion (animations), sonner (toasts). Design **« Sentinel clair »** : crème chaud, vert forêt, serif Fraunces + Hanken Grotesk + IBM Plex Mono.

**Pages** :
- **Home** : landing (déconnecté) avec stats **live on-chain** (prix TSLA, seuil Stylus, liquidité du pool) ; dashboard (connecté) avec solde net, position, HF.
- **Trading** : gestionnaire de position 4 actions (Deposit / Borrow / Repay / Withdraw) avec aperçu HF + prix de liquidation en direct.
- **Ward** : la position réelle + **armer Ward** (fund buffer + setPolicy) + **contrôle de prix opérateur** (crash/reset) + statut keeper + **liens explorer « On-chain proof »** après crash/protect.
- **Profile** : wallet, réseau, **faucet** (mint USDG), liste des contrats déployés (liens explorer).

**Couche de données** (`WardProvider`) : connexion via `useAccount`, et lecture on-chain en direct (soldes ETH/TSLA/USDG, position, HF, buffer/policy, prix du feed, seuil) via `useReadContract`. Écritures via un helper `sendTx` (write → wait receipt → toast).

---

## 8. Les routes serveur (Next API)

Toutes signent avec `DEPLOYER_KEY` (variable serveur, jamais `NEXT_PUBLIC`). `nonceManager` partagé pour éviter les collisions de nonce, `maxDuration = 60 s`.
- **`/api/crash`** (contrôle de prix opérateur) : `GET` renvoie le **vrai cours TSLA** (Yahoo Finance) ; `POST {crash|reset}` met le feed à *réel × 0.84* (crash −16 %) ou au réel, puis `poke` + `refresh`. C'est ce qui rend le « money shot » **réellement on-chain**.
- **`/api/ward-tick`** (keeper) : lit policy + HF, et `protect(user)` si `HF < trigger` (avec `simulate` d'abord).
- **`/api/sync-price`** : garde le feed frais. Si l'observation a > 50 min, pousse le cours réel (`updateAnswer + poke + refresh`). Pingé au chargement de l'app → évite le revert **« stale feed »** (l'oracle a une fenêtre de fraîcheur d'1 h).

---

## 9. Le déploiement — sur quoi, et comment

**La chaîne** : **Robinhood Chain testnet** — un **L2 Arbitrum Orbit**.
- chainId **46630** · RPC `https://rpc.testnet.chain.robinhood.com` · explorer `https://explorer.testnet.chain.robinhood.com` · gas en **ETH**.

**Comment on a déployé** :
- **Stylus** : `cargo stylus deploy` (le moteur Rust → WASM on-chain).
- **Contrats Solidity** : Foundry (`forge script … --broadcast`), wallet deployer fundé via le faucet officiel (browser-gated).

**Deux déploiements** :
1. **DeployDynamic** (initial) : pile complète avec le **vrai TSLA** (token Robinhood) et le **vrai USDG Paxos**. Problème découvert : sur le testnet, l'**USDG réel est verrouillé** (mint restreint, aucun faucet) et le pool n'a jamais pu être seedé → **emprunt impossible**.
2. **DeployDemo** (opérationnel, celui que le front utilise) : on garde le **vrai TSLA** comme collatéral et le **vrai prix**, mais on déploie un **USDG de testnet mintable** (même nom/symbole/6 déc). On réutilise l'oracle, le DynamicRiskModel (Stylus) et l'interestModel d'origine. **Pool seedé à 200 000 USDG** + feed calé sur le cours réel. → tout devient opérationnel end-to-end.

**Le front** : déployé sur **Vercel** (`ward-rho.vercel.app`), build depuis `main` (auto-redeploy à chaque push). Variables d'env : `DEPLOYER_KEY` (serveur), `NEXT_PUBLIC_WC_PROJECT_ID` (WalletConnect).

### Adresses (marché opérationnel courant)
| Contrat | Adresse |
|---|---|
| LendingCore | `0x193C18301695d38Faf9393887c3a6a2A69A7783b` |
| WardVault | `0x72FabE6972BfF5F21D208701bC59e94A29F05558` |
| USDG (mintable) | `0x7d6ac1CBC33d15B5A6d7371d59d501c1CF6acd64` |
| DynamicRiskModel | `0x4bAD15Dc970519486D13EF830A0544b2D236e3dF` |
| RiskEngine (Stylus) | `0x65d5dc0C78b390b50aBd1f62F0F8F2e5AF18db13` |
| ChainlinkPriceOracle | `0x7D38Fd1982C78fA35dd179a1E86A008b2063df99` |
| MockV3Aggregator (feed) | `0xFf71D6a695363e96efDF62fD96e30c8889aDA4e7` |
| PriceHistory | `0xBe61f02a744Bb55a2577e877BD4C0A7Fe160d1e2` |
| TSLA (collatéral réel) | `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` |
| Deployer / keeper | `0xDA547bb1e6a9ED39c375703A75e13a82FCefc85E` |

---

## 10. Conventions techniques
- **Décimales** : TSLA = 18 · USDG = 6 · feed = 8 · health factor & seuils policy = **WAD (1e18)** · seuil de risque = **bps /10000**.
- **Health factor** : `HF = collateralValue × seuilBps / (debt × 10000)`, en WAD (1e18 = 1.0). Dette nulle ⇒ HF = ∞.
- **Normalisation** : `collateralValue = collateral × prix × _debtScale / (1e18 × _collateralScale)` — gère proprement TSLA(18) vs USDG(6).

---

## 11. Sécurité & durcissement
Le projet est passé par une **revue multi-agent** ; corrections clés :
- **Invariant Ward** : keeper ⇒ `protect()` seulement (testé).
- **C1/F3** : resserrement du seuil **borné en temps absolu** (anti-procyclique) — on a corrigé un « trompe-l'œil » où un refresh espacé pouvait écrouler le seuil.
- **C2/F2** : feed **owner-gated** + garde de staleness + **un seul feed** valorisation/vol (la vol n'est plus fabricable).
- **C4** : `renounceOwnership` désactivé (le owner ne peut pas se figer accidentellement).
- **R2** : `triggerHF > 0` obligatoire (pas de policy zombie).
- **F8** : accrual d'intérêt résistant au grind.
- **F9** : `protect` ne dépense pas le buffer s'il ne peut pas repasser au-dessus de la liquidation.
- **Côté serveur** : clé jamais exposée au client, `nonceManager`, `sync-price` anti « stale feed ».

---

## 12. Tests
- **92 tests Solidity** (Foundry) verts : LendingCore, WardVault, DynamicRiskModel, invariant de sécurité Ward, oracle, FixedRateMarket (brique roadmap).
- Moteur Stylus : tests natifs Rust (`cargo test --features stylus-test`).
- Bot : tests vitest (config + anti-overlap).

---

## 13. Les compromis honnêtes (réel vs démo)
À assumer face au jury — la techno est réelle, certains éléments sont des substituts de testnet :
- **USDG = token testnet mintable** (le vrai USDG Paxos est verrouillé sur testnet). C'est le **seul** « mock » inévitable ; le collatéral (TSLA) et le prix sont réels.
- **Keeper page-ouverte** : la protection se déclenche via le poll du front. Un keeper **24/7 autonome** (le bot) est la version prod / roadmap.
- **Le « crash »** est une **action opérateur** sur un feed qu'on contrôle (on ne peut pas crasher le vrai marché) — c'est un dispositif de démo, mais les transactions sont réelles et vérifiables.
- **Côté prêteur incomplet** : `provide()` existe mais pas de retrait/yield prêteur (parts + intérêts) — roadmap.
- **Position unique par utilisateur** (modèle LendingCore) ; les positions A/B du money shot d'origine étaient illustratives.

---

## 14. Le flow de bout en bout
1. **Connecter** MetaMask (ou Robinhood Wallet via WalletConnect) sur Robinhood Chain (46630).
2. **Faucet** : gas ETH + 5 TSLA (faucet officiel) ; USDG via le bouton mint.
3. **Deposit** TSLA → **Borrow** USDG (puise dans le pool seedé).
4. **Arm Ward** : `fund` buffer + `setPolicy(trigger, target, keeper)`.
5. **Crash** −16 % (opérateur) → le feed bouge on-chain, le moteur Stylus refresh → HF plonge sous le trigger.
6. **Le keeper** appelle `protect()` → rembourse depuis le buffer → HF restauré au target. **Pas de liquidation.**
7. **Preuve** : liens explorer (la tx `protect()`, le crash) — tout est on-chain.

---

## 15. Roadmap
- **Taux fixe daté** (FixedRateMarket — déjà prototypé + testé).
- **Keeper 24/7 autonome** (bot serveur, indépendant du front).
- **Risque multi-collatéral** (VaR au niveau portefeuille).
- **Côté prêteur** : parts + intérêts pour les fournisseurs de liquidité.
- **Mainnet** : vrai USDG, Robinhood Wallet, Robinhood Chain prod.

---

## 16. Liens
- **App** : https://ward-rho.vercel.app · **Deck** : /deck.html
- **Repo** : github.com/hugothomas9/ward (branche `main`)
- **Explorer** : https://explorer.testnet.chain.robinhood.com
