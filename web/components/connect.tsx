"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { shortAddr } from "@/lib/format";

type Kind = "metamask" | "robinhood";

type WalletDef = {
  kind: Kind;
  name: string;
  desc: string;
  recommended?: boolean;
  img?: string; // logo couleur (rendu tel quel)
  mask?: string; // logo mono (recoloré)
  color?: string;
  method: "qr" | "extension";
};

const WALLETS: WalletDef[] = [
  {
    kind: "robinhood",
    name: "Robinhood Wallet",
    desc: "Natif sur Robinhood Chain · app mobile",
    recommended: true,
    mask: "/wallets/robinhood.svg",
    color: "#00C805",
    method: "qr",
  },
  {
    kind: "metamask",
    name: "MetaMask",
    desc: "Extension navigateur",
    img: "/wallets/metamask.svg",
    method: "extension",
  },
];

// URI de démo type WalletConnect (le câblage viem réel viendra ensuite)
const WC_URI =
  "wc:ward-demo-7f3a9c2e1b@2?relay-protocol=irn&symKey=warddemosessionkey";

function WalletLogo({ w, size = 7 }: { w: WalletDef; size?: number }) {
  const cls = size === 7 ? "h-7 w-7" : "h-10 w-10";
  if (w.img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={w.img} alt="" className={`${cls} object-contain`} />;
  }
  return (
    <span
      aria-hidden
      className={cls}
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
  const [selected, setSelected] = useState<WalletDef | null>(null);

  const finish = useCallback(
    (w: WalletDef) => {
      connect(w.kind);
      toast.success(`${w.name} connecté`, {
        description: "Réseau : Robinhood Chain · testnet (46630)",
      });
      onClose();
    },
    [connect, onClose],
  );

  // attente d'approbation : simule l'approbation côté wallet après quelques secondes
  useEffect(() => {
    if (!selected) return;
    const w = selected;
    const id = window.setTimeout(() => finish(w), 4000);
    return () => window.clearTimeout(id);
  }, [selected, finish]);

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

        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight">
                Connecte ton wallet
              </h2>
              <div className="mt-5 space-y-2.5">
                {WALLETS.map((w, i) => (
                  <motion.button
                    key={w.kind}
                    onClick={() => setSelected(w)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className="group flex w-full items-center gap-3.5 rounded-xl border border-hairline bg-background p-3 text-left transition-all hover:border-ward/50 hover:bg-secondary/40"
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
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="connecting"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
            >
              <button
                onClick={() => setSelected(null)}
                className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Retour
              </button>

              {selected.method === "qr" ? (
                <div className="mt-3 flex flex-col items-center text-center">
                  <h2 className="font-serif text-xl font-semibold tracking-tight">
                    Scanne avec {selected.name}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ouvre l&apos;app, scanne le code et approuve la connexion.
                  </p>
                  <div className="relative mt-4 rounded-xl border border-hairline bg-paper p-4">
                    <QRCodeSVG
                      value={WC_URI}
                      size={168}
                      bgColor="transparent"
                      fgColor="#1c1814"
                      level="M"
                    />
                    <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-paper">
                      <WalletLogo w={selected} />
                    </span>
                  </div>
                  <a
                    href={WC_URI}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-hairline bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-ward/50"
                  >
                    <Smartphone className="h-4 w-4 text-ward" />
                    Ouvrir l&apos;app sur ce téléphone
                  </a>
                </div>
              ) : (
                <div className="mt-3 flex flex-col items-center text-center">
                  <span className="mt-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-hairline bg-background">
                    <WalletLogo w={selected} size={10} />
                  </span>
                  <h2 className="mt-4 font-serif text-xl font-semibold tracking-tight">
                    Ouvre {selected.name}
                  </h2>
                  <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
                    Confirme la connexion dans la fenêtre de l&apos;extension
                    MetaMask.
                  </p>
                </div>
              )}

              {/* attente d'approbation */}
              <div className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-secondary/50 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-ward" />
                En attente d&apos;approbation…
              </div>

              <button
                onClick={() => finish(selected)}
                className="mt-3 w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98]"
              >
                J&apos;ai approuvé dans mon wallet
              </button>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Démo — connexion simulée (le câblage on-chain arrive)
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
