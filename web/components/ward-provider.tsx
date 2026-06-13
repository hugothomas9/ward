"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  INITIAL_CREDITS,
  INITIAL_PRICE,
  type Credit,
  collateralValue,
  healthFactor,
} from "@/lib/ward";

type WalletKind = "metamask" | "robinhood" | "walletconnect";

type WardState = {
  connected: boolean;
  address: string;
  wallet: WalletKind | null;
  price: number; // TSLA
  cashUSDG: number;
  walletTSLA: number;
  credits: Credit[];

  // dérivés
  netWorth: number;
  totalCollateralValue: number;
  totalDebt: number;
  bufferTotal: number;
  hfOf: (c: Credit) => number;

  // actions
  connect: (kind: WalletKind) => void;
  disconnect: () => void;
  openPosition: (input: { collateral: number; debt: number }) => string;
  setPolicy: (
    id: string,
    patch: Partial<Pick<Credit, "warded" | "buffer" | "triggerHF" | "targetHF">>,
  ) => void;
};

const Ctx = createContext<WardState | null>(null);

const DEMO_ADDRESS = "0xDA547bb1e6a9ED39c375703A75e13a82FCefc85E";

export function WardProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [wallet, setWallet] = useState<WalletKind | null>(null);
  const [price] = useState(INITIAL_PRICE);
  const [cashUSDG, setCashUSDG] = useState(1200);
  const [walletTSLA, setWalletTSLA] = useState(8);
  const [credits, setCredits] = useState<Credit[]>(INITIAL_CREDITS);

  const value = useMemo<WardState>(() => {
    const hfOf = (c: Credit) => healthFactor(c, price);
    const totalCollateralValue = credits.reduce(
      (s, c) => s + collateralValue(c, price),
      0,
    );
    const totalDebt = credits.reduce((s, c) => s + c.debt, 0);
    const bufferTotal = credits.reduce((s, c) => s + c.buffer, 0);
    const netWorth =
      cashUSDG + walletTSLA * price + totalCollateralValue - totalDebt;

    return {
      connected,
      address: DEMO_ADDRESS,
      wallet,
      price,
      cashUSDG,
      walletTSLA,
      credits,
      netWorth,
      totalCollateralValue,
      totalDebt,
      bufferTotal,
      hfOf,
      connect: (kind) => {
        setWallet(kind);
        setConnected(true);
      },
      disconnect: () => {
        setConnected(false);
        setWallet(null);
      },
      openPosition: ({ collateral, debt }) => {
        const id = "c" + (credits.length + 1) + "-" + collateral + "x" + debt;
        setWalletTSLA((b) => Math.max(b - collateral, 0));
        setCashUSDG((b) => b + debt);
        setCredits((cs) => [
          ...cs,
          {
            id,
            collateral,
            debt,
            warded: true,
            buffer: Math.round(debt * 0.3),
            triggerHF: 1.2,
            targetHF: 1.5,
          },
        ]);
        return id;
      },
      setPolicy: (id, patch) =>
        setCredits((cs) =>
          cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        ),
    };
  }, [connected, wallet, price, cashUSDG, walletTSLA, credits]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWard must be used within WardProvider");
  return ctx;
}
