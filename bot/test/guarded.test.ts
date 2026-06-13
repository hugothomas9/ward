import { describe, it, expect } from "vitest";
import { makeGuardedRunner } from "../src/ward.js";

describe("makeGuardedRunner", () => {
  // a slow cycle must not overlap with the next tick (which would double-protect / clash nonces)
  it("skips an overlapping invocation while one is still running", async () => {
    let runs = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const run = makeGuardedRunner(async () => { runs++; await gate; });

    const p1 = run(); // starts, blocks on the gate
    await run();      // overlapping call -> skipped immediately
    expect(runs).toBe(1);

    release();
    await p1;
  });

  it("runs again once the previous cycle finished", async () => {
    let runs = 0;
    const run = makeGuardedRunner(async () => { runs++; });
    await run();
    await run();
    expect(runs).toBe(2);
  });

  it("releases the lock even if the task throws", async () => {
    let runs = 0;
    const run = makeGuardedRunner(async () => { runs++; throw new Error("boom"); });
    await expect(run()).rejects.toThrow("boom");
    await expect(run()).rejects.toThrow("boom"); // not stuck "running"
    expect(runs).toBe(2);
  });
});
