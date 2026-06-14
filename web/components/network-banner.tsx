"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { AlertTriangle, Loader2 } from "lucide-react";
import { robinhoodTestnet } from "@/lib/chain";

/** Warns if the wallet is not on Robinhood Chain and offers to switch to it
 *  (MetaMask adds the network automatically if it is missing). */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === robinhoodTestnet.id) return null;

  return (
    <div className="relative z-30 border-b border-warn/30 bg-warn/10">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2.5 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warn" />
        <span className="flex-1 text-foreground/80">
          Wrong network — Ward runs on{" "}
          <b className="text-foreground">Robinhood Chain (46630)</b>.
        </span>
        <button
          onClick={() => switchChain({ chainId: robinhoodTestnet.id })}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Switch to Robinhood Chain
        </button>
      </div>
    </div>
  );
}
