import { hfColor } from "@/lib/format";

/** Barre de health factor avec repère du seuil de liquidation (1.00). */
export function HealthBar({
  hf,
  max = 1.6,
  showMark = true,
  className = "",
}: {
  hf: number;
  max?: number;
  showMark?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(hf / max, 1)) * 100;
  const threshPct = (1 / max) * 100;
  return (
    <div className={"relative w-full " + className}>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
          style={{ width: `${pct}%`, background: hfColor(hf) }}
        />
      </div>
      {showMark && (
        <div
          className="absolute -top-1 -bottom-1 w-px bg-foreground/55"
          style={{ left: `${threshPct}%` }}
        />
      )}
    </div>
  );
}
