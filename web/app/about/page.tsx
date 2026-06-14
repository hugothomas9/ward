import Link from "next/link";
import {
  Cpu,
  ShieldCheck,
  Lock,
  ArrowRight,
  TrendingDown,
  Activity,
} from "lucide-react";
import { Reveal } from "@/components/reveal";

export const metadata = {
  title: "About — Ward",
  description:
    "How Ward works: stock-backed credit with an anti-liquidation autopilot and a volatility-aware risk engine in Stylus, on Robinhood Chain.",
};

const PILLARS = [
  {
    Icon: Cpu,
    title: "A volatility-aware risk engine, in Stylus",
    body: "The engine reads realized volatility from on-chain price history and derives a liquidation threshold that tightens when markets turn violent and relaxes when they calm — rate-limited, so it never over-reacts. That's heavy fixed-point math; in Rust/WASM via Stylus it runs cheap enough to apply to every position, verifiably on-chain.",
  },
  {
    Icon: ShieldCheck,
    title: "An autonomous anti-liquidation agent",
    body: "A keeper watches your health factor every block. The moment it dips below your trigger, it repays just enough debt from your own buffer to pull you back to safety — before liquidation can ever happen.",
  },
];

const ROADMAP = [
  ["Fixed-rate dated loans", "Lock a rate for a term (FixedRateMarket — already prototyped)."],
  ["Always-on keeper", "A 24/7 autonomous keeper, independent of the open tab."],
  ["Multi-collateral risk", "Portfolio-level VaR across several tokenized stocks."],
  ["Lender yield side", "Shares + interest for liquidity providers."],
  ["Mainnet", "Real USDG, Robinhood Wallet, and production Robinhood Chain."],
];

function Section({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <section className="mt-12">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">{title}</h2>
        <div className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      </section>
    </Reveal>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* hero */}
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          About · Robinhood Chain
        </p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Stock-backed credit that won&apos;t liquidate you.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Ward lets you borrow against tokenized stocks — and an autopilot keeps
          your loan alive through crashes, automatically.
        </p>
      </Reveal>

      {/* problem */}
      <Section title="The problem" delay={0.04}>
        <p>
          Borrow against a volatile asset and one bad day can wipe you out. A 16%
          drop in TSLA can push a healthy loan below its liquidation line in
          minutes — and you lose your collateral at the worst possible price. Most
          lending protocols simply liquidate you and move on.
        </p>
      </Section>

      {/* how it works */}
      <Section title="How Ward works" delay={0.04}>
        <p>
          You deposit a tokenized stock (e.g. TSLA) as collateral and borrow USDG.
          You set aside a small USDG <span className="text-foreground">buffer</span>{" "}
          and pick two thresholds — a <span className="text-foreground">trigger</span>{" "}
          and a <span className="text-foreground">target</span>. Ward&apos;s keeper
          watches your health factor; if it dips below the trigger, it repays just
          enough debt from your buffer to bring you back above target — before
          liquidation. Your collateral stays intact, so you ride out the dip and
          keep the upside on the recovery.
        </p>
      </Section>

      {/* what's different */}
      <Reveal delay={0.04}>
        <h2 className="mt-12 font-serif text-2xl font-semibold tracking-tight">
          What makes Ward different
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          It&apos;s not just a lending market. Two things set it apart:
        </p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-xl border border-hairline bg-paper p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ward/10 text-ward">
                <p.Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-serif text-lg font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* security invariant */}
      <Reveal delay={0.04}>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-ward/30 bg-ward/8 p-6">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-ward" />
          <div>
            <h3 className="font-medium">An agent you don&apos;t have to trust</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The keeper&apos;s power is deliberately tiny. By design it can only call{" "}
              <code className="font-mono">protect()</code> — repay your debt from
              your own buffer. It can never re-borrow, swap, move funds, or open
              positions. That invariant is enforced by the contract and covered by
              on-chain tests.
            </p>
          </div>
        </div>
      </Reveal>

      {/* why stylus */}
      <Section title="Why Stylus" delay={0.04}>
        <p>
          The risk engine is compute-heavy: realized volatility, a dynamic
          threshold, fixed-point throughout. Written in Rust and compiled to WASM
          with Arbitrum Stylus, it runs far cheaper than the same logic in
          Solidity — cheap enough to apply on every refresh, verifiably on-chain.
          It&apos;s a live contract: you can watch its threshold move on the
          explorer when volatility spikes.
        </p>
      </Section>

      {/* why robinhood */}
      <Section title="Why Robinhood Chain" delay={0.04}>
        <p>
          Robinhood Chain is where tokenized stocks live and where a consumer
          audience already is. Stock-backed credit belongs right next to the
          stocks themselves — same chain, same assets (the real TSLA token as
          collateral), same users. Ward is built natively for it.
        </p>
      </Section>

      {/* roadmap */}
      <Reveal delay={0.04}>
        <h2 className="mt-12 font-serif text-2xl font-semibold tracking-tight">
          What&apos;s next
        </h2>
        <div className="mt-5 divide-y divide-hairline rounded-xl border border-hairline bg-paper px-6">
          {ROADMAP.map(([t, d]) => (
            <div key={t} className="flex items-baseline gap-4 py-4">
              <span className="font-medium">{t}</span>
              <span className="text-sm text-muted-foreground">{d}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-ward" />
          Live testnet build on Robinhood Chain (chain 46630). USDG is a mintable
          testnet token while the real USDG remains restricted on testnet.
        </p>
      </Reveal>

      {/* cta */}
      <Reveal delay={0.04}>
        <Link
          href="/ward"
          className="group mt-10 flex items-center gap-4 rounded-xl border border-hairline bg-foreground px-6 py-5 text-background transition-all hover:brightness-110"
        >
          <TrendingDown className="h-5 w-5 shrink-0 text-background/80" />
          <div className="flex-1">
            <div className="font-serif text-lg font-semibold">See Ward in action</div>
            <div className="text-sm text-background/70">
              Arm Ward, drop the price, and watch the autopilot save the position.
            </div>
          </div>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </div>
  );
}
