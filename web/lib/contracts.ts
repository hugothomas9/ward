/** Adresses live du déploiement (Robinhood Chain testnet, chain 46630). Cf. DEPLOYMENTS.md. */

const a = (x: string) => x as `0x${string}`;

export const ADDR = {
  // marché démo opérationnel (DeployDemo) : collatéral réel TSLA + USDG mintable
  lendingCore: a("0x193C18301695d38Faf9393887c3a6a2A69A7783b"),
  wardVault: a("0x72FabE6972BfF5F21D208701bC59e94A29F05558"),
  usdg: a("0x7d6ac1CBC33d15B5A6d7371d59d501c1CF6acd64"),
  // réutilisés du déploiement initial
  priceHistory: a("0xBe61f02a744Bb55a2577e877BD4C0A7Fe160d1e2"),
  riskModel: a("0x4bAD15Dc970519486D13EF830A0544b2D236e3dF"),
  riskEngine: a("0x65d5dc0C78b390b50aBd1f62F0F8F2e5AF18db13"),
  oracle: a("0x7D38Fd1982C78fA35dd179a1E86A008b2063df99"),
  feed: a("0xFf71D6a695363e96efDF62fD96e30c8889aDA4e7"),
  tsla: a("0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E"),
  deployer: a("0xDA547bb1e6a9ED39c375703A75e13a82FCefc85E"),
} as const;

export const TSLA_DECIMALS = 18;
export const USDG_DECIMALS = 6;
export const WAD = 10n ** 18n;

/** Faucets officiels (tokens non mintables — passage navigateur obligatoire). */
export const FAUCETS = {
  gas: "https://faucet.testnet.chain.robinhood.com/",
  // USDG = Global Dollar (Paxos) testnet ; TSLA = action tokenisée testnet
};
