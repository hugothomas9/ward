import { defineChain } from "viem";
import { config } from "./config.js";

/// Explicit chain definition so every tx is bound to chain 46630 (replay-safe). Passing
/// `chain: null` to writeContract (as before) left txs without a chainId.
export const robinhoodTestnet = defineChain({
  id: config.chainId,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});
