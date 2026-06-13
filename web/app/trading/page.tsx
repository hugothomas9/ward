"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Wallet, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { ConnectButton } from "@/components/connect";
import { Reveal } from "@/components/reveal";
import { HealthBar } from "@/components/health-bar";
import { Slider } from "@/components/ui/slider";
import { LIQ_THRESHOLD, maxBorrow } from "@/lib/ward";
import { usd, usd2, hfColor, hfLabel, groupInt, num1 } from "@/lib/format";

export default function TradingPage() {
  const { connected, price, walletTSLA, openPosition } = useWard();
  const router = useRouter();

  const [collateral, setCollateral] = useState(4);
  const [debt, setDebt] = useState(500);
  const [warded, setWarded] = useState(true);

  const maxB = useMemo(() => maxBorrow(collateral, price), [collateral, price]);
  const hf = debt > 0 ? (collateral * price * LIQ_THRESHOLD) / debt : Infinity;
  const liqPrice = collateral > 0 ? debt / (collateral * LIQ_THRESHOLD) : 0;
  const buffer = warded ? Math.round(debt * 0.3) : 0;
  const protectedPrice =
    warded && collateral > 0
      ? Math.max(debt - buffer, 0) / (collateral * LIQ_THRESHOLD)
      : liqPrice;
  const healthy = debt <= maxB + 0.01 && collateral > 0 && debt > 0;

  const setCollateralSafe = (v: number) => {
    setCollateral(v);
    const m = maxBorrow(v, price);
    setDebt((d) => Math.min(d, Math.round(m)));
  };

  const submit = () => {
    if (!healthy) return;
    openPosition({ collateral, debt });
    toast.success("Position ouverte", {
      description: `${collateral} TSLA déposés · ${groupInt(debt)} USDG empruntés${
        warded ? " · Ward armé" : ""
      }`,
    });
    router.push("/");
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
      </Reveal>

      <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        {/* contrôles */}
        <Reveal>
          <div className="space-y-7 rounded-xl border border-hairline bg-paper p-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Prix TSLA</span>
              <span className="font-mono font-medium tnum">{usd2(price)}</span>
            </div>

            {/* collatéral */}
            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium">Collatéral à déposer</label>
                <span className="font-mono text-sm tnum">
                  {collateral.toFixed(1)} TSLA{" "}
                  <span className="text-muted-foreground">
                    · {usd(collateral * price)}
                  </span>
                </span>
              </div>
              <Slider
                className="mt-3"
                value={[collateral]}
                min={0}
                max={walletTSLA}
                step={0.5}
                onValueChange={(v) => setCollateralSafe(num1(v))}
              />
              <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                Solde wallet : {walletTSLA} TSLA
              </div>
            </div>

            {/* dette */}
            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium">Emprunt</label>
                <span className="font-mono text-sm tnum">
                  {groupInt(debt)} USDG
                </span>
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
                Capacité max : {groupInt(maxB)} USDG (seuil{" "}
                {LIQ_THRESHOLD * 100} %)
              </div>
            </div>

            {/* Ward */}
            <button
              onClick={() => setWarded((w) => !w)}
              className={
                "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all " +
                (warded
                  ? "border-ward/40 bg-ward/8"
                  : "border-hairline bg-background")
              }
            >
              <ShieldCheck
                className={"h-5 w-5 " + (warded ? "text-ward" : "text-muted-foreground")}
              />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {warded ? "Ward armé" : "Ward désarmé"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {warded
                    ? `Buffer de ${groupInt(buffer)} USDG · protège jusqu'à ${usd(protectedPrice)}`
                    : "Aucune protection anti-liquidation"}
                </div>
              </div>
              <span
                className={
                  "relative h-6 w-11 rounded-full transition-colors " +
                  (warded ? "bg-ward" : "bg-secondary")
                }
              >
                <span
                  className={
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
                    (warded ? "left-[22px]" : "left-0.5")
                  }
                />
              </span>
            </button>
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
                  {usd2(liqPrice)}
                </dd>
              </div>
              {warded && (
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Protégé par Ward jusqu&apos;à
                  </dt>
                  <dd className="font-mono font-medium tnum text-ward">
                    {usd2(protectedPrice)}
                  </dd>
                </div>
              )}
            </dl>

            <button
              onClick={submit}
              disabled={!healthy}
              className="mt-6 w-full rounded-md bg-foreground py-3 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {healthy ? "Ouvrir la position" : "Paramètres invalides"}
            </button>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
