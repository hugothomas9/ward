import { DEPLOYMENTS } from "@/lib/ward";

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <span className="font-serif text-base font-semibold tracking-tight text-foreground">
          Ward
        </span>
        <span className="hidden sm:inline">·</span>
        <span>Crédit anti-liquidation sur {DEPLOYMENTS.chainName}</span>
        <span className="font-mono tnum sm:ml-auto">
          chain {DEPLOYMENTS.chainId} · {DEPLOYMENTS.contracts.length} contrats
          live
        </span>
      </div>
    </footer>
  );
}
