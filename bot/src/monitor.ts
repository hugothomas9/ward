import { createPublicClient, http } from "viem";
import { config } from "./config.js";
import { lendingCoreAbi } from "./abi.js";

export const publicClient = createPublicClient({
  transport: http(config.rpcUrl),
});

export function shouldProtect(healthFactor: bigint, triggerHF: bigint): boolean {
  return healthFactor < triggerHF;
}

export async function readHealthFactor(user: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: config.lendingCore,
    abi: lendingCoreAbi,
    functionName: "healthFactor",
    args: [user],
  }) as Promise<bigint>;
}
