"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, Loader2, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { shortAddr } from "@/lib/format";

type Kind = "metamask" | "robinhood" | "walletconnect";

type WalletDef = {
  kind: Kind;
  name: string;
  desc: string;
  recommended?: boolean;
  img?: string; // logo couleur (rendu tel quel)
  mask?: string; // logo mono (recoloré)
  color?: string;
};

const WALLETS: WalletDef[] = [
  {
    kind: "robinhood",
    name: "Robinhood Wallet",
    desc: "Natif sur Robinhood Chain · via WalletConnect",
    recommended: true,
    mask: "/wallets/robinhood.svg",
    color: "#00C805",
  },
  {
    kind: "metamask",
    name: "MetaMask",
    desc: "Extension navigateur",
    img: "/wallets/metamask.svg",
  },
];

function WalletLogo({ w }: { w: WalletDef }) {
  if (w.img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={w.img} alt="" className="h-7 w-7 object-contain" />;
  }
  return (
    <span
      aria-hidden
      className="h-7 w-7"
      style={{
        backgroundColor: w.color,
        maskImage: `url(${w.mask})`,
        WebkitMaskImage: `url(${w.mask})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        display: "block",
      }}
    />
  );
}

function WalletModal({ onClose }: { onClose: () => void }) {
  const { connect } = useWard();
  const [pending, setPending] = useState<Kind | null>(null);

  const choose = (w: WalletDef) => {
    setPending(w.kind);
    // simulation du handshake wallet (câblage viem réel à venir)
    window.setTimeout(() => {
      connect(w.kind);
      toast.success(`${w.name} connecté`, {
        description: "Réseau : Robinhood Chain · testnet (46630)",
      });
      onClose();
    }, 950);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-paper p-6 shadow-2xl"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* header */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ward opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ward" />
          </span>
          Robinhood Chain · testnet
        </span>
        <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight">
          Connecte ton wallet
        </h2>

        {/* liste */}
        <div className="mt-5 space-y-2.5">
          {WALLETS.map((w, i) => {
            const isPending = pending === w.kind;
            const dimmed = pending !== null && !isPending;
            return (
              <motion.button
                key={w.kind}
                disabled={pending !== null}
                onClick={() => choose(w)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: dimmed ? 0.4 : 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className="group flex w-full items-center gap-3.5 rounded-xl border border-hairline bg-background p-3 text-left transition-all hover:border-ward/50 hover:bg-secondary/40 disabled:cursor-not-allowed"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-hairline bg-paper">
                  <WalletLogo w={w} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{w.name}</span>
                    {w.recommended && (
                      <span className="rounded-full bg-ward/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-ward">
                        Recommandé
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {w.desc}
                  </span>
                </span>
                {isPending ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ward" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ConnectButton({ big = false }: { big?: boolean }) {
  const { connected, address } = useWard();
  const [open, setOpen] = useState(false);

  return (
    <>
      {connected ? (
        <a
          href="/profil"
          className="flex items-center gap-2 rounded-full border border-hairline bg-paper px-3.5 py-1.5 text-sm transition-colors hover:border-ward/50"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ward opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ward" />
          </span>
          <span className="font-mono text-xs text-muted-foreground tnum">
            {shortAddr(address)}
          </span>
        </a>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={
            "inline-flex items-center gap-2 rounded-full bg-foreground font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] " +
            (big ? "px-6 py-3 text-[15px]" : "px-4 py-2 text-sm")
          }
        >
          <Wallet className={big ? "h-4 w-4" : "h-3.5 w-3.5"} />
          Connecter le wallet
        </button>
      )}

      <AnimatePresence>
        {open && <WalletModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
