import { describe, it, expect } from "vitest";
import { validateConfig } from "../src/config.js";

// Anvil default accounts — known valid 40-char hex addresses
const A1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`;
const A2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;
const A3 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as `0x${string}`;
const A4 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as `0x${string}`;
// Anvil default private key (64 hex chars)
const K1 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;

const VALID = {
  rpcUrl: "https://rpc.example.com",
  chainId: 46630,
  lendingCore:  A1,
  wardVault:    A2,
  priceHistory: A3,
  riskModel:    A4,
  keeperKey:    K1,
  pollMs: 5000,
};

describe("validateConfig", () => {
  it("passes with a valid config", () => {
    expect(() => validateConfig(VALID)).not.toThrow();
  });

  it("rejects missing lendingCore", () => {
    const bad = { ...VALID, lendingCore: undefined as unknown as `0x${string}` };
    expect(() => validateConfig(bad)).toThrow(/lendingCore/);
  });

  it("rejects missing wardVault", () => {
    const bad = { ...VALID, wardVault: undefined as unknown as `0x${string}` };
    expect(() => validateConfig(bad)).toThrow(/wardVault/);
  });

  it("rejects missing priceHistory", () => {
    const bad = { ...VALID, priceHistory: undefined as unknown as `0x${string}` };
    expect(() => validateConfig(bad)).toThrow(/priceHistory/);
  });

  it("rejects missing riskModel", () => {
    const bad = { ...VALID, riskModel: undefined as unknown as `0x${string}` };
    expect(() => validateConfig(bad)).toThrow(/riskModel/);
  });

  it("rejects missing keeperKey", () => {
    const bad = { ...VALID, keeperKey: undefined as unknown as `0x${string}` };
    expect(() => validateConfig(bad)).toThrow(/keeperKey/);
  });

  it("rejects malformed address (not 0x + 40 hex)", () => {
    const bad = { ...VALID, lendingCore: "0xZZZZ" as `0x${string}` };
    expect(() => validateConfig(bad)).toThrow(/lendingCore/);
  });

  it("rejects malformed keeperKey (not 0x + 64 hex)", () => {
    const bad = { ...VALID, keeperKey: "0xshort" as `0x${string}` };
    expect(() => validateConfig(bad)).toThrow(/keeperKey/);
  });
});
