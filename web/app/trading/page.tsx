"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseUnits } from "viem";
import { TrendingDown, Wallet, Droplets } from "lucide-react";
import { useWard } from "@/components/ward-provider";
import { ConnectButton } from "@/components/connect";
import { Reveal } from "@/components/reveal";
import { HealthBar } from "@/components/health-bar";
import { Slider } from "@/components/ui/slider";
import { sendTx } from "@/lib/tx";
import { ADDR, TSLA_DECIMALS, USDG_DECIMALS } from "@/lib/contracts";
import { erc20Abi, lendingCoreAbi } from "@/lib/abi";
import { LIQ_THRESHOLD, maxBorrow } from "@/lib/ward";
import { usd, usd2, hfColor, hfLabel, groupInt, num1 } from "@/lib/format";

export default function TradingPage() {
  const { connected, price, tslaBalance, hasPosition, collateral: posCol, debt: posDebt, refetchAll } =
    useWard();
  const router = useRouter();

  const [collateral, setCollateral] = useState(1);
  const [debt, setDebt] = useState(0);
  const [busy, setBusy] = useState(false);

  const maxB = useMemo(() => maxBorrow(collateral, price), [collateral, price]);
  const hf = debt > 0 ? (collateral * price * LIQ_THRESHOLD) / debt : Infinity;
  const liqPrice = collateral > 0 && debt > 0 ? debt / (collateral * LIQ_THRESHOLD) : 0;
  const healthy = collateral > 0 && collateral <= tslaBalance + 1e-9 && debt <= maxB + 0.01;

  const setCollateralSafe = (v: number) => {
    setCollateral(v);
    const m = maxBorrow(v, price);
    setDebt((d) => Math.min(d, Math.round(m)));
  };

  const submit = async () => {
    if (!healthy || busy) return;
    setBusy(true);
    try {
      const colWei = parseUnits(collateral.toString(), TSLA_DECIMALS);
      const debtWei = parseUnits(String(debt), USDG_DECIMALS);
      await sendTx(
        { address: ADDR.tsla, abi: erc20Abi, functionName: "approve", args: [ADDR.lendingCore, colWei] },
        { pending: "Approbation du TSLA…", success: "TSLA approuvé" },
      );
      await sendTx(
        { address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "deposit", args: [colWei] },
        { pending: "Dépôt du collatéral…", success: "Collatéral déposé" },
      );
      if (debtWei > 0n) {
        await sendTx(
          { address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "borrow", args: [debtWei] },
          { pending: "Emprunt d'USDG…", success: "USDG emprunté" },
        );
      }
      refetchAll();
      router.push("/");
    } catch {
      // toast géré dans sendTx
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 py-28 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ward/10 text-ward">
          <Wallet className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Connecte ton wallet
        </h1>
        <p className="text-sm text-muted-foreground">
          Tu dois être connecté pour déposer du collatéral et ouvrir un crédit.
        </p>
        <ConnectButton big />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Trading · ouvrir un crédit
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">
          Dépose du TSLA, emprunte de l&apos;USDG.
        </h1>
        {hasPosition && (
          <p className="mt-2 font-mono text-xs text-muted-foreground tnum">
            Position actuelle : {posCol} TSLA · dette {groupInt(posDebt)} USDG (ce
            dépôt s&apos;y ajoute)
          </p>
        )}
      </Reveal>

      <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        {/* contrôles */}
        <Reveal>
          <div className="space-y-7 rounded-xl border border-hairline bg-paper p-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Prix TSLA (on-chain)</span>
              <span className="font-mono font-medium tnum">{usd2(price)}</span>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium">Collatéral à déposer</label>
                <span className="font-mono text-sm tnum">
                  {collateral.toFixed(1)} TSLA{" "}
                  <span className="text-muted-foreground">· {usd(collateral * price)}</span>
                </span>
              </div>
              <Slider
                className="mt-3"
                value={[collateral]}
                min={0}
                max={Math.max(tslaBalance, 1)}
                step={0.5}
                onValueChange={(v) => setCollateralSafe(num1(v))}
              />
              <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>Solde wallet : {tslaBalance.toFixed(2)} TSLA</span>
                {tslaBalance === 0 && (
                  <Link href="/profil" className="inline-flex items-center gap-1 text-ward hover:underline">
                    <Droplets className="h-3 w-3" /> Faucet
                  </Link>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium">Emprunt</label>
                <span className="font-mono text-sm tnum">{groupInt(debt)} USDG</span>
              </div>
              <Slider
                className="mt-3"
                value={[debt]}
                min={0}
                max={Math.max(Math.round(maxB), 1)}
                step={10}
                onValueChange={(v) => setDebt(num1(v))}
              />
              <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                Capacité max : {groupInt(maxB)} USDG (seuil {LIQ_THRESHOLD * 100} %)
              </div>
            </div>
          </div>
        </Reveal>

        {/* aperçu santé */}
        <Reveal delay={0.08}>
          <div className="rounded-xl border border-hairline bg-paper p-6">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Health factor à l&apos;ouverture
            </div>
            <div
              className="mt-1 font-serif text-6xl font-semibold leading-none tnum transition-colors"
              style={{ color: hfColor(hf) }}
            >
              {hf === Infinity ? "∞" : hf.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{hfLabel(hf)}</div>
            <div className="mt-5">
              <HealthBar hf={hf === Infinity ? 1.6 : hf} />
            </div>

            <dl className="mt-6 space-y-2.5 border-t border-hairline pt-5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingDown className="h-3.5 w-3.5" /> Prix de liquidation
                </dt>
                <dd className="font-mono font-medium tnum text-danger">
                  {debt > 0 ? usd2(liqPrice) : "—"}
                </dd>
              </div>
            </dl>

            <button
              onClick={submit}
              disabled={!healthy || busy}
              className="mt-6 w-full rounded-md bg-foreground py-3 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "Transaction en cours…"
                : healthy
                  ? "Ouvrir la position"
                  : tslaBalance === 0
                    ? "Pas de TSLA — passe au faucet"
                    : "Paramètres invalides"}
            </button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Transactions réelles signées par ton wallet · Robinhood Chain testnet
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
