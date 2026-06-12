import { describe, it, expect } from "vitest";
import { shouldProtect } from "../src/monitor.js";

describe("shouldProtect", () => {
  it("triggers when HF below trigger", () => {
    expect(shouldProtect(1_100000000000000000n, 1_200000000000000000n)).toBe(true);
  });
  it("does not trigger when HF at/above trigger", () => {
    expect(shouldProtect(1_300000000000000000n, 1_200000000000000000n)).toBe(false);
  });
  it("boundary: equal is not triggered", () => {
    expect(shouldProtect(1_200000000000000000n, 1_200000000000000000n)).toBe(false);
  });
});
