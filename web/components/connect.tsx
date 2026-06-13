"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, Feather, Radio, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { shortAddr } from "@/lib/format";

type Kind = "metamask" | "robinhood" | "walletconnect";

const WALLETS: {
  kind: Kind;
  name: string;
  desc: string;
  color: string;
  Icon: typeof Wallet;
}[] = [
  { kind: "robinhood", name: "Robinhood Wallet", desc: "Recommandé sur Robinhood Chain", color: "#00c805", Icon: Feather },
  { kind: "metamask", name: "MetaMask", desc: "Extension navigateur", color: "#f6851b", Icon: Wallet },
  { kind: "walletconnect", name: "WalletConnect", desc: "Scanner avec ton mobile", color: "#3b99fc", Icon: Radio },
];

function WalletModal({ onClose }: { onClose: () => void }) {
  const { connect } = useWard();
  const [pending, setPending] = useState<Kind | null>(null);

  const choose = (kind: Kind, name: string) => {
    setPending(kind);
    // simulation d'un handshake wallet (le câblage viem réel viendra ensuite)
    window.setTimeout(() => {
      connect(kind);
      toast.success(`${name} connecté`, {
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
        className="relative w-full max-w-sm overflow-hidden rounded-xl border border-hairline bg-paper p-6 shadow-2xl"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Connecter un wallet
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisis comment te connecter à Ward.
        </p>

        <div className="mt-5 space-y-2.5">
          {WALLETS.map((w, i) => {
            const isPending = pending === w.kind;
            const disabled = pending !== null && !isPending;
            return (
              <motion.button
                key={w.kind}
                disabled={pending !== null}
                onClick={() => choose(w.kind, w.name)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: disabled ? 0.4 : 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className="group flex w-full items-center gap-3 rounded-lg border border-hairline bg-background px-3.5 py-3 text-left transition-all hover:border-ward/50 hover:bg-secondary/50 disabled:cursor-not-allowed"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: w.color }}
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <w.Icon className="h-5 w-5" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{w.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {isPending ? "Connexion…" : w.desc}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Check className="h-3 w-3 text-ward" />
          Un seul connecteur EVM couvre MetaMask, Robinhood Wallet et WalletConnect.
        </p>
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
