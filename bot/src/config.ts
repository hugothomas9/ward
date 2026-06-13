export interface Config {
  rpcUrl: string;
  chainId: number;
  lendingCore:  `0x${string}`;
  wardVault:    `0x${string}`;
  priceHistory: `0x${string}`;
  riskModel:    `0x${string}`;
  keeperKey:    `0x${string}`;
  pollMs:       number;
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const KEY_RE  = /^0x[0-9a-fA-F]{64}$/;

export function validateConfig(c: Config): void {
  const addr = (name: keyof Config) => {
    const v = c[name] as string | undefined;
    if (!v || !ADDR_RE.test(v)) throw new Error(`${name}: invalid or missing address (got ${v ?? "undefined"})`);
  };
  addr("lendingCore");
  addr("wardVault");
  addr("priceHistory");
  addr("riskModel");
  const key = c.keeperKey as string | undefined;
  if (!key || !KEY_RE.test(key)) throw new Error(`keeperKey: invalid or missing private key`);
}

export const config: Config = {
  rpcUrl:       process.env.RH_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com",
  chainId:      46630,
  lendingCore:  process.env.LENDING_CORE  as `0x${string}`,
  wardVault:    process.env.WARD_VAULT    as `0x${string}`,
  priceHistory: process.env.PRICE_HISTORY as `0x${string}`,
  riskModel:    process.env.RISK_MODEL    as `0x${string}`,
  keeperKey:    process.env.KEEPER_KEY    as `0x${string}`,
  pollMs:       Number(process.env.POLL_MS ?? 5000),
};
