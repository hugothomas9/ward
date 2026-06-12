import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { wardVaultAbi } from "./abi.js";
import { shouldProtect } from "./monitor.js";

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

export function makeProtect() {
  const account = privateKeyToAccount(config.keeperKey);
  const wallet = createWalletClient({ account, transport: http(config.rpcUrl) });
  return async (user: `0x${string}`) => {
    await wallet.writeContract({
      address: config.wardVault,
      abi: wardVaultAbi,
      functionName: "protect",
      args: [user],
      chain: null,
    });
  };
}
