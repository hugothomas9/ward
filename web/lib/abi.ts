/** ABIs minimales mais exactes des contrats Ward (cf. src/*.sol). */

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const lendingCoreAbi = [
  { type: "function", name: "provide", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "borrow", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "repay", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "positionOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "collateral", type: "uint256" }, { name: "debt", type: "uint256" }] },
  { type: "function", name: "healthFactor", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const wardVaultAbi = [
  { type: "function", name: "fund", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "defund", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "setPolicy", stateMutability: "nonpayable", inputs: [{ name: "triggerHF", type: "uint256" }, { name: "targetHF", type: "uint256" }, { name: "keeper", type: "address" }], outputs: [] },
  { type: "function", name: "protect", stateMutability: "nonpayable", inputs: [{ name: "user", type: "address" }], outputs: [] },
  { type: "function", name: "bufferOf", stateMutability: "view", inputs: [{ name: "u", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "policyOf", stateMutability: "view", inputs: [{ name: "u", type: "address" }], outputs: [{ name: "triggerHF", type: "uint256" }, { name: "targetHF", type: "uint256" }, { name: "keeper", type: "address" }, { name: "active", type: "bool" }] },
] as const;

export const aggregatorAbi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [], outputs: [{ type: "uint80" }, { name: "answer", type: "int256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint80" }] },
  { type: "function", name: "updateAnswer", stateMutability: "nonpayable", inputs: [{ name: "answer", type: "int256" }], outputs: [] },
] as const;

export const priceHistoryAbi = [
  { type: "function", name: "poke", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export const dynamicRiskAbi = [
  { type: "function", name: "refresh", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "liquidationThresholdBps", stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
