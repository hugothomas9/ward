"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ConnectButton } from "@/components/connect";

function WardMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <g stroke="var(--ward)" strokeWidth="2.4" strokeLinecap="round">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI) / 6;
          const r1 = 5.5;
          const r2 = i % 2 === 0 ? 14 : 10.5;
          return (
            <line
              key={i}
              x1={16 + r1 * Math.cos(a)}
              y1={16 + r1 * Math.sin(a)}
              x2={16 + r2 * Math.cos(a)}
              y2={16 + r2 * Math.sin(a)}
            />
          );
        })}
      </g>
      <circle cx="16" cy="16" r="3.2" fill="var(--ward)" />
    </svg>
  );
}

const TABS = [
  { label: "Accueil", href: "/" },
  { label: "Trading", href: "/trading" },
  { label: "Ward", href: "/ward" },
  { label: "Profil", href: "/profil" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/80 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <WardMark className="h-7 w-7" />
          <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Ward
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  "relative rounded-md px-3 py-2 text-sm transition-colors " +
                  (active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-3 -bottom-[1px] h-[2px] bg-ward"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
