import { config, assertConfig } from "./config.js";
import { readHealthFactor, publicClient } from "./monitor.js";

assertConfig(); // fail fast on missing/bad env vars before wiring keys
import { runOnce, runMaintenance, makeProtect, makePoke, makeRefresh, WardDeps, Policy } from "./ward.js";
import { wardVaultAbi } from "./abi.js";

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
setInterval(() => {
  // 1) keep the on-chain risk signal fresh, then 2) protect anyone who breached their trigger
  runMaintenance(maintenance)
    .then(() => runOnce(deps))
    .catch((e) => console.error("ward error", e));
}, config.pollMs);
