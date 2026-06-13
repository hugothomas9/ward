import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { wardVaultAbi, priceHistoryAbi, dynamicRiskAbi } from "./abi.js";
import { shouldProtect, publicClient } from "./monitor.js";
import { robinhoodTestnet } from "./chain.js";

/// Wraps a periodic task so an overflowing cycle (slow RPC, pending tx) cannot overlap with the
/// next tick — overlapping cycles would double-protect a user and clash nonces.
export function makeGuardedRunner(task: () => Promise<void>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) {
      console.warn("ward: previous cycle still running, skipping this tick");
      return;
    }
    running = true;
    try {
      await task();
    } finally {
      running = false;
    }
  };
}

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

// Lazily built so importing this module never requires a valid key (tests inject deps and
// never call these). The keeper wallet/account are created on first real submission.
let _wallet: ReturnType<typeof createWalletClient> | undefined;
let _account: ReturnType<typeof privateKeyToAccount> | undefined;
function keeper() {
  if (!_wallet || !_account) {
    _account = privateKeyToAccount(config.keeperKey);
    _wallet = createWalletClient({ account: _account, chain: robinhoodTestnet, transport: http(config.rpcUrl) });
  }
  return { wallet: _wallet, account: _account };
}

/// Submit a state-changing call, hardened:
///  1. simulateContract first — a tx that would revert (not keeper / not triggered / too soon)
///     throws HERE, so we never broadcast a doomed tx and never waste gas.
///  2. writeContract with the explicit chain (replay-safe, no `chain: null`).
///  3. waitForTransactionReceipt and assert success — an included-but-reverted tx is not silently
///     treated as a success.
async function writeAndWait(
  address: `0x${string}`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  functionName: string,
  args: readonly unknown[],
): Promise<`0x${string}`> {
  const { wallet, account } = keeper();
  const { request } = await publicClient.simulateContract({
    account,
    address,
    abi,
    functionName,
    args,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`ward: tx ${hash} reverted`);
  return hash;
}

export function makeProtect() {
  return (user: `0x${string}`) => writeAndWait(config.wardVault, wardVaultAbi, "protect", [user]).then(() => {});
}

export function makePoke() {
  return () => writeAndWait(config.priceHistory, priceHistoryAbi, "poke", []).then(() => {});
}

export function makeRefresh() {
  return () => writeAndWait(config.riskModel, dynamicRiskAbi, "refresh", []).then(() => {});
}
