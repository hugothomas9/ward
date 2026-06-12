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

/// Fail fast with a clear message if a required env var is missing or malformed, instead of a
/// late runtime crash (which would silently stop protecting users).
export function assertConfig(): void {
  const required: Record<string, string | undefined> = {
    LENDING_CORE: process.env.LENDING_CORE,
    WARD_VAULT: process.env.WARD_VAULT,
    PRICE_HISTORY: process.env.PRICE_HISTORY,
    RISK_MODEL: process.env.RISK_MODEL,
    KEEPER_KEY: process.env.KEEPER_KEY,
  };
  const bad = Object.entries(required)
    .filter(([, v]) => !v || !/^0x[0-9a-fA-F]+$/.test(v))
    .map(([k]) => k);
  if (bad.length > 0) {
    throw new Error(`ward: missing or malformed env vars: ${bad.join(", ")}`);
  }
}
