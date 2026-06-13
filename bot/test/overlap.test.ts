import { describe, it, expect, vi } from "vitest";
import { makeTickRunner } from "../src/ward.js";

describe("makeTickRunner (overlap guard)", () => {
  it("does not start a second cycle while one is running", async () => {
    let resolve!: () => void;
    let callCount = 0;
    const slowTick = () =>
      new Promise<void>((res) => {
        callCount++;
        resolve = res;
      });

    const tick = makeTickRunner(slowTick);

    // First tick — starts, doesn't finish yet
    const p1 = tick();
    // Second tick while first is still running — must be a no-op
    const p2 = tick();
    await p2; // resolves immediately (skipped)
    expect(callCount).toBe(1); // only one actual call

    resolve(); // finish the first
    await p1;
    expect(callCount).toBe(1);
  });

  it("allows a new cycle after the previous finishes", async () => {
    let callCount = 0;
    const fastTick = async () => { callCount++; };
    const tick = makeTickRunner(fastTick);

    await tick();
    await tick();
    expect(callCount).toBe(2);
  });
});
