import { describe, it, expect, beforeEach } from "vitest";
import { assertConfig } from "../src/config.js";

const REQUIRED = ["LENDING_CORE", "WARD_VAULT", "PRICE_HISTORY", "RISK_MODEL", "KEEPER_KEY"];

describe("assertConfig", () => {
  beforeEach(() => {
    for (const k of REQUIRED) process.env[k] = "0xabc123";
  });

  it("passes when all required env vars are present and hex", () => {
    expect(() => assertConfig()).not.toThrow();
  });

  it("throws a clear error naming a missing var", () => {
    delete process.env.LENDING_CORE;
    expect(() => assertConfig()).toThrow(/LENDING_CORE/);
  });

  it("throws when a var is present but not a hex address", () => {
    process.env.WARD_VAULT = "not-an-address";
    expect(() => assertConfig()).toThrow(/WARD_VAULT/);
  });
});
