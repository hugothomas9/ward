"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  AlertTriangle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAccount, useConnect } from "wagmi";
import { toast } from "sonner";
import { useWard } from "@/components/ward-provider";
import { shortAddr } from "@/lib/format";

type Kind = "metamask" | "robinhood";

type WalletDef = {
  kind: Kind;
  name: string;
  desc: string;
  recommended?: boolean;
  img?: string;
  mask?: string;
  color?: string;
};

const WALLETS: WalletDef[] = [
  {
    kind: "robinhood",
    name: "Robinhood Wallet",
    desc: "Natif sur Robinhood Chain · app mobile",
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
  const { connectors, connect, status } = useConnect();
  const { isConnected } = useAccount();
  const [selected, setSelected] = useState<WalletDef | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setSiteUrl(window.location.origin);
  }, []);

  // ferme la modale dès que la connexion réelle aboutit
  useEffect(() => {
    if (isConnected) onClose();
  }, [isConnected, onClose]);

  const injectedAvailable =
    typeof window !== "undefined" &&
    typeof (window as { ethereum?: unknown }).ethereum !== "undefined";

  const pick = (w: WalletDef) => {
    setSelected(w);
    setErr(null);
    const injectedC =
      connectors.find((c) => c.id === "injected" || c.type === "injected") ??
      connectors[0];
    const wcC = connectors.find((c) => c.id === "walletConnect");

    if (injectedAvailable && injectedC) {
      connect(
        { connector: injectedC },
        {
          onSuccess: () => {
            toast.success(`${w.name} connecté`, {
              description: "Robinhood Chain · testnet (46630)",
            });
            onClose();
          },
          onError: (e) => setErr(e.message),
        },
      );
    } else if (w.kind === "robinhood" && wcC) {
      connect({ connector: wcC }, { onError: (e) => setErr(e.message) });
    } else if (w.kind === "metamask") {
      setErr("MetaMask introuvable — installe l'extension du navigateur.");
    }
    // robinhood sans injected ni WC -> on montre le QR "ouvre sur ton téléphone"
  };

  const showPhoneQR =
    selected?.kind === "robinhood" && !injectedAvailable;
  const pending = status === "pending";

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="fixed inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex min-h-full items-center justify-center p-4">
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
                      onClick={() => pick(w)}
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
                  onClick={() => {
                    setSelected(null);
                    setErr(null);
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Retour
                </button>

                {showPhoneQR ? (
                  <div className="mt-3 flex flex-col items-center text-center">
                    <h2 className="font-serif text-xl font-semibold tracking-tight">
                      Ouvre Ward sur ton téléphone
                    </h2>
                    <p className="mt-1 max-w-[17rem] text-xs text-muted-foreground">
                      Scanne ce code, ouvre le lien dans le navigateur de l&apos;app
                      Robinhood Wallet, puis connecte-toi.
                    </p>
                    <div className="mt-4 rounded-xl border border-hairline bg-paper p-4">
                      {siteUrl && (
                        <QRCodeSVG
                          value={siteUrl}
                          size={154}
                          bgColor="transparent"
                          fgColor="#1c1814"
                          level="M"
                        />
                      )}
                    </div>
                    <a
                      href={siteUrl}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-hairline bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-ward/50"
                    >
                      <Smartphone className="h-4 w-4 text-ward" />
                      {siteUrl.replace(/^https?:\/\//, "")}
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
                      Approuve la connexion dans {selected.name}.
                    </p>
                    <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary/50 py-2.5 text-xs text-muted-foreground">
                      <Loader2
                        className={
                          "h-3.5 w-3.5 text-ward " + (pending ? "animate-spin" : "")
                        }
                      />
                      {pending ? "En attente d'approbation…" : "Prêt"}
                    </div>
                    <button
                      onClick={() => pick(selected)}
                      className="mt-3 w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98]"
                    >
                      Réessayer
                    </button>
                  </div>
                )}

                {err && (
                  <p className="mt-3 flex items-start gap-1.5 text-[11px] text-danger">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {err}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
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
            {address ? shortAddr(address) : "connecté"}
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
