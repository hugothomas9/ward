import { Wallet } from "lucide-react";

function WardMark({ className = "" }: { className?: string }) {
  // Marque "sentinelle" — sunburst/balise en vert Ward
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

const TABS = ["Accueil", "Trading", "Ward", "Profil"] as const;

export function SiteNav({ active = "Ward" }: { active?: (typeof TABS)[number] }) {
  return (
    <header className="relative z-10 border-b border-hairline/80 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <div className="flex items-center gap-2.5">
          <WardMark className="h-7 w-7" />
          <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Ward
          </span>
        </div>

        <nav className="hidden items-center gap-7 md:flex">
          {TABS.map((t) => (
            <span
              key={t}
              className={
                "relative cursor-default text-sm transition-colors " +
                (t === active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t}
              {t === active && (
                <span className="absolute -bottom-[22px] left-0 right-0 h-[2px] bg-ward" />
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 rounded-full border border-hairline bg-paper px-3.5 py-1.5 text-sm">
          <Wallet className="h-3.5 w-3.5 text-ward" />
          <span className="font-mono text-xs text-muted-foreground tnum">
            0xDA54…c85E
          </span>
        </div>
      </div>
    </header>
  );
}
