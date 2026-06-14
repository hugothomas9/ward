"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { Layers } from "lucide-react";
import { useWard } from "@/components/ward-provider";
import { sendTx } from "@/lib/tx";
import { ADDR, USDG_DECIMALS } from "@/lib/contracts";
import { erc20Abi, lendingCoreAbi } from "@/lib/abi";
import { Input } from "@/components/ui/input";
import { groupInt } from "@/lib/format";

export function LiquidityCard() {
  const { usdgBalance, refetchAll } = useWard();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const pool = useReadContract({
    address: ADDR.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [ADDR.lendingCore],
    query: { refetchInterval: 10_000 },
  });
  const poolUsdg = pool.data ? Number(pool.data as bigint) / 1e6 : 0;
  const amt = Number(amount) || 0;
  const valid = amt > 0 && amt <= usdgBalance + 1e-9;

  const provide = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const wei = parseUnits(String(amt), USDG_DECIMALS);
      await sendTx(
        { address: ADDR.usdg, abi: erc20Abi, functionName: "approve", args: [ADDR.lendingCore, wei] },
        { pending: "Approbation de l'USDG…", success: "USDG approuvé" },
      );
      await sendTx(
        { address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "provide", args: [wei] },
        { pending: "Fourniture de liquidité…", success: "Liquidité fournie au pool" },
      );
      refetchAll();
      pool.refetch();
      setAmount("");
    } catch {
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-paper p-6">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-ward" />
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          Liquidité du pool
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pour pouvoir emprunter, le pool doit contenir de l&apos;USDG. Fournis-en
        (tu pourras le retirer ensuite).
      </p>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-hairline bg-background px-4 py-3">
        <span className="text-sm text-muted-foreground">Disponible dans le pool</span>
        <span className="font-mono text-sm font-medium tnum">
          {groupInt(poolUsdg)} USDG
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="font-mono tnum"
        />
        <button
          onClick={() => setAmount(String(Math.floor(usdgBalance)))}
          className="shrink-0 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Max
        </button>
        <button
          onClick={provide}
          disabled={!valid || busy}
          className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
        >
          Fournir
        </button>
      </div>
      <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
        Ton USDG : {groupInt(usdgBalance)}
      </div>
    </div>
  );
}
