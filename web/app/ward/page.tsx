"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import { Eye, AlertTriangle, RefreshCw, Lock, ShieldCheck } from "lucide-react";
import { useWard } from "@/components/ward-provider";
import { MoneyShot } from "@/components/money-shot";
import { Reveal } from "@/components/reveal";
import { Slider } from "@/components/ui/slider";
import { sendTx } from "@/lib/tx";
import { ADDR, USDG_DECIMALS } from "@/lib/contracts";
import { erc20Abi, wardVaultAbi } from "@/lib/abi";
import { LIQ_THRESHOLD } from "@/lib/ward";
import { usd2, groupInt, num1 } from "@/lib/format";

const STEPS = [
  { Icon: Eye, title: "Surveille", body: "Le bot lit ton health factor à chaque bloc, à partir du prix on-chain." },
  { Icon: AlertTriangle, title: "Déclenche", body: "Dès que le HF passe sous ton trigger, Ward agit — avant la liquidation." },
  { Icon: RefreshCw, title: "Restaure", body: "Il rembourse depuis ton buffer USDG jusqu'à remonter au-dessus de ton target." },
];

function PolicyEditor() {
  const { collateral, debt, buffer, triggerHF, targetHF, refetchAll } = useWard();
  const [add, setAdd] = useState(0);
  const [trigger, setTrigger] = useState(1.2);
  const [target, setTarget] = useState(1.5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (triggerHF > 0) setTrigger(triggerHF);
    if (targetHF > 0) setTarget(Math.max(targetHF, triggerHF));
  }, [triggerHF, targetHF]);

  const totalBuffer = buffer + add;
  const protectedPrice =
    collateral > 0
      ? Math.max(debt - totalBuffer, 0) / (collateral * LIQ_THRESHOLD)
      : 0;

  const fund = async () => {
    if (add <= 0 || busy) return;
    setBusy(true);
    try {
      const amt = parseUnits(String(add), USDG_DECIMALS);
      await sendTx(
        { address: ADDR.usdg, abi: erc20Abi, functionName: "approve", args: [ADDR.wardVault, amt] },
        { pending: "Approbation de l'USDG…", success: "USDG approuvé" },
      );
      await sendTx(
        { address: ADDR.wardVault, abi: wardVaultAbi, functionName: "fund", args: [amt] },
        { pending: "Alimentation du buffer…", success: "Buffer alimenté" },
      );
      refetchAll();
      setAdd(0);
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const tw = parseUnits(trigger.toFixed(2), 18);
      const gw = parseUnits(Math.max(target, trigger).toFixed(2), 18);
      await sendTx(
        {
          address: ADDR.wardVault,
          abi: wardVaultAbi,
          functionName: "setPolicy",
          args: [tw, gw, ADDR.deployer],
        },
        { pending: "Enregistrement de la policy…", success: "Policy Ward enregistrée" },
      );
      refetchAll();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-paper p-6">
      <div className="grid gap-7 md:grid-cols-2">
        <div className="space-y-7">
          {/* buffer */}
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">
                Alimenter le buffer{" "}
                <span className="text-muted-foreground">
                  (actuel {groupInt(buffer)} USDG)
                </span>
              </label>
              <span className="font-mono text-sm tnum">+{groupInt(add)} USDG</span>
            </div>
            <Slider
              className="mt-3"
              value={[add]}
              min={0}
              max={Math.max(Math.round(debt) || 1000, 100)}
              step={50}
              onValueChange={(v) => setAdd(num1(v))}
            />
            <button
              onClick={fund}
              disabled={add <= 0 || busy}
              className="mt-3 w-full rounded-md border border-hairline py-2.5 text-sm font-medium transition-colors hover:border-ward/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Alimenter (+{groupInt(add)} USDG)
            </button>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">Trigger HF</label>
              <span className="font-mono text-sm tnum text-warn">{trigger.toFixed(2)}</span>
            </div>
            <Slider className="mt-3" value={[trigger]} min={1.0} max={1.6} step={0.05} onValueChange={(v) => setTrigger(num1(v))} />
            <div className="mt-1.5 text-[11px] text-muted-foreground">Ward agit sous ce seuil.</div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">Target HF</label>
              <span className="font-mono text-sm tnum text-ward">{Math.max(target, trigger).toFixed(2)}</span>
            </div>
            <Slider className="mt-3" value={[Math.max(target, trigger)]} min={1.1} max={2.0} step={0.05} onValueChange={(v) => setTarget(num1(v))} />
            <div className="mt-1.5 text-[11px] text-muted-foreground">Niveau de santé restauré après intervention.</div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-hairline bg-background p-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Avec cette policy
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              Ward protège ce crédit jusqu&apos;à un prix TSLA de{" "}
              <span className="font-mono font-semibold text-ward tnum">{usd2(protectedPrice)}</span>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              En dessous, le buffer ne suffit plus — réalimente-le.
            </p>
          </div>
          <button
            onClick={save}
            disabled={busy}
            className="mt-6 w-full rounded-md bg-foreground py-3 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
          >
            Enregistrer la policy
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WardPage() {
  const { connected, hasPosition } = useWard();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Ward · l&apos;autopilote anti-liquidation
        </p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Deux crédits identiques. Un krach. Un seul survit.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Même collatéral, même dette. À gauche, sans protection. À droite,
          l&apos;autopilote veille. Déclenche le krach et regarde lequel passe la
          liquidation.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-8">
          <MoneyShot />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <h2 className="mt-16 font-serif text-2xl font-semibold tracking-tight">
          Comment Ward te protège
        </h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-hairline bg-paper p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ward/10 text-ward">
                  <s.Icon className="h-5 w-5" />
                </span>
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
              Le bot n&apos;a accès qu&apos;à <code className="font-mono">protect()</code> :
              rembourser ta dette depuis ton buffer. Il ne peut jamais ré-emprunter,
              swapper, ni ouvrir de position. Invariant vérifié par tests on-chain.
            </p>
          </div>
        </div>
      </Reveal>

      {connected && (
        <Reveal delay={0.05}>
          <h2 className="mt-16 flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-ward" /> Règle Ward sur ta position
          </h2>
          {hasPosition ? (
            <div className="mt-5">
              <PolicyEditor />
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-hairline bg-paper/50 px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Ouvre d&apos;abord un crédit pour pouvoir armer Ward dessus.
              </p>
              <Link
                href="/trading"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:brightness-110"
              >
                Ouvrir un crédit
              </Link>
            </div>
          )}
        </Reveal>
      )}
    </div>
  );
}
