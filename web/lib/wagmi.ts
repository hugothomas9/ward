import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { robinhoodTestnet } from "@/lib/chain";

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  connectors: [
    // injected = MetaMask (extension) ET le navigateur in-app de Robinhood Wallet (mobile)
    injected({ shimDisconnect: true }),
    // WalletConnect (QR desktop) — uniquement si un projectId est fourni
    ...(wcProjectId
      ? [walletConnect({ projectId: wcProjectId, showQrModal: true })]
      : []),
  ],
  transports: {
    [robinhoodTestnet.id]: http(),
  },
  ssr: true,
});

export const hasWalletConnect = Boolean(wcProjectId);
