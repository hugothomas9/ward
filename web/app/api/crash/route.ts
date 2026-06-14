import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "@/lib/chain";
import { ADDR } from "@/lib/contracts";
import { aggregatorAbi, priceHistoryAbi, dynamicRiskAbi } from "@/lib/abi";

export const runtime = "nodejs";
export const maxDuration = 60;

const FALLBACK_PRICE = 406.43;
const CRASH_FACTOR = 0.84; // -16 %

/** Vrai cours TSLA (Yahoo Finance). Fallback si l'API ne répond pas. */
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

/** GET : prix de référence (vrai cours TSLA) pour le front. */
export async function GET() {
  const price = await realTslaPrice();
  return NextResponse.json({ price });
}

/**
 * POST : crash de démo on-chain. Le owner (deployer, clé serveur) bouge le feed
 * puis poke + refresh — le moteur Stylus recalcule le seuil pour de vrai.
 *   action 'crash' -> prix réel * 0.84   |   'reset' -> prix réel
 */
export async function POST(req: Request) {
  const key = process.env.DEPLOYER_KEY;
  if (!key) {
    return NextResponse.json({ error: "DEPLOYER_KEY manquant côté serveur" }, { status: 500 });
  }

  let action = "crash";
  try {
    const body = await req.json();
    if (body?.action) action = body.action;
  } catch {
    /* défaut crash */
  }

  const real = await realTslaPrice();
  const target = action === "reset" ? real : real * CRASH_FACTOR;
  const answer = BigInt(Math.round(target * 1e8));

  const account = privateKeyToAccount(
    (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`,
  );
  const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport: http() });
  const pub = createPublicClient({ chain: robinhoodTestnet, transport: http() });

  const tx: Record<string, string> = {};
  try {
    const h1 = await wallet.writeContract({
      address: ADDR.feed,
      abi: aggregatorAbi,
      functionName: "updateAnswer",
      args: [answer],
    });
    await pub.waitForTransactionReceipt({ hash: h1 });
    tx.updateAnswer = h1;

    try {
      const h2 = await wallet.writeContract({
        address: ADDR.priceHistory,
        abi: priceHistoryAbi,
        functionName: "poke",
        args: [],
      });
      await pub.waitForTransactionReceipt({ hash: h2 });
      tx.poke = h2;
    } catch {
      /* minInterval — on continue */
    }

    try {
      const h3 = await wallet.writeContract({
        address: ADDR.riskModel,
        abi: dynamicRiskAbi,
        functionName: "refresh",
        args: [],
      });
      await pub.waitForTransactionReceipt({ hash: h3 });
      tx.refresh = h3;
    } catch {
      /* rate-limit C1 — on continue */
    }

    return NextResponse.json({
      ok: true,
      action,
      price: Math.round(target * 100) / 100,
      normalPrice: Math.round(real * 100) / 100,
      tx,
    });
  } catch (e: unknown) {
    const err = e as { shortMessage?: string; message?: string };
    return NextResponse.json(
      { error: err.shortMessage || err.message || "échec on-chain" },
      { status: 500 },
    );
  }
}
