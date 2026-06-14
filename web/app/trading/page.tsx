"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import { TrendingDown, Wallet, Droplets } from "lucide-react";
import { useWard } from "@/components/ward-provider";
import { ConnectButton } from "@/components/connect";
import { Reveal } from "@/components/reveal";
import { HealthBar } from "@/components/health-bar";
import { Input } from "@/components/ui/input";
import { sendTx } from "@/lib/tx";
import { ADDR, TSLA_DECIMALS, USDG_DECIMALS } from "@/lib/contracts";
import { erc20Abi, lendingCoreAbi } from "@/lib/abi";
import { usd2, hfColor, hfLabel, groupInt } from "@/lib/format";

type ActionKey = "deposit" | "borrow" | "repay" | "withdraw";
const ACTIONS: { key: ActionKey; label: string; token: "TSLA" | "USDG" }[] = [
  { key: "deposit", label: "Deposit", token: "TSLA" },
  { key: "borrow", label: "Borrow", token: "USDG" },
  { key: "repay", label: "Repay", token: "USDG" },
  { key: "withdraw", label: "Withdraw", token: "TSLA" },
];

export default function TradingPage() {
  const {
    connected,
    price,
    thresholdBps,
    tslaBalance,
    usdgBalance,
    collateral,
    debt,
    hasPosition,
    poolLiquidity,
    refetchAll,
  } = useWard();

  const [action, setAction] = useState<ActionKey>("deposit");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const thr = thresholdBps > 0 ? thresholdBps / 10000 : 0.8;
  const amt = Number(amount) || 0;
  const curHf = debt > 0 ? (collateral * price * thr) / debt : Infinity;

  // bornes + position résultante selon l'action
  const { max, unit, newCol, newDebt } = useMemo(() => {
    switch (action) {
      case "deposit":
        return { max: tslaBalance, unit: "TSLA", newCol: collateral + amt, newDebt: debt };
      case "borrow": {
        const cap = Math.max((collateral * price * thr) - debt, 0);
        return { max: Math.min(cap, poolLiquidity), unit: "USDG", newCol: collateral, newDebt: debt + amt };
      }
      case "repay":
        return { max: Math.min(debt, usdgBalance), unit: "USDG", newCol: collateral, newDebt: Math.max(debt - amt, 0) };
      case "withdraw": {
        const keep = debt > 0 ? debt / (price * thr) : 0; // collatéral mini pour HF=1
        return { max: Math.max(collateral - keep, 0), unit: "TSLA", newCol: Math.max(collateral - amt, 0), newDebt: debt };
      }
    }
  }, [action, amt, collateral, debt, price, thr, tslaBalance, usdgBalance, poolLiquidity]);

  const newHf = newDebt > 0 ? (newCol * price * thr) / newDebt : Infinity;
  const newLiq = newCol > 0 && newDebt > 0 ? newDebt / (newCol * thr) : 0;
  const valid =
    amt > 0 &&
    amt <= max + 1e-9 &&
    (action === "deposit" || action === "repay" || newHf >= 1);

  const run = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (action === "deposit") {
        const w = parseUnits(String(amt), TSLA_DECIMALS);
        await sendTx({ address: ADDR.tsla, abi: erc20Abi, functionName: "approve", args: [ADDR.lendingCore, w] }, { pending: "Approving TSLA…", success: "TSLA approved" });
        await sendTx({ address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "deposit", args: [w] }, { pending: "Depositing…", success: "Collateral deposited" });
      } else if (action === "borrow") {
        const w = parseUnits(String(amt), USDG_DECIMALS);
        await sendTx({ address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "borrow", args: [w] }, { pending: "Borrowing…", success: "USDG borrowed" });
      } else if (action === "repay") {
        const w = parseUnits(String(amt), USDG_DECIMALS);
        await sendTx({ address: ADDR.usdg, abi: erc20Abi, functionName: "approve", args: [ADDR.lendingCore, w] }, { pending: "Approving USDG…", success: "USDG approved" });
        await sendTx({ address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "repay", args: [w] }, { pending: "Repaying…", success: "Debt repaid" });
      } else {
        const w = parseUnits(String(amt), TSLA_DECIMALS);
        await sendTx({ address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "withdraw", args: [w] }, { pending: "Withdrawing…", success: "Collateral withdrawn" });
      }
      refetchAll();
      setAmount("");
    } catch {
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 py-28 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ward/10 text-ward"><Wallet className="h-6 w-6" /></div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Connect your wallet</h1>
        <p className="text-sm text-muted-foreground">You must be connected to manage your position.</p>
        <ConnectButton big />
      </div>
    );
  }

  const balLine =
    unit === "TSLA"
      ? `Wallet balance: ${tslaBalance.toFixed(2)} TSLA`
      : `Wallet balance: ${groupInt(usdgBalance)} USDG`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Trading · manage your position</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">
          {hasPosition ? "Manage your position" : "Open a credit line"}
        </h1>
      </Reveal>

      {/* résumé position */}
      <Reveal>
        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-hairline bg-paper p-5 sm:grid-cols-4">
          {[
            ["Collateral", `${collateral} TSLA`],
            ["Debt", `${groupInt(debt)} USDG`],
            ["TSLA price", usd2(price)],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="mt-1 font-medium tnum">{v}</div>
            </div>
          ))}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Health factor</div>
            <div className="mt-1 font-medium tnum" style={{ color: hfColor(curHf) }}>
              {curHf === Infinity ? "∞" : curHf.toFixed(2)}
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* contrôles */}
        <Reveal>
          <div className="rounded-xl border border-hairline bg-paper p-6">
            {/* onglets d'action */}
            <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-secondary/60 p-1">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => { setAction(a.key); setAmount(""); }}
                  className={
                    "rounded-md py-2 text-xs font-medium transition-all " +
                    (action === a.key ? "bg-paper text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono tnum" />
              <span className="w-12 text-sm text-muted-foreground">{unit}</span>
              <button onClick={() => setAmount(String(unit === "TSLA" ? Math.floor(max * 100) / 100 : Math.floor(max)))} className="shrink-0 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                Max
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>{balLine}</span>
              <span>max {unit === "TSLA" ? max.toFixed(2) : groupInt(max)} {unit}</span>
            </div>

            {action === "deposit" && tslaBalance === 0 && (
              <Link href="/profil" className="mt-3 inline-flex items-center gap-1 text-xs text-ward hover:underline"><Droplets className="h-3 w-3" /> No TSLA — faucet</Link>
            )}
            {action === "repay" && usdgBalance === 0 && (
              <Link href="/profil" className="mt-3 inline-flex items-center gap-1 text-xs text-ward hover:underline"><Droplets className="h-3 w-3" /> No USDG — mint at faucet</Link>
            )}

            <button onClick={run} disabled={!valid || busy} className="mt-6 w-full rounded-md bg-foreground py-3 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? "Transaction in progress…" : ACTIONS.find((a) => a.key === action)!.label}
            </button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">Real transactions signed by your wallet · Robinhood Chain</p>
          </div>
        </Reveal>

        {/* aperçu */}
        <Reveal delay={0.08}>
          <div className="rounded-xl border border-hairline bg-paper p-6">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Health factor after</div>
            <div className="mt-1 font-serif text-6xl font-semibold leading-none tnum transition-colors" style={{ color: hfColor(newHf) }}>
              {newHf === Infinity ? "∞" : newHf.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{hfLabel(newHf)}</div>
            <div className="mt-5"><HealthBar hf={newHf === Infinity ? 1.6 : newHf} /></div>

            <dl className="mt-6 space-y-2.5 border-t border-hairline pt-5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Collateral</dt>
                <dd className="font-mono tnum">{collateral} → {newCol.toFixed(2)} TSLA</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Debt</dt>
                <dd className="font-mono tnum">{groupInt(debt)} → {groupInt(newDebt)} USDG</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><TrendingDown className="h-3.5 w-3.5" /> Liquidation price</dt>
                <dd className="font-mono font-medium tnum text-danger">{newDebt > 0 ? usd2(newLiq) : "—"}</dd>
              </div>
            </dl>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
