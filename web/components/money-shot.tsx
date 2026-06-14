"use client";

import { useEffect, useState } from "react";
import { Zap, RotateCcw, ShieldCheck, Skull, Activity, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { useCountUp } from "@/lib/use-count-up";
import { HealthBar } from "@/components/health-bar";
import { groupInt, hfColor, usd2 } from "@/lib/format";
import { DEPLOYMENTS } from "@/lib/ward";

const COLLATERAL = 10; // TSLA, position illustrative
const TARGET_HF = 1.05; // position "limite" avant crash

function PositionCard({
  label,
  warded,
  hf,
  debt,
  debtBefore,
  buffer,
  collateralValue,
  crashed,
}: {
  label: string;
  warded: boolean;
  hf: number;
  debt: number;
  debtBefore: number;
  buffer: number;
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
        {COLLATERAL} TSLA · ≈ ${groupInt(collateralValue)} · dette {groupInt(debt)} USDG
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
            {warded ? `Buffer de ${groupInt(buffer)} USDG armé.` : "Aucune protection."}
          </div>
        )}
        {crashed && !warded && (
          <div className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/8 px-3.5 py-3">
            <Skull className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div>
              <div className="font-medium text-danger">Liquidée — collatéral saisi</div>
              <div className="text-sm text-muted-foreground">
                HF passé sous 1.00 · tu perds tes {COLLATERAL} TSLA.
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
                A remboursé {groupInt(buffer)} USDG depuis ton buffer · dette{" "}
                {groupInt(debtBefore)} → {groupInt(debt)}.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Journal({
  crashed,
  tx,
  normalPrice,
  crashPrice,
}: {
  crashed: boolean;
  tx: Record<string, string> | null;
  normalPrice: number;
  crashPrice: number;
}) {
  const link = (h: string) => `${DEPLOYMENTS.explorer}/tx/${h}`;
  const rows = [
    { tag: "updateAnswer", label: `feed TSLA ${usd2(normalPrice)} → ${usd2(crashPrice)}`, hash: tx?.updateAnswer },
    { tag: "poke()", label: "PriceHistory ← observation", hash: tx?.poke },
    { tag: "refresh()", label: "moteur Stylus recalcule le seuil", hash: tx?.refresh },
  ];
  return (
    <div className="rounded-lg border border-hairline bg-paper p-5">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-ward" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Journal Ward — transactions on-chain réelles
        </span>
      </div>
      {!crashed || !tx ? (
        <p className="font-mono text-xs text-muted-foreground">
          En attente — déclenche le krach pour exécuter les transactions on-chain.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div
              key={i}
              className="rise flex flex-wrap items-baseline gap-x-3 font-mono text-xs tnum"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <span className="w-[96px] shrink-0 font-medium text-ward">{r.tag}</span>
              <span className="text-foreground/80">{r.label}</span>
              {r.hash && (
                <a
                  href={link(r.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-ward"
                >
                  {r.hash.slice(0, 10)}…
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrashPanel({
  price,
  thresholdBps,
  crashed,
  busy,
  onToggle,
}: {
  price: number;
  thresholdBps: number;
  crashed: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const shownPrice = useCountUp(price, 700);
  return (
    <div className="flex flex-col items-start gap-5 rounded-lg border border-hairline bg-paper p-5 sm:flex-row sm:items-center">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Cours TSLA · on-chain
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-3xl font-semibold tnum">
            ${shownPrice.toFixed(2)}
          </span>
          {crashed && <span className="font-mono text-sm font-medium text-danger">−16 %</span>}
        </div>
      </div>

      <div className="sm:ml-2 sm:border-l sm:border-hairline sm:pl-6">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Seuil dynamique · Stylus
        </div>
        <div className="font-mono text-sm tnum text-foreground/80">
          {(thresholdBps / 100).toFixed(1)} %{" "}
          <span className="text-muted-foreground">· recalculé on-chain</span>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={busy}
        className={
          "group ml-auto inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium transition-all disabled:opacity-60 " +
          (crashed
            ? "border border-hairline bg-transparent text-foreground hover:bg-secondary"
            : "bg-foreground text-background hover:brightness-110 active:scale-[0.98]")
        }
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Transaction on-chain…
          </>
        ) : crashed ? (
          <>
            <RotateCcw className="h-4 w-4" /> Réinitialiser le prix
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

export function MoneyShot() {
  const { price, thresholdBps, refetchAll } = useWard();
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<Record<string, string> | null>(null);
  const [normalPrice, setNormalPrice] = useState(0);

  // prix de référence = vrai cours TSLA
  useEffect(() => {
    fetch("/api/crash")
      .then((r) => r.json())
      .then((j) => {
        if (j?.price) setNormalPrice(j.price);
      })
      .catch(() => {});
  }, []);

  const livePrice = price > 0 ? price : normalPrice || 406;
  const refPrice = normalPrice || livePrice;
  const crashPrice = refPrice * 0.84;
  const thr = thresholdBps > 0 ? thresholdBps / 10000 : 0.8;
  const crashed = refPrice > 0 && livePrice < refPrice * 0.92;

  const collateralValue = COLLATERAL * livePrice;
  const aDebt = Math.max(Math.round((COLLATERAL * refPrice * thr) / TARGET_HF), 1);
  const buffer = Math.round(aDebt * 0.35);
  const bDebt = crashed ? aDebt - buffer : aDebt;
  const hfA = (collateralValue * thr) / aDebt;
  const hfB = (collateralValue * thr) / bDebt;

  const onToggle = async () => {
    if (busy) return;
    setBusy(true);
    const action = crashed ? "reset" : "crash";
    try {
      const res = await fetch("/api/crash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "échec on-chain");
      if (j.normalPrice) setNormalPrice(j.normalPrice);
      setTx(action === "crash" ? j.tx : null);
      toast.success(action === "crash" ? "Crash exécuté on-chain" : "Prix réinitialisé", {
        description: "feed mis à jour · moteur Stylus rafraîchi",
      });
      refetchAll();
      window.setTimeout(refetchAll, 1500);
      window.setTimeout(refetchAll, 3500);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message || "échec on-chain");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <CrashPanel
        price={livePrice}
        thresholdBps={thresholdBps > 0 ? thresholdBps : 8000}
        crashed={crashed}
        busy={busy}
        onToggle={onToggle}
      />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <PositionCard label="Position A" warded={false} hf={hfA} debt={aDebt} debtBefore={aDebt} buffer={buffer} collateralValue={collateralValue} crashed={crashed} />
        <PositionCard label="Position B" warded hf={hfB} debt={bDebt} debtBefore={aDebt} buffer={buffer} collateralValue={collateralValue} crashed={crashed} />
      </div>
      <div className="mt-6">
        <Journal crashed={crashed} tx={tx} normalPrice={refPrice} crashPrice={crashPrice} />
      </div>
    </div>
  );
}
