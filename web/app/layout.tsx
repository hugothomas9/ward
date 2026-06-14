import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/web3-provider";
import { WardProvider } from "@/components/ward-provider";
import { SiteNav } from "@/components/site-nav";
import { NetworkBanner } from "@/components/network-banner";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ward — anti-liquidation credit",
  description:
    "A credit line backed by tokenized stocks, with an anti-liquidation autopilot, on Robinhood Chain.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full">
        <Web3Provider>
          <WardProvider>
            <div className="relative z-10 flex min-h-screen flex-col">
              <SiteNav />
              <NetworkBanner />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <Toaster position="bottom-right" />
          </WardProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
