"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { Copy, Check, RefreshCw, ExternalLink, Droplets } from "lucide-react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { sendTx } from "@/lib/tx";
import { FAUCETS, ADDR, USDG_DECIMALS } from "@/lib/contracts";
import { erc20Abi } from "@/lib/abi";
import { shortAddr, groupInt } from "@/lib/format";

const MINT_AMOUNT = 5000;

function Bal({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-background p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-medium tnum">
        {value < 1 ? value.toFixed(4) : groupInt(value)}{" "}
        <span className="text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

export function FaucetPanel() {
  const { address, ethBalance, tslaBalance, usdgBalance, refetchAll } = useWard();
  const [copied, setCopied] = useState(false);
  const [spin, setSpin] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = () => {
    if (!address) return;
    navigator.clipboard?.writeText(address);
    setCopied(true);
    toast.success("Adresse copiée");
    window.setTimeout(() => setCopied(false), 1500);
  };

  const refresh = () => {
    setSpin(true);
    refetchAll();
    window.setTimeout(() => setSpin(false), 800);
  };

  const mintUsdg = async () => {
    if (!address || busy) return;
    setBusy(true);
    try {
      const amt = parseUnits(String(MINT_AMOUNT), USDG_DECIMALS);
      await sendTx(
        { address: ADDR.usdg, abi: erc20Abi, functionName: "mint", args: [address, amt] },
        { pending: `Mint de ${groupInt(MINT_AMOUNT)} USDG…`, success: `${groupInt(MINT_AMOUNT)} USDG reçus` },
      );
      refetchAll();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-paper p-6">
      <div className="flex items-center gap-2">
        <Droplets className="h-4 w-4 text-ward" />
        <h2 className="font-serif text-xl font-semibold tracking-tight">
          Faucet — crédite ton wallet de test
        </h2>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-hairline bg-background px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground tnum">
          {address ? shortAddr(address) : "—"}
        </span>
        <button
          onClick={copy}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Copier"
        >
          {copied ? <Check className="h-4 w-4 text-ward" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Soldes on-chain
        </span>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className={"h-3.5 w-3.5 " + (spin ? "animate-spin" : "")} />
          Rafraîchir
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <Bal label="Gas" value={ethBalance} unit="ETH" />
        <Bal label="Collatéral" value={tslaBalance} unit="TSLA" />
        <Bal label="Stable" value={usdgBalance} unit="USDG" />
      </div>

      <ol className="mt-5 space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ward/10 font-mono text-[11px] font-medium text-ward">1</span>
          <span className="flex-1">
            <a href={FAUCETS.gas} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ward hover:underline">
              Gas (ETH) + TSLA <ExternalLink className="h-3 w-3" />
            </a>
            <span className="block text-xs text-muted-foreground">
              Faucet officiel Robinhood Chain : 0.05 ETH + 5 TSLA / 24 h.
            </span>
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ward/10 font-mono text-[11px] font-medium text-ward">2</span>
          <span className="flex-1">
            <button
              onClick={mintUsdg}
              disabled={busy || !address}
              className="rounded-md bg-foreground px-3.5 py-1.5 text-xs font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? "Mint en cours…" : `Mint ${groupInt(MINT_AMOUNT)} USDG`}
            </button>
            <span className="mt-1 block text-xs text-muted-foreground">
              USDG de testnet, mintable directement ici (transaction réelle).
            </span>
          </span>
        </li>
      </ol>
    </div>
  );
}
