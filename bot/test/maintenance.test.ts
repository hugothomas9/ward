import { describe, it, expect } from "vitest";
import { runMaintenance } from "../src/ward.js";

describe("runMaintenance", () => {
  it("pokes the price history then refreshes the risk model", async () => {
    const calls: string[] = [];
    await runMaintenance({
      poke: async () => { calls.push("poke"); },
      refresh: async () => { calls.push("refresh"); },
    });
    expect(calls).toEqual(["poke", "refresh"]);
  });

  // poke reverting "too soon" (the rate limit) is EXPECTED — it must not stop the refresh
  it("still refreshes when poke reverts (rate-limited)", async () => {
    const calls: string[] = [];
    await runMaintenance({
      poke: async () => { throw new Error("too soon"); },
      refresh: async () => { calls.push("refresh"); },
    });
    expect(calls).toEqual(["refresh"]);
  });
});
