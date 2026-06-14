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
  Activity,
} from "lucide-react";
import { useWard } from "@/components/ward-provider";
import { ConnectButton } from "@/components/connect";
import { Reveal } from "@/components/reveal";
import { HealthBar } from "@/components/health-bar";
import { useCountUp } from "@/lib/use-count-up";
import { usd, usd2, hfColor, hfLabel, groupInt } from "@/lib/format";

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: "Anti-liquidation autopilot",
    body: "Ward watches your positions and repays from your buffer before liquidation hits.",
  },
  {
    Icon: Cpu,
    title: "Risk engine in Stylus",
    body: "A volatility-aware liquidation threshold, computed on-chain in Rust (WASM).",
  },
  {
    Icon: Lock,
    title: "De-risking by design",
    body: "The bot can only reduce your debt. Never re-borrow, never trade. Invariant verified.",
  },
];

function Landing() {
  const { price, thresholdBps, poolLiquidity } = useWard();
  const rows = [
    ["TSLA price", price > 0 ? usd2(price) : "…"],
    ["Dynamic threshold · Stylus", thresholdBps > 0 ? `${(thresholdBps / 100).toFixed(1)} %` : "…"],
    ["Pool liquidity", poolLiquidity > 0 ? `${groupInt(poolLiquidity)} USDG` : "…"],
    ["Network", "Robinhood Chain · 46630"],
  ];

  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="grid items-center gap-10 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Robinhood Chain · on-chain credit
          </p>
          <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Borrow against your stocks.
            <span className="block text-ward">Without getting liquidated.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Ward is a credit line backed by tokenized stocks, with an autopilot
            that watches your financial health and pulls you out of crashes —
            automatically.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ConnectButton big />
            <Link href="/ward" className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              See Ward in action
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="rounded-2xl border border-hairline bg-paper p-6 shadow-[0_30px_60px_-40px_rgba(28,24,20,0.4)]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ward opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ward" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Live · on-chain
              </span>
            </div>
            <dl className="mt-4 divide-y divide-hairline">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-3">
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-sm font-medium tnum">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Activity className="h-3 w-3 text-ward" /> Read live from the deployed contracts.
            </div>
          </div>
        </Reveal>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={0.06 * i}>
            <div className="h-full rounded-xl border border-hairline bg-paper p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ward/10 text-ward">
                <f.Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-serif text-xl font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <Reveal delay={0.05}>
        <Link
          href="/about"
          className="group mb-20 mt-5 flex items-center gap-4 rounded-xl border border-hairline bg-paper px-6 py-5 transition-all hover:border-ward/40"
        >
          <div className="flex-1">
            <div className="font-serif text-lg font-semibold">
              New here? See how Ward works.
            </div>
            <div className="text-sm text-muted-foreground">
              The anti-liquidation autopilot, the Stylus risk engine, and why
              Robinhood Chain — in two minutes.
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </div>
  );
}

function Dashboard() {
  const { price, tslaBalance, usdgBalance, collateral, debt, healthFactor, hasPosition, buffer, policyActive } = useWard();
  const collateralValue = collateral * price;
  const netWorth = usdgBalance + tslaBalance * price + collateralValue - debt;
  const shownBalance = useCountUp(netWorth, 1000);
  const armed = policyActive && buffer > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Reveal>
        <div className="rounded-2xl border border-hairline bg-paper p-7">
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Net worth</div>
          <div className="mt-1 font-serif text-6xl font-semibold leading-none tnum">{usd2(shownBalance)}</div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ward/10 px-2.5 py-1 text-xs font-medium text-ward">
            <ShieldCheck className="h-3.5 w-3.5" />
            {armed ? "Covered by Ward" : "Protection inactive"}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Collateral", usd(collateralValue)],
            ["Debt", usd(debt)],
            ["Ward buffer", usd(buffer)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-hairline bg-paper p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="mt-1.5 text-xl font-semibold tnum">{v}</div>
            </div>
          ))}
          <div className="rounded-xl border border-hairline bg-paper p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Health factor</div>
            <div className="mt-1.5 text-xl font-semibold tnum" style={{ color: hfColor(healthFactor) }}>
              {hasPosition ? (healthFactor === Infinity ? "∞" : healthFactor.toFixed(2)) : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">{hasPosition ? hfLabel(healthFactor) : "no debt"}</div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">Your credit line</h2>
          <Link href="/trading" className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98]">
            <Plus className="h-4 w-4" /> {hasPosition ? "Manage" : "Open a credit line"}
          </Link>
        </div>

        {hasPosition ? (
          <Link href="/ward" className="group mt-4 flex items-center gap-5 rounded-lg border border-hairline bg-paper px-5 py-4 transition-all hover:border-ward/40">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">TSLA → USDG</span>
                {armed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ward/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ward"><ShieldCheck className="h-3 w-3" /> Ward</span>
                ) : (
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Without Ward</span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground tnum">{collateral} TSLA · debt {groupInt(debt)} USDG</div>
              <div className="mt-2.5 max-w-[240px]"><HealthBar hf={healthFactor === Infinity ? 1.6 : healthFactor} /></div>
            </div>
            <div className="text-right">
              <div className="font-serif text-2xl font-semibold leading-none tnum" style={{ color: hfColor(healthFactor) }}>
                {healthFactor === Infinity ? "∞" : healthFactor.toFixed(2)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{hfLabel(healthFactor)}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-hairline bg-paper/50 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">No credit line open. Deposit TSLA and borrow USDG to get started.</p>
            <Link href="/trading" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:brightness-110"><Plus className="h-4 w-4" /> Open a credit line</Link>
          </div>
        )}
      </Reveal>

      <Reveal delay={0.14}>
        <Link href="/ward" className="group mt-6 flex items-center gap-4 rounded-xl border border-hairline bg-foreground px-6 py-5 text-background transition-all hover:brightness-110">
          <Zap className="h-5 w-5 shrink-0 text-background/80" />
          <div className="flex-1">
            <div className="font-serif text-lg font-semibold">Arm Ward and test the anti-liquidation</div>
            <div className="text-sm text-background/70">Drop the price and watch the autopilot protect your position.</div>
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
