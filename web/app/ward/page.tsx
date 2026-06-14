"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import {
  Lock,
  ShieldCheck,
  ShieldOff,
  Wallet,
  Zap,
  RotateCcw,
  Loader2,
  Activity,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { ConnectButton } from "@/components/connect";
import { Reveal } from "@/components/reveal";
import { HealthBar } from "@/components/health-bar";
import { Slider } from "@/components/ui/slider";
import { sendTx } from "@/lib/tx";
import { ADDR, USDG_DECIMALS } from "@/lib/contracts";
import { erc20Abi, wardVaultAbi } from "@/lib/abi";
import { LIQ_THRESHOLD } from "@/lib/ward";
import { usd2, groupInt, num1, hfColor, hfLabel } from "@/lib/format";

/* ---------- position réelle ---------- */
function PositionPanel() {
  const { collateral, debt, healthFactor, price, buffer, policyActive } = useWard();
  const thr = LIQ_THRESHOLD;
  const liqPrice = collateral > 0 && debt > 0 ? debt / (collateral * thr) : 0;
  const protectedPrice =
    collateral > 0 && policyActive
      ? Math.max(debt - buffer, 0) / (collateral * thr)
      : liqPrice;

  return (
    <div className="rounded-xl border border-hairline bg-paper p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold tracking-tight">Ta position</h2>
        {policyActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ward/10 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ward">
            <ShieldCheck className="h-3.5 w-3.5" /> Ward armé
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <ShieldOff className="h-3.5 w-3.5" /> Ward inactif
          </span>
        )}
      </div>

      <div className="mt-5 flex items-end gap-6">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Health factor
          </div>
          <div
            className="font-serif text-6xl font-semibold leading-none tnum transition-colors"
            style={{ color: hfColor(healthFactor) }}
          >
            {healthFactor === Infinity ? "∞" : healthFactor.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{hfLabel(healthFactor)}</div>
        </div>
      </div>

      <div className="mt-5 max-w-md">
        <HealthBar hf={healthFactor === Infinity ? 1.6 : healthFactor} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-hairline pt-5 text-sm sm:grid-cols-4">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Collatéral</dt>
          <dd className="mt-1 font-medium tnum">{collateral} TSLA</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Dette</dt>
          <dd className="mt-1 font-medium tnum">{groupInt(debt)} USDG</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Buffer Ward</dt>
          <dd className="mt-1 font-medium tnum">{groupInt(buffer)} USDG</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <TrendingDown className="h-3 w-3" /> {policyActive ? "Protégé jusqu'à" : "Liquidation"}
          </dt>
          <dd className="mt-1 font-medium tnum" style={{ color: policyActive ? "var(--ward)" : "var(--danger)" }}>
            {usd2(policyActive ? protectedPrice : liqPrice)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        Cours TSLA on-chain : {usd2(price)}
      </p>
    </div>
  );
}

/* ---------- armer / régler Ward ---------- */
function ArmWard() {
  const { debt, buffer, triggerHF, targetHF, usdgBalance, collateral, policyActive, refetchAll } = useWard();
  const [add, setAdd] = useState(0);
  const [trigger, setTrigger] = useState(1.2);
  const [target, setTarget] = useState(1.5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (triggerHF > 0) setTrigger(triggerHF);
    if (targetHF > 0) setTarget(Math.max(targetHF, triggerHF));
  }, [triggerHF, targetHF]);

  const protectedPrice =
    collateral > 0
      ? Math.max(debt - (buffer + add), 0) / (collateral * LIQ_THRESHOLD)
      : 0;
  const suggested = Math.max(Math.round(debt * 0.4), 0);

  const fund = async () => {
    if (add <= 0 || busy) return;
    setBusy(true);
    try {
      const amt = parseUnits(String(add), USDG_DECIMALS);
      await sendTx({ address: ADDR.usdg, abi: erc20Abi, functionName: "approve", args: [ADDR.wardVault, amt] }, { pending: "Approbation USDG…", success: "USDG approuvé" });
      await sendTx({ address: ADDR.wardVault, abi: wardVaultAbi, functionName: "fund", args: [amt] }, { pending: "Alimentation du buffer…", success: "Buffer alimenté" });
      refetchAll();
      setAdd(0);
    } catch {} finally { setBusy(false); }
  };

  const savePolicy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const tw = parseUnits(trigger.toFixed(2), 18);
      const gw = parseUnits(Math.max(target, trigger).toFixed(2), 18);
      await sendTx({ address: ADDR.wardVault, abi: wardVaultAbi, functionName: "setPolicy", args: [tw, gw, ADDR.deployer] }, { pending: "Activation de Ward…", success: "Ward activé sur ta position" });
      refetchAll();
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-hairline bg-paper p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-ward" />
        <h2 className="font-serif text-xl font-semibold tracking-tight">
          {policyActive ? "Régler Ward" : "Activer Ward"}
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        1. Alimente ton buffer en USDG. 2. Choisis tes seuils et active. Le keeper
        protégera ta position si le HF passe sous le trigger.
      </p>

      {policyActive && buffer === 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-warn/40 bg-warn/10 px-3.5 py-3 text-sm">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <span className="text-foreground/80">
            Ward est armé <b>mais ton buffer est vide</b> — il ne pourra rien
            rembourser. Alimente-le ci-dessous pour qu&apos;il soit opérationnel.
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-7 md:grid-cols-2">
        <div className="space-y-7">
          {/* buffer */}
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">
                Alimenter le buffer <span className="text-muted-foreground">(actuel {groupInt(buffer)})</span>
              </label>
              <span className="font-mono text-sm tnum">+{groupInt(add)} USDG</span>
            </div>
            <Slider className="mt-3" value={[add]} min={0} max={Math.max(Math.round(usdgBalance), suggested, 100)} step={50} onValueChange={(v) => setAdd(num1(v))} />
            <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>Ton USDG : {groupInt(usdgBalance)}</span>
              <button onClick={() => setAdd(Math.min(suggested, Math.round(usdgBalance)))} className="text-ward hover:underline">
                suggéré {groupInt(suggested)}
              </button>
            </div>
            <button onClick={fund} disabled={add <= 0 || busy} className="mt-3 w-full rounded-md border border-hairline py-2.5 text-sm font-medium transition-colors hover:border-ward/50 disabled:opacity-40">
              Alimenter (+{groupInt(add)} USDG)
            </button>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">Trigger HF</label>
              <span className="font-mono text-sm tnum text-warn">{trigger.toFixed(2)}</span>
            </div>
            <Slider className="mt-3" value={[trigger]} min={1.0} max={2.5} step={0.05} onValueChange={(v) => setTrigger(num1(v))} />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">Target HF</label>
              <span className="font-mono text-sm tnum text-ward">{Math.max(target, trigger).toFixed(2)}</span>
            </div>
            <Slider className="mt-3" value={[Math.max(target, trigger)]} min={1.1} max={3.0} step={0.05} onValueChange={(v) => setTarget(num1(v))} />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-hairline bg-background p-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Avec cette policy</div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              Ward protège ta position jusqu&apos;à un prix TSLA de{" "}
              <span className="font-mono font-semibold text-ward tnum">{usd2(protectedPrice)}</span>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">En dessous, le buffer ne suffit plus — réalimente-le.</p>
          </div>
          <button onClick={savePolicy} disabled={busy} className="mt-6 w-full rounded-md bg-foreground py-3 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40">
            {policyActive ? "Mettre à jour la policy" : "Activer Ward"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- contrôle de prix (opérateur) + keeper ---------- */
function OperatorPanel() {
  const { price, policyActive, address, refetchAll } = useWard();
  const [busy, setBusy] = useState(false);
  const [normal, setNormal] = useState(0);
  const [keeper, setKeeper] = useState<string | null>(null);
  const polling = useRef(false);

  useEffect(() => {
    fetch("/api/crash").then((r) => r.json()).then((j) => j?.price && setNormal(j.price)).catch(() => {});
  }, []);

  const ref = normal || price || 406;
  const crashed = ref > 0 && price > 0 && price < ref * 0.92;

  // keeper : surveille la position et protège si HF < trigger
  useEffect(() => {
    if (!policyActive || !address) {
      setKeeper(null);
      return;
    }
    let stop = false;
    const tick = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const res = await fetch("/api/ward-tick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user: address }) });
        const j = await res.json();
        if (stop) return;
        if (j.status === "protected") {
          setKeeper(`Ward a protégé : HF ${Number(j.hfBefore).toFixed(2)} → ${Number(j.hfAfter).toFixed(2)}`);
          toast.success("Ward a protégé ta position", { description: `HF ${Number(j.hfBefore).toFixed(2)} → ${Number(j.hfAfter).toFixed(2)}` });
          refetchAll();
        } else if (j.status === "cannot_protect") {
          setKeeper("Buffer insuffisant — réalimente le buffer");
        } else if (j.status === "healthy") {
          setKeeper("surveille ta position");
        }
      } catch {} finally { polling.current = false; }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(id); };
  }, [policyActive, address, refetchAll]);

  const move = async (action: "crash" | "reset") => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/crash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "échec");
      if (j.normalPrice) setNormal(j.normalPrice);
      toast.success(action === "crash" ? "Prix baissé on-chain (−16%)" : "Prix réinitialisé au cours réel");
      refetchAll();
      window.setTimeout(refetchAll, 1500);
    } catch (e: unknown) {
      toast.error((e as { message?: string }).message || "échec");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-hairline bg-paper p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Contrôle du prix · opérateur
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold tnum">{usd2(price)}</span>
            {crashed && <span className="font-mono text-xs font-medium text-danger">−16 %</span>}
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => move("crash")} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Baisser −16 %
          </button>
          <button onClick={() => move("reset")} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-hairline px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60">
            <RotateCcw className="h-4 w-4" /> Cours réel
          </button>
        </div>
      </div>

      {policyActive && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-ward/8 px-4 py-2.5 text-sm text-ward">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ward opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ward" />
          </span>
          <Activity className="h-3.5 w-3.5" />
          Keeper Ward actif — {keeper ?? "surveille ta position"}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { Icon: Wallet, title: "Surveille", body: "Le keeper lit ton health factor en continu, à partir du prix on-chain." },
  { Icon: TrendingDown, title: "Déclenche", body: "Dès que le HF passe sous ton trigger, Ward agit — avant la liquidation." },
  { Icon: ShieldCheck, title: "Restaure", body: "Il rembourse depuis ton buffer USDG jusqu'à te ramener au-dessus du seuil." },
];

export default function WardPage() {
  const { connected, hasPosition } = useWard();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Ward · l&apos;autopilote anti-liquidation
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Arme Ward sur ta position.
        </h1>
      </Reveal>

      {!connected ? (
        <div className="mt-10 flex flex-col items-center gap-5 rounded-xl border border-hairline bg-paper py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ward/10 text-ward"><Wallet className="h-6 w-6" /></div>
          <p className="max-w-xs text-sm text-muted-foreground">Connecte ton wallet pour gérer Ward sur ta position.</p>
          <ConnectButton big />
        </div>
      ) : !hasPosition ? (
        <div className="mt-10 rounded-xl border border-dashed border-hairline bg-paper/50 px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Ouvre d&apos;abord un crédit pour pouvoir armer Ward dessus.</p>
          <Link href="/trading" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:brightness-110">Ouvrir un crédit</Link>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <Reveal><PositionPanel /></Reveal>
          <Reveal delay={0.05}><OperatorPanel /></Reveal>
          <Reveal delay={0.1}><ArmWard /></Reveal>
        </div>
      )}

      {/* pédagogie */}
      <Reveal delay={0.05}>
        <h2 className="mt-16 font-serif text-2xl font-semibold tracking-tight">Comment Ward te protège</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-hairline bg-paper p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ward/10 text-ward"><s.Icon className="h-5 w-5" /></span>
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-serif text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-ward/30 bg-ward/8 p-6">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-ward" />
          <div>
            <h3 className="font-medium">Dé-risquant par construction</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Le keeper n&apos;a accès qu&apos;à <code className="font-mono">protect()</code> : rembourser ta dette depuis ton buffer. Jamais ré-emprunter, swapper, ni ouvrir de position. Invariant vérifié on-chain.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
