"use client";

import { useState } from "react";
import { Copy, Check, LogOut, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { ConnectButton } from "@/components/connect";
import { Reveal } from "@/components/reveal";
import { DEPLOYMENTS } from "@/lib/ward";
import { usd, shortAddr } from "@/lib/format";

const WALLET_NAMES: Record<string, string> = {
  metamask: "MetaMask",
  robinhood: "Robinhood Wallet",
  walletconnect: "WalletConnect",
};

export default function ProfilPage() {
  const { connected, address, wallet, cashUSDG, walletTSLA, price, disconnect } =
    useWard();
  const [copied, setCopied] = useState(false);

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 py-28 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ward/10 text-ward">
          <Wallet className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Aucun wallet connecté
        </h1>
        <p className="text-sm text-muted-foreground">
          Connecte-toi pour voir ton profil, tes soldes et le réseau.
        </p>
        <ConnectButton big />
      </div>
    );
  }

  const copy = () => {
    navigator.clipboard?.writeText(address);
    setCopied(true);
    toast.success("Adresse copiée");
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Reveal>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Profil</h1>
      </Reveal>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {/* wallet */}
        <Reveal>
          <div className="rounded-xl border border-hairline bg-paper p-6">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 140deg, #1c6b4f, #b8791f, #a8331f, #1c6b4f)",
                }}
              />
              <div>
                <div className="font-mono text-sm font-medium tnum">
                  {shortAddr(address)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {wallet ? WALLET_NAMES[wallet] : "Wallet"}
                </div>
              </div>
              <button
                onClick={copy}
                className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Copier l'adresse"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-ward" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-lg border border-hairline bg-background px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ward opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ward" />
                </span>
                <span className="text-sm font-medium">
                  {DEPLOYMENTS.chainName}
                </span>
              </div>
              <span className="font-mono text-xs text-muted-foreground tnum">
                chain {DEPLOYMENTS.chainId}
              </span>
            </div>

            <button
              onClick={() => {
                disconnect();
                toast("Wallet déconnecté");
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-hairline py-2.5 text-sm font-medium text-foreground transition-colors hover:border-danger/40 hover:text-danger"
            >
              <LogOut className="h-4 w-4" /> Déconnecter
            </button>
          </div>
        </Reveal>

        {/* soldes */}
        <Reveal delay={0.08}>
          <div className="rounded-xl border border-hairline bg-paper p-6">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Soldes disponibles
            </div>
            <dl className="mt-4 space-y-4">
              <div className="flex items-center justify-between border-b border-hairline pb-4">
                <dt className="text-sm text-muted-foreground">USDG (cash)</dt>
                <dd className="font-mono text-lg font-medium tnum">
                  {usd(cashUSDG)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">TSLA (wallet)</dt>
                <dd className="font-mono text-lg font-medium tnum">
                  {walletTSLA} TSLA
                  <span className="ml-2 text-xs text-muted-foreground">
                    ≈ {usd(walletTSLA * price)}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>
      </div>

      {/* contrats live */}
      <Reveal delay={0.12}>
        <div className="mt-5 rounded-xl border border-hairline bg-paper p-6">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Contrats déployés · {DEPLOYMENTS.chainName}
            </div>
            <a
              href={DEPLOYMENTS.explorer}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-ward hover:underline"
            >
              Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-4 divide-y divide-hairline">
            {DEPLOYMENTS.contracts.map((c) => (
              <a
                key={c.addr}
                href={`${DEPLOYMENTS.explorer}/address/${c.addr}`}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between py-2.5 text-sm"
              >
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground tnum group-hover:text-foreground">
                  {shortAddr(c.addr)}
                  <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
