"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  useAccount,
  useBalance,
  useDisconnect,
  useReadContract,
} from "wagmi";
import { ADDR, TSLA_DECIMALS, USDG_DECIMALS } from "@/lib/contracts";
import {
  erc20Abi,
  lendingCoreAbi,
  wardVaultAbi,
  aggregatorAbi,
  dynamicRiskAbi,
} from "@/lib/abi";

const toNum = (v: bigint | undefined | null, dec: number) =>
  v === undefined || v === null ? 0 : Number(v) / 10 ** dec;

// HF en WAD ; dette nulle => uint256 max => on renvoie Infinity
const toHf = (v: bigint | undefined) => {
  if (v === undefined) return Infinity;
  if (v > 10n ** 30n) return Infinity;
  return Number(v) / 1e18;
};

type WardState = {
  connected: boolean;
  address: `0x${string}` | undefined;
  connectorName: string | undefined;

  // marché (public, lu même déconnecté)
  price: number; // TSLA en USD
  thresholdBps: number; // seuil de liquidation courant (bps)

  // soldes du wallet connecté
  ethBalance: number;
  tslaBalance: number;
  usdgBalance: number;

  // position on-chain
  collateral: number; // TSLA
  debt: number; // USDG
  healthFactor: number;
  hasPosition: boolean;

  // Ward
  buffer: number; // USDG
  triggerHF: number;
  targetHF: number;
  policyActive: boolean;

  isLoading: boolean;
  refetchAll: () => void;
  disconnect: () => void;
};

const Ctx = createContext<WardState | null>(null);

export function WardProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const enabled = isConnected && !!address;
  const q = (extra = true) => ({
    query: { enabled: extra, refetchInterval: 10_000 },
  });

  // ---- marché (public) ----
  const feed = useReadContract({
    address: ADDR.feed,
    abi: aggregatorAbi,
    functionName: "latestRoundData",
    query: { refetchInterval: 10_000 },
  });
  const threshold = useReadContract({
    address: ADDR.riskModel,
    abi: dynamicRiskAbi,
    functionName: "liquidationThresholdBps",
    args: [ADDR.tsla],
    query: { refetchInterval: 10_000 },
  });

  // ---- soldes ----
  const eth = useBalance({ address, query: { enabled, refetchInterval: 10_000 } });
  const tsla = useReadContract({
    address: ADDR.tsla,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    ...q(enabled),
  });
  const usdg = useReadContract({
    address: ADDR.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    ...q(enabled),
  });

  // ---- position ----
  const position = useReadContract({
    address: ADDR.lendingCore,
    abi: lendingCoreAbi,
    functionName: "positionOf",
    args: [address!],
    ...q(enabled),
  });
  const hf = useReadContract({
    address: ADDR.lendingCore,
    abi: lendingCoreAbi,
    functionName: "healthFactor",
    args: [address!],
    ...q(enabled),
  });

  // ---- Ward ----
  const buffer = useReadContract({
    address: ADDR.wardVault,
    abi: wardVaultAbi,
    functionName: "bufferOf",
    args: [address!],
    ...q(enabled),
  });
  const policy = useReadContract({
    address: ADDR.wardVault,
    abi: wardVaultAbi,
    functionName: "policyOf",
    args: [address!],
    ...q(enabled),
  });

  const value = useMemo<WardState>(() => {
    const feedAnswer = feed.data?.[1] as bigint | undefined;
    const price = feedAnswer ? Number(feedAnswer) / 1e8 : 0;
    const thresholdBps = threshold.data ? Number(threshold.data) : 8000;

    const pos = position.data as readonly [bigint, bigint] | undefined;
    const collateral = toNum(pos?.[0], TSLA_DECIMALS);
    const debt = toNum(pos?.[1], USDG_DECIMALS);

    const pol = policy.data as
      | readonly [bigint, bigint, `0x${string}`, boolean]
      | undefined;

    return {
      connected: isConnected,
      address,
      connectorName: connector?.name,

      price,
      thresholdBps,

      ethBalance: eth.data ? Number(eth.data.value) / 1e18 : 0,
      tslaBalance: toNum(tsla.data as bigint | undefined, TSLA_DECIMALS),
      usdgBalance: toNum(usdg.data as bigint | undefined, USDG_DECIMALS),

      collateral,
      debt,
      healthFactor: toHf(hf.data as bigint | undefined),
      hasPosition: debt > 0 || collateral > 0,

      buffer: toNum(buffer.data as bigint | undefined, USDG_DECIMALS),
      triggerHF: pol ? Number(pol[0]) / 1e18 : 0,
      targetHF: pol ? Number(pol[1]) / 1e18 : 0,
      policyActive: pol ? pol[3] : false,

      isLoading: enabled && (position.isLoading || hf.isLoading),
      refetchAll: () => {
        feed.refetch();
        threshold.refetch();
        eth.refetch();
        tsla.refetch();
        usdg.refetch();
        position.refetch();
        hf.refetch();
        buffer.refetch();
        policy.refetch();
      },
      disconnect,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isConnected,
    address,
    connector,
    feed.data,
    threshold.data,
    eth.data,
    tsla.data,
    usdg.data,
    position.data,
    hf.data,
    buffer.data,
    policy.data,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWard must be used within WardProvider");
  return ctx;
}
