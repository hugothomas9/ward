import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { wardVaultAbi, priceHistoryAbi, dynamicRiskAbi } from "./abi.js";
import { shouldProtect } from "./monitor.js";

// Anti-replay: bind the chainId so viem includes it in every signed tx.
const rhChain = defineChain({
  id: config.chainId,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});

export interface Policy {
  triggerHF: bigint;
  set: boolean;
}

export interface WardDeps {
  users: `0x${string}`[];
  readHealthFactor: (u: `0x${string}`) => Promise<bigint>;
  readPolicy: (u: `0x${string}`) => Promise<Policy>;
  protect: (u: `0x${string}`) => Promise<void>;
}

/// The bot's ENTIRE action space: for each tracked user, call protect() iff triggered.
/// There is no other action the bot can take. This mirrors the on-chain invariant.
/// F12: a tracked user with no policy is NEVER a silent no-op — we warn loudly so an
/// unprotected position can't slip through unnoticed (the worst failure for a "sleep
/// safe" product).
export async function runOnce(deps: WardDeps): Promise<void> {
  for (const user of deps.users) {
    try {
      const policy = await deps.readPolicy(user);
      if (!policy.set) {
        console.warn(`ward: tracked user ${user} has NO Ward policy — it is NOT protected`);
        continue;
      }
      const hf = await deps.readHealthFactor(user);
      if (shouldProtect(hf, policy.triggerHF)) {
        await deps.protect(user);
      }
    } catch (e) {
      console.error(`ward: user ${user} check failed`, e);
    }
  }
}

export interface MaintenanceDeps {
  poke: () => Promise<void>;
  refresh: () => Promise<void>;
}

/// Keeps the on-chain risk signal fresh: append the latest feed price, then recompute the
/// vol-aware threshold. poke() reverting "too soon" (the sampling rate limit) is expected and
/// must not block the refresh. Neither action is custodial — they only move state toward honest
/// values, so this stays within the keeper's bounded, de-risking-only role.
export async function runMaintenance(deps: MaintenanceDeps): Promise<void> {
  try {
    await deps.poke();
  } catch {
    // "too soon" / "stale feed" are normal — skip silently
  }
  try {
    await deps.refresh();
  } catch (e) {
    console.error("ward: refresh failed", e);
  }
}

function makeClients() {
  const account = privateKeyToAccount(config.keeperKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain: rhChain, transport });
  const wallet = createWalletClient({ account, chain: rhChain, transport });
  return { account, publicClient, wallet };
}

export function makeProtect() {
  const { publicClient, wallet, account } = makeClients();
  return async (user: `0x${string}`) => {
    const call = { address: config.wardVault, abi: wardVaultAbi, functionName: "protect", args: [user] } as const;
    await publicClient.simulateContract({ ...call, account: account.address });
    const hash = await wallet.writeContract(call);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") console.error(`ward: protect(${user}) reverted, hash=${hash}`);
  };
}

export function makePoke() {
  const { publicClient, wallet, account } = makeClients();
  return async () => {
    const call = { address: config.priceHistory, abi: priceHistoryAbi, functionName: "poke", args: [] } as const;
    await publicClient.simulateContract({ ...call, account: account.address });
    const hash = await wallet.writeContract(call);
    await publicClient.waitForTransactionReceipt({ hash });
  };
}

/// Guard: skips a new tick if the previous one is still running, preventing concurrent protect() calls.
export function makeTickRunner(tick: () => Promise<void>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } finally {
      running = false;
    }
  };
}

export function makeRefresh() {
  const { publicClient, wallet, account } = makeClients();
  return async () => {
    const call = { address: config.riskModel, abi: dynamicRiskAbi, functionName: "refresh", args: [] } as const;
    await publicClient.simulateContract({ ...call, account: account.address });
    const hash = await wallet.writeContract(call);
    await publicClient.waitForTransactionReceipt({ hash });
  };
}
