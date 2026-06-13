"use client";

import { useEffect, useState } from "react";
import { Eye, AlertTriangle, RefreshCw, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { MoneyShot } from "@/components/money-shot";
import { Reveal } from "@/components/reveal";
import { Slider } from "@/components/ui/slider";
import { LIQ_THRESHOLD } from "@/lib/ward";
import { usd, usd2, groupInt, num1 } from "@/lib/format";

const STEPS = [
  {
    Icon: Eye,
    title: "Surveille",
    body: "Le bot lit ton health factor à chaque bloc, à partir du prix on-chain.",
  },
  {
    Icon: AlertTriangle,
    title: "Déclenche",
    body: "Dès que le HF passe sous ton trigger, Ward agit — avant la liquidation.",
  },
  {
    Icon: RefreshCw,
    title: "Restaure",
    body: "Il rembourse depuis ton buffer USDG jusqu'à remonter au-dessus de ton target.",
  },
];

function PolicyEditor() {
  const { credits, price, setPolicy } = useWard();
  const [selectedId, setSelectedId] = useState(credits[0]?.id ?? "");
  const selected = credits.find((c) => c.id === selectedId) ?? credits[0];

  const [buffer, setBuffer] = useState(selected?.buffer ?? 0);
  const [trigger, setTrigger] = useState(selected?.triggerHF ?? 1.2);
  const [target, setTarget] = useState(selected?.targetHF ?? 1.5);

  useEffect(() => {
    if (!selected) return;
    setBuffer(selected.buffer || Math.round(selected.debt * 0.3));
    setTrigger(selected.triggerHF);
    setTarget(Math.max(selected.targetHF, selected.triggerHF));
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selected) return null;

  const protectedPrice =
    selected.collateral > 0
      ? Math.max(selected.debt - buffer, 0) / (selected.collateral * LIQ_THRESHOLD)
      : 0;

  const save = () => {
    setPolicy(selected.id, {
      warded: true,
      buffer,
      triggerHF: trigger,
      targetHF: Math.max(target, trigger),
    });
    toast.success("Policy Ward enregistrée", {
      description: `Buffer ${groupInt(buffer)} USDG · trigger ${trigger.toFixed(2)} · target ${Math.max(target, trigger).toFixed(2)}`,
    });
  };

  return (
    <div className="rounded-xl border border-hairline bg-paper p-6">
      {/* sélecteur de crédit */}
      {credits.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {credits.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                (c.id === selected.id
                  ? "border-ward bg-ward/10 text-ward"
                  : "border-hairline text-muted-foreground hover:text-foreground")
              }
            >
              {c.collateral} TSLA · {groupInt(c.debt)} USDG
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-7 md:grid-cols-2">
        <div className="space-y-7">
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">Buffer USDG</label>
              <span className="font-mono text-sm tnum">{groupInt(buffer)} USDG</span>
            </div>
            <Slider
              className="mt-3"
              value={[buffer]}
              min={0}
              max={Math.max(selected.debt, 100)}
              step={50}
              onValueChange={(v) => setBuffer(num1(v))}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">Trigger HF</label>
              <span className="font-mono text-sm tnum text-warn">
                {trigger.toFixed(2)}
              </span>
            </div>
            <Slider
              className="mt-3"
              value={[trigger]}
              min={1.0}
              max={1.6}
              step={0.05}
              onValueChange={(v) => setTrigger(num1(v))}
            />
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              Ward agit sous ce seuil.
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">Target HF</label>
              <span className="font-mono text-sm tnum text-ward">
                {Math.max(target, trigger).toFixed(2)}
              </span>
            </div>
            <Slider
              className="mt-3"
              value={[Math.max(target, trigger)]}
              min={1.1}
              max={2.0}
              step={0.05}
              onValueChange={(v) => setTarget(num1(v))}
            />
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              Niveau de santé restauré après intervention.
            </div>
          </div>
        </div>

        {/* aperçu */}
        <div className="flex flex-col justify-between rounded-lg border border-hairline bg-background p-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Avec cette policy
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              Ward protège ce crédit jusqu&apos;à un prix TSLA de{" "}
              <span className="font-mono font-semibold text-ward tnum">
                {usd2(protectedPrice)}
              </span>{" "}
              <span className="text-muted-foreground">
                (vs {usd2(price)} aujourd&apos;hui).
              </span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              En dessous, le buffer ne suffit plus — il faudra le réalimenter.
            </p>
          </div>
          <button
            onClick={save}
            className="mt-6 w-full rounded-md bg-foreground py-3 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Enregistrer la policy
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WardPage() {
  const { connected } = useWard();

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

      {/* comment ça marche */}
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
                <span className="font-mono text-xs text-muted-foreground">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-serif text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* invariant sécurité */}
      <Reveal delay={0.05}>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-ward/30 bg-ward/8 p-6">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-ward" />
          <div>
            <h3 className="font-medium">Dé-risquant par construction</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Le bot n&apos;a accès qu&apos;à <code className="font-mono">protect()</code> :
              rembourser ta dette depuis ton buffer. Il ne peut jamais
              ré-emprunter, swapper, ni ouvrir de position. Invariant vérifié par
              tests on-chain.
            </p>
          </div>
        </div>
      </Reveal>

      {/* réglage policy */}
      {connected && (
        <Reveal delay={0.05}>
          <h2 className="mt-16 flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-ward" /> Règle Ward sur tes
            positions
          </h2>
          <div className="mt-5">
            <PolicyEditor />
          </div>
        </Reveal>
      )}
    </div>
  );
}
