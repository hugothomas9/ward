import { describe, it, expect, vi } from "vitest";
import { runOnce } from "../src/ward.js";

const policy = (triggerHF: bigint, set = true) => async () => ({ triggerHF, set });

describe("runOnce", () => {
  it("calls protect exactly when triggered, with only the user arg", async () => {
    const calls: string[] = [];
    const deps = {
      users: ["0xUser" as `0x${string}`],
      readHealthFactor: async () => 1_000000000000000000n,
      readPolicy: policy(1_200000000000000000n),
      protect: async (user: `0x${string}`) => { calls.push(user); },
    };
    await runOnce(deps);
    expect(calls).toEqual(["0xUser"]);
  });

  it("does nothing when healthy", async () => {
    const calls: string[] = [];
    const deps = {
      users: ["0xUser" as `0x${string}`],
      readHealthFactor: async () => 2_000000000000000000n,
      readPolicy: policy(1_200000000000000000n),
      protect: async (u: `0x${string}`) => { calls.push(u); },
    };
    await runOnce(deps);
    expect(calls).toEqual([]);
  });

  it("keeps going if one user read fails (resilience)", async () => {
    const calls: string[] = [];
    const deps = {
      users: ["0xBad" as `0x${string}`, "0xGood" as `0x${string}`],
      readHealthFactor: async (u: `0x${string}`) => {
        if (u === "0xBad") throw new Error("rpc fail");
        return 1_000000000000000000n;
      },
      readPolicy: policy(1_200000000000000000n),
      protect: async (u: `0x${string}`) => { calls.push(u); },
    };
    await runOnce(deps);
    expect(calls).toEqual(["0xGood"]);
  });

  // F12: a tracked user without a Ward policy must NOT be a silent no-op — it must warn
  // loudly and never be treated as "protected". This is the worst failure mode for a
  // "sleep safe" product, so it must be visible in logs and never silently skipped.
  it("warns and skips a tracked user with no policy (never silent)", async () => {
    const calls: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = {
      users: ["0xNoPolicy" as `0x${string}`],
      readHealthFactor: async () => 1_000000000000000000n, // would otherwise trigger
      readPolicy: async () => ({ triggerHF: 0n, set: false }),
      protect: async (u: `0x${string}`) => { calls.push(u); },
    };
    await runOnce(deps);
    expect(calls).toEqual([]); // never protected
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(" ")).toContain("0xNoPolicy");
    warn.mockRestore();
  });
});
