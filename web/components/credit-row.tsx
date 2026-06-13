"use client";

import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { HealthBar } from "@/components/health-bar";
import { hfColor, hfLabel, groupInt } from "@/lib/format";
import type { Credit } from "@/lib/ward";

export function CreditRow({
  credit,
  hf,
  href = "/ward",
}: {
  credit: Credit;
  hf: number;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-5 rounded-lg border border-hairline bg-paper px-5 py-4 transition-all hover:border-ward/40 hover:shadow-[0_8px_24px_-16px_rgba(28,24,20,0.3)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">TSLA → USDG</span>
          {credit.warded ? (
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
          {credit.collateral} TSLA · dette {groupInt(credit.debt)} USDG
        </div>
        <div className="mt-2.5 max-w-[240px]">
          <HealthBar hf={hf} />
        </div>
      </div>

      <div className="text-right">
        <div
          className="font-serif text-2xl font-semibold leading-none tnum"
          style={{ color: hfColor(hf) }}
        >
          {hf === Infinity ? "∞" : hf.toFixed(2)}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{hfLabel(hf)}</div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
