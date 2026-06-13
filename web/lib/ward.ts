/** Modèle de données Ward (MVP mono-collatéral : TSLA → USDG). */

export const TSLA_SYMBOL = "TSLA";
export const LIQ_THRESHOLD = 0.8; // 80 % — seuil de liquidation de base

export type Credit = {
  id: string;
  collateral: number; // TSLA déposé
  debt: number; // USDG emprunté
  warded: boolean;
  buffer: number; // USDG en réserve Ward
  triggerHF: number;
  targetHF: number;
};

/** Valeur du collatéral en USDG. */
export const collateralValue = (c: Credit, price: number) => c.collateral * price;

/** Health factor d'un crédit au prix donné. */
export function healthFactor(c: Credit, price: number) {
  if (c.debt <= 0) return Infinity;
  return (c.collateral * price * LIQ_THRESHOLD) / c.debt;
}

/** Capacité d'emprunt maximale (USDG) pour un collatéral donné. */
export const maxBorrow = (collateral: number, price: number) =>
  collateral * price * LIQ_THRESHOLD;

/** Prix de liquidation : prix de TSLA auquel HF tombe à 1.0. */
export function liquidationPrice(c: Credit) {
  if (c.collateral <= 0) return 0;
  return c.debt / (c.collateral * LIQ_THRESHOLD);
}

/**
 * Prix plancher protégé par Ward : avec son buffer, jusqu'où le prix peut tomber
 * sans que la position passe sous la liquidation (Ward rembourse depuis le buffer).
 */
export function protectedPrice(c: Credit) {
  if (!c.warded || c.collateral <= 0) return liquidationPrice(c);
  const debtAfter = Math.max(c.debt - c.buffer, 0);
  if (debtAfter <= 0) return 0;
  return debtAfter / (c.collateral * LIQ_THRESHOLD);
}

export const INITIAL_PRICE = 250;

export const INITIAL_CREDITS: Credit[] = [
  {
    id: "c1",
    collateral: 10,
    debt: 1900,
    warded: true,
    buffer: 600,
    triggerHF: 1.2,
    targetHF: 1.5,
  },
  {
    id: "c2",
    collateral: 5,
    debt: 800,
    warded: false,
    buffer: 0,
    triggerHF: 1.2,
    targetHF: 1.5,
  },
];

/** Adresses live (testnet Robinhood Chain, chain 46630) — cf. DEPLOYMENTS.md. */
export const DEPLOYMENTS = {
  chainId: 46630,
  chainName: "Robinhood Chain (testnet)",
  explorer: "https://explorer.testnet.chain.robinhood.com",
  contracts: [
    { name: "LendingCore", addr: "0x55994C3D261dc2c0CE9348530090e81663020aa5" },
    { name: "WardVault", addr: "0x1e9F327fAaa14BB2Dc41B2A0080317547788bF1D" },
    { name: "DynamicRiskModel", addr: "0x4bAD15Dc970519486D13EF830A0544b2D236e3dF" },
    { name: "RiskEngine (Stylus)", addr: "0x65d5dc0C78b390b50aBd1f62F0F8F2e5AF18db13" },
    { name: "PriceHistory", addr: "0xBe61f02a744Bb55a2577e877BD4C0A7Fe160d1e2" },
    { name: "ChainlinkPriceOracle", addr: "0x7D38Fd1982C78fA35dd179a1E86A008b2063df99" },
  ],
} as const;
