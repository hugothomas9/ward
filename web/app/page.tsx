"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Cpu,
  Lock,
  ArrowRight,
  Plus,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useWard } from "@/components/ward-provider";
import { ConnectButton } from "@/components/connect";
import { Reveal } from "@/components/reveal";
import { Sparkline } from "@/components/sparkline";
import { HealthBar } from "@/components/health-bar";
import { useCountUp } from "@/lib/use-count-up";
import { usd, usd2, hfColor, hfLabel, groupInt } from "@/lib/format";

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: "Autopilote anti-liquidation",
    body: "Ward surveille tes positions et rembourse depuis ton buffer avant que la liquidation ne tombe.",
  },
  {
    Icon: Cpu,
    title: "Moteur de risque en Stylus",
    body: "Un seuil de liquidation adaptatif à la volatilité, calculé on-chain en Rust (WASM).",
  },
  {
    Icon: Lock,
    title: "Dé-risquant par construction",
    body: "Le bot ne peut que réduire ta dette. Jamais ré-emprunter, jamais trader. Invariant vérifié.",
  },
];

const SPARK = [3800, 3900, 3850, 4000, 4100, 4050, 4180, 4150, 4240, 4210, 4250];

function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="grid items-center gap-10 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Robinhood Chain · crédit on-chain
          </p>
          <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Emprunte contre tes actions.
            <span className="block text-ward">Sans te faire liquider.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Ward est une ligne de crédit adossée aux actions tokenisées, avec un
            autopilote qui veille sur ta santé financière et te sort des krachs —
            automatiquement.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ConnectButton big />
            <Link
              href="/ward"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              Voir la démo anti-liquidation
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="rounded-2xl border border-hairline bg-paper p-6 shadow-[0_30px_60px_-40px_rgba(28,24,20,0.4)]">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Position protégée
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-ward/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ward">
                <ShieldCheck className="h-3 w-3" /> Ward armé
              </span>
            </div>
            <div className="mt-3 font-serif text-5xl font-semibold tnum text-ward">
              1.31
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Health factor · sauvée d&apos;un krach de −16 %
            </div>
            <div className="mt-5">
              <Sparkline data={SPARK} height={90} className="h-[90px] w-full" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4 text-center">
              {[
                ["Collatéral", "10 TSLA"],
                ["Dette", "1 300"],
                ["Buffer", "600 USDG"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {k}
                  </div>
                  <div className="mt-1 text-sm font-medium tnum">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="grid gap-5 pb-20 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={0.06 * i}>
            <div className="h-full rounded-xl border border-hairline bg-paper p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ward/10 text-ward">
                <f.Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-serif text-xl font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          </Reveal>
        ))}
      </section>
    </div>
  );
}

function Dashboard() {
  const {
    price,
    tslaBalance,
    usdgBalance,
    collateral,
    debt,
    healthFactor,
    hasPosition,
    buffer,
    policyActive,
  } = useWard();

  const collateralValue = collateral * price;
  const netWorth = usdgBalance + tslaBalance * price + collateralValue - debt;
  const shownBalance = useCountUp(netWorth, 1000);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* hero solde */}
      <Reveal>
        <div className="grid gap-6 rounded-2xl border border-hairline bg-paper p-7 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Solde net
            </div>
            <div className="mt-1 font-serif text-6xl font-semibold leading-none tnum">
              {usd2(shownBalance)}
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ward/10 px-2.5 py-1 text-xs font-medium text-ward">
              <ShieldCheck className="h-3.5 w-3.5" />
              {policyActive && buffer > 0
                ? "Couvert par Ward"
                : "Protection inactive"}
            </div>
          </div>
          <Sparkline data={SPARK} height={120} className="h-[120px] w-full" />
        </div>
      </Reveal>

      {/* stats */}
      <Reveal delay={0.06}>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Collatéral", usd(collateralValue)],
            ["Dette", usd(debt)],
            ["Buffer Ward", usd(buffer)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-hairline bg-paper p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {k}
              </div>
              <div className="mt-1.5 text-xl font-semibold tnum">{v}</div>
            </div>
          ))}
          <div className="rounded-xl border border-hairline bg-paper p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Health factor
            </div>
            <div
              className="mt-1.5 text-xl font-semibold tnum"
              style={{ color: hfColor(healthFactor) }}
            >
              {hasPosition
                ? healthFactor === Infinity
                  ? "∞"
                  : healthFactor.toFixed(2)
                : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {hasPosition ? hfLabel(healthFactor) : "aucune dette"}
            </div>
          </div>
        </div>
      </Reveal>

      {/* crédit / position */}
      <Reveal delay={0.1}>
        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Ton crédit
          </h2>
          <Link
            href="/trading"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> {hasPosition ? "Gérer" : "Ouvrir un crédit"}
          </Link>
        </div>

        {hasPosition ? (
          <Link
            href="/ward"
            className="group mt-4 flex items-center gap-5 rounded-lg border border-hairline bg-paper px-5 py-4 transition-all hover:border-ward/40"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">TSLA → USDG</span>
                {policyActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ward/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ward">
                    <ShieldCheck className="h-3 w-3" /> Ward
                  </span>
                ) : (
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Sans Ward
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground tnum">
                {collateral} TSLA · dette {groupInt(debt)} USDG
              </div>
              <div className="mt-2.5 max-w-[240px]">
                <HealthBar hf={healthFactor === Infinity ? 1.6 : healthFactor} />
              </div>
            </div>
            <div className="text-right">
              <div
                className="font-serif text-2xl font-semibold leading-none tnum"
                style={{ color: hfColor(healthFactor) }}
              >
                {healthFactor === Infinity ? "∞" : healthFactor.toFixed(2)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {hfLabel(healthFactor)}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-hairline bg-paper/50 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun crédit ouvert. Dépose du TSLA et emprunte de l&apos;USDG pour
              commencer.
            </p>
            <Link
              href="/trading"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Ouvrir un crédit
            </Link>
          </div>
        )}
      </Reveal>

      {/* CTA démo */}
      <Reveal delay={0.14}>
        <Link
          href="/ward"
          className="group mt-6 flex items-center gap-4 rounded-xl border border-hairline bg-foreground px-6 py-5 text-background transition-all hover:brightness-110"
        >
          <Zap className="h-5 w-5 shrink-0 text-background/80" />
          <div className="flex-1">
            <div className="font-serif text-lg font-semibold">
              Vois Ward sauver une position en direct
            </div>
            <div className="text-sm text-background/70">
              Crash le prix de TSLA et regarde l&apos;autopilote intervenir.
            </div>
          </div>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </div>
  );
}

export default function Home() {
  const { connected } = useWard();
  return connected ? <Dashboard /> : <Landing />;
}
