import { config, validateConfig } from "./config.js";
import { readHealthFactor, publicClient } from "./monitor.js";
import { runOnce, runMaintenance, makeProtect, makePoke, makeRefresh, makeTickRunner, WardDeps, Policy } from "./ward.js";
import { wardVaultAbi } from "./abi.js";

// Fail fast on startup if env vars are missing or malformed — never let an undefined address
// reach viem and produce a cryptic RPC error far from the root cause.
validateConfig(config);

const TRACKED: `0x${string}`[] = (process.env.TRACKED_USERS ?? "")
  .split(",").filter(Boolean) as `0x${string}`[];

async function readPolicy(user: `0x${string}`): Promise<Policy> {
  const [triggerHF, , , set] = await publicClient.readContract({
    address: config.wardVault, abi: wardVaultAbi, functionName: "policyOf", args: [user],
  }) as readonly [bigint, bigint, `0x${string}`, boolean];
  return { triggerHF, set };
}

const deps: WardDeps = {
  users: TRACKED,
  readHealthFactor,
  readPolicy,
  protect: makeProtect(),
};

const maintenance = { poke: makePoke(), refresh: makeRefresh() };

// F12: warn at startup if any tracked user has no policy, so the operator sees it
// immediately rather than discovering an unprotected position after a liquidation.
async function startupCheck(): Promise<void> {
  for (const user of TRACKED) {
    try {
      const { set } = await readPolicy(user);
      if (!set) console.warn(`ward: tracked user ${user} has NO Ward policy at startup`);
    } catch (e) {
      console.error(`ward: startup policy read failed for ${user}`, e);
    }
  }
}

console.log(`Ward watching ${TRACKED.length} users every ${config.pollMs}ms`);
void startupCheck();

const tick = makeTickRunner(() =>
  runMaintenance(maintenance).then(() => runOnce(deps))
);

setInterval(() => {
  tick().catch((e) => console.error("ward error", e));
}, config.pollMs);
