"use client";

import { useState } from "react";
import { Zap, RotateCcw, ShieldCheck, Skull, Activity } from "lucide-react";
import { useCountUp } from "@/lib/use-count-up";
import { HealthBar } from "@/components/health-bar";
import { groupInt, hfColor } from "@/lib/format";

/* ---------- carte position ---------- */

function PositionCard({
  label,
  warded,
  hf,
  debt,
  collateralValue,
  crashed,
}: {
  label: string;
  warded: boolean;
  hf: number;
  debt: number;
  collateralValue: number;
  crashed: boolean;
}) {
  const shownHf = useCountUp(hf);
  return (
    <div className="rounded-lg border border-hairline bg-paper p-6 shadow-[0_1px_0_rgba(28,24,20,0.04),0_12px_30px_-18px_rgba(28,24,20,0.25)]">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold tracking-tight">{label}</h3>
        {warded ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ward/10 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ward">
            <ShieldCheck className="h-3.5 w-3.5" /> Ward armé
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Sans Ward
          </span>
        )}
      </div>

      <p className="mt-1 font-mono text-xs text-muted-foreground tnum">
        10 TSLA · ≈ ${groupInt(collateralValue)} · dette {groupInt(debt)} USDG
      </p>

      <div className="mt-6 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        Health factor
      </div>
      <div
        className="font-serif text-6xl font-semibold leading-none tnum transition-colors"
        style={{ color: hfColor(shownHf) }}
      >
        {shownHf.toFixed(2)}
      </div>

      <div className="mt-7">
        <HealthBar hf={shownHf} />
      </div>

      <div className="mt-8">
        {!crashed && (
          <div className="rounded-md border border-warn/30 bg-warn/8 px-3.5 py-3 text-sm text-foreground/80">
            Santé limite — marge fine.{" "}
            {warded ? "Buffer de 600 USDG armé." : "Aucune protection."}
          </div>
        )}
        {crashed && !warded && (
          <div className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/8 px-3.5 py-3">
            <Skull className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div>
              <div className="font-medium text-danger">Liquidée — collatéral saisi</div>
              <div className="text-sm text-muted-foreground">
                HF passé sous 1.00 · tu perds tes 10 TSLA.
              </div>
            </div>
          </div>
        )}
        {crashed && warded && (
          <div className="flex items-start gap-2.5 rounded-md border border-ward/30 bg-ward/8 px-3.5 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ward" />
            <div>
              <div className="font-medium text-ward">Sauvée par Ward</div>
              <div className="text-sm text-muted-foreground">
                A remboursé 600 USDG depuis ton buffer · dette 1&nbsp;900 →
                1&nbsp;300.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- journal on-chain ---------- */

type LogLine = { t: string; tag: string; text: string; tone?: "ward" | "danger" };

const CRASH_LOG: LogLine[] = [
  { t: "14:32:01", tag: "oracle", text: "TSLA $250.00 → $210.00  (−16 %)" },
  { t: "14:32:01", tag: "poke()", text: "PriceHistory ← nouvelle observation" },
  { t: "14:32:01", tag: "refresh()", text: "vol ▲  ·  seuil dynamique 80.0 % → 79.4 %" },
  { t: "14:32:02", tag: "Ward", text: "HF position B < trigger 1.20  →  protect()", tone: "ward" },
  { t: "14:32:02", tag: "protect()", text: "repay 600 USDG  ·  dette 1 900 → 1 300  ·  HF 1.31 ✓", tone: "ward" },
  { t: "14:32:02", tag: "position A", text: "HF 0.88 < 1.00  →  liquidée par un tiers", tone: "danger" },
];

function Journal({ crashed }: { crashed: boolean }) {
  return (
    <div className="rounded-lg border border-hairline bg-paper p-5">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-ward" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Journal Ward — on-chain, en direct
        </span>
      </div>
      {!crashed ? (
        <p className="font-mono text-xs text-muted-foreground">
          En attente — déclenche le krach pour voir Ward agir on-chain.
        </p>
      ) : (
        <div className="space-y-1.5">
          {CRASH_LOG.map((l, i) => (
            <div
              key={i}
              className="rise flex flex-wrap items-baseline gap-x-3 font-mono text-xs tnum"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <span className="text-muted-foreground/70">{l.t}</span>
              <span
                className="w-[72px] shrink-0 font-medium"
                style={{
                  color:
                    l.tone === "ward"
                      ? "var(--ward)"
                      : l.tone === "danger"
                        ? "var(--danger)"
                        : "var(--foreground)",
                }}
              >
                {l.tag}
              </span>
              <span className="text-foreground/80">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- panneau krach ---------- */

function CrashPanel({
  price,
  crashed,
  onToggle,
}: {
  price: number;
  crashed: boolean;
  onToggle: () => void;
}) {
  const shownPrice = useCountUp(price, 700);
  return (
    <div className="flex flex-col items-start gap-5 rounded-lg border border-hairline bg-paper p-5 sm:flex-row sm:items-center">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Prix TSLA
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-3xl font-semibold tnum">
            ${shownPrice.toFixed(2)}
          </span>
          {crashed && (
            <span className="font-mono text-sm font-medium text-danger">−16 %</span>
          )}
        </div>
      </div>

      <div className="sm:ml-2 sm:border-l sm:border-hairline sm:pl-6">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Seuil dynamique
        </div>
        <div className="font-mono text-sm tnum">
          {crashed ? (
            <span>
              80.0 % <span className="text-muted-foreground">→</span>{" "}
              <span className="font-medium text-warn">79.4 %</span>{" "}
              <span className="text-muted-foreground">· vol ▲ (borné)</span>
            </span>
          ) : (
            <span className="text-foreground/80">80.0 % · stable</span>
          )}
        </div>
      </div>

      <button
        onClick={onToggle}
        className={
          "group ml-auto inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium transition-all " +
          (crashed
            ? "border border-hairline bg-transparent text-foreground hover:bg-secondary"
            : "bg-foreground text-background hover:brightness-110 active:scale-[0.98]")
        }
      >
        {crashed ? (
          <>
            <RotateCcw className="h-4 w-4" /> Rejouer
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 transition-transform group-hover:scale-110" />
            Crasher le prix −16 %
          </>
        )}
      </button>
    </div>
  );
}

/* ---------- écran ---------- */

export function MoneyShot() {
  const [crashed, setCrashed] = useState(false);

  const price = crashed ? 210 : 250;
  const collateralValue = 10 * price;
  const a = { hf: crashed ? 0.88 : 1.05, debt: 1900 };
  const b = { hf: crashed ? 1.31 : 1.05, debt: crashed ? 1300 : 1900 };

  return (
    <div>
      <CrashPanel
        price={price}
        crashed={crashed}
        onToggle={() => setCrashed((c) => !c)}
      />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <PositionCard
          label="Position A"
          warded={false}
          hf={a.hf}
          debt={a.debt}
          collateralValue={collateralValue}
          crashed={crashed}
        />
        <PositionCard
          label="Position B"
          warded
          hf={b.hf}
          debt={b.debt}
          collateralValue={collateralValue}
          crashed={crashed}
        />
      </div>
      <div className="mt-6">
        <Journal crashed={crashed} />
      </div>
    </div>
  );
}
