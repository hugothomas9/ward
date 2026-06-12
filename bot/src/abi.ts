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
