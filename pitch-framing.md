# Ward — framing pour la présentation (à garder de côté)

> Notes de positionnement honnête à ressortir dans le pitch. Mises de côté pendant le build.

## La formule honnête (assumer le socle, projecteur sur les ajouts)

> « Le squelette de prêt est éprouvé façon Aave ; ce qu'on ajoute, c'est un moteur de risque on-chain conscient de la volatilité (possible grâce à Stylus) et un autopilote qui te désendette avant la liquidation au lieu de te liquider — sur les actions tokenisées de Robinhood. »

On **assume** que la base est de l'Aave (collateralized lending standard : dépôt collatéral, emprunt, health factor, liquidation sous 1). On ne prétend pas réinventer ça. Les différences sont ailleurs.

## Ce qu'on reprend d'Aave (le socle, assumé)
Tu déposes un collatéral, tu empruntes contre, le protocole suit un health factor (valeur collatéral × seuil ÷ dette), si < 1 tu es liquidable. Standard, éprouvé, non réinventé.

## Différence 1 — le moteur de risque (le cœur technique)
- **Aave** : paramètres **statiques** (LTV + seuil de liquidation fixés par la gouvernance, identiques que le marché soit calme ou en tempête). Volontaire : recalculer du risque dynamique on-chain serait trop cher en gas et trop manipulable sur l'EVM Solidity.
- **Ward** : risque **temps-réel et conscient de la volatilité**, calculé on-chain parce que **Stylus** rend ce calcul assez cheap pour être permanent.
- ⚠️ **Le point attaquable** : la vraie difficulté défendable n'est PAS le gas, c'est **d'où vient l'input de volatilité et comment il résiste à la manipulation**. C'est ça la nouveauté, pas « j'ai refait Aave en Rust ». → Avoir la réponse anti-manipulation prête (médiane/TWAP sur fenêtre, multi-sources, etc.).

## Différence 2 — l'autopilote anti-liquidation (le héros, le plus solide)
- **Aave** : aucune protection. Health factor tombe → tu te fais liquider, un liquidateur externe vend ton collatéral et empoche la pénalité. Aave **veut** te liquider (ça sécurise le protocole).
- **Ward** : un bot qui, selon TES règles, **désendette progressivement et tôt depuis ton buffer** pour t'éviter d'atteindre le seuil → t'épargne la pénalité et la vente forcée au plus bas. *Aave te liquide ; Ward essaie de l'empêcher avant.*
- C'est la **force la plus immédiatement visible et la plus solide** — ne dépend d'aucune hypothèse fragile.

## Différence 3 — l'asset et le contexte
- **Aave** : collatéral crypto (ETH, stables…).
- **Ward** : **actions tokenisées sur la chaîne de Robinhood**, narrative « du cash sans vendre tes actions ». Même mécanique, marché et narrative complètement différents — précisément le cas d'usage que RH Chain dit vouloir héberger.

## Stratégie de démo
- **Mène avec l'autopilote** (Différence 2) : la plus visible, la plus solide, zéro hypothèse fragile.
- **Sers le moteur de risque** (Différence 1) ensuite, **avec sa réponse anti-manipulation déjà prête** (le nœud des deux différences).
