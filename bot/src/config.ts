export const config = {
  rpcUrl: process.env.RH_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com",
  chainId: 46630,
  lendingCore: process.env.LENDING_CORE as `0x${string}`,
  wardVault: process.env.WARD_VAULT as `0x${string}`,
  priceHistory: process.env.PRICE_HISTORY as `0x${string}`,
  riskModel: process.env.RISK_MODEL as `0x${string}`,
  keeperKey: process.env.KEEPER_KEY as `0x${string}`,
  pollMs: Number(process.env.POLL_MS ?? 5000),
};
