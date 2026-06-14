import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "@/lib/chain";
import { ADDR } from "@/lib/contracts";
import { aggregatorAbi, priceHistoryAbi, dynamicRiskAbi } from "@/lib/abi";

export const runtime = "nodejs";
export const maxDuration = 60;

const FALLBACK_PRICE = 406.43;
const MAX_AGE = 50 * 60; // 50 min : on rafraîchit avant l'expiration (1h) de l'oracle

async function realTslaPrice(): Promise<number> {
  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1d&range=1d",
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
    );
    const j = await r.json();
    const p = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof p === "number" && p > 0 ? p : FALLBACK_PRICE;
  } catch {
    return FALLBACK_PRICE;
  }
}

/**
 * Garde le feed frais : si l'observation a > 50 min, le owner pousse le cours réel
 * (updateAnswer + poke + refresh). Évite le revert "stale feed" de l'oracle (fenêtre 1h).
 * Idempotent : ne fait rien si le feed est encore frais.
 */
export async function GET() {
  const key = process.env.DEPLOYER_KEY;
  if (!key) return NextResponse.json({ error: "no key" }, { status: 500 });

  const pub = createPublicClient({ chain: robinhoodTestnet, transport: http() });
  const round = (await pub.readContract({
    address: ADDR.feed,
    abi: aggregatorAbi,
    functionName: "latestRoundData",
  })) as readonly [bigint, bigint, bigint, bigint, bigint];

  const updatedAt = Number(round[3]);
  const block = await pub.getBlock();
  const now = Number(block.timestamp);
  const age = now - updatedAt;

  if (age < MAX_AGE) {
    return NextResponse.json({ synced: false, ageSec: age });
  }

  const price = await realTslaPrice();
  const answer = BigInt(Math.round(price * 1e8));
  const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`);
  const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport: http() });

  try {
    const h = await wallet.writeContract({ address: ADDR.feed, abi: aggregatorAbi, functionName: "updateAnswer", args: [answer] });
    await pub.waitForTransactionReceipt({ hash: h });
    try {
      const p = await wallet.writeContract({ address: ADDR.priceHistory, abi: priceHistoryAbi, functionName: "poke", args: [] });
      await pub.waitForTransactionReceipt({ hash: p });
    } catch {}
    try {
      const rf = await wallet.writeContract({ address: ADDR.riskModel, abi: dynamicRiskAbi, functionName: "refresh", args: [] });
      await pub.waitForTransactionReceipt({ hash: rf });
    } catch {}
    return NextResponse.json({ synced: true, price, ageSec: age });
  } catch (e: unknown) {
    const err = e as { shortMessage?: string; message?: string };
    return NextResponse.json({ error: err.shortMessage || err.message || "sync échouée" }, { status: 500 });
  }
}
