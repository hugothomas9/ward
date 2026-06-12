export const lendingCoreAbi = [
  { type: "function", name: "healthFactor", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "positionOf", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }] },
] as const;

export const wardVaultAbi = [
  { type: "function", name: "protect", stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }], outputs: [] },
  { type: "function", name: "policyOf", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address" }, { type: "bool" }] },
] as const;

// keeps the on-chain risk signal fresh — both are permissionless and can only move state
// toward honest values (poke appends the real feed price; refresh moves the threshold toward
// the engine target with the F3 rate limit)
export const priceHistoryAbi = [
  { type: "function", name: "poke", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export const dynamicRiskAbi = [
  { type: "function", name: "refresh", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;
