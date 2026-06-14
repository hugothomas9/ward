import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "@/lib/chain";
import { ADDR } from "@/lib/contracts";
import { aggregatorAbi, priceHistoryAbi, dynamicRiskAbi } from "@/lib/abi";

export const runtime = "nodejs";

const CRASH_PRICE = 210n;
const NORMAL_PRICE = 250n;

/**
 * Crash on-chain de démo : le owner (deployer) bouge le feed, puis poke + refresh.
 * Le moteur Stylus recalcule le seuil dynamique pour de vrai.
 * La clé deployer reste côté serveur (jamais exposée au navigateur).
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

  const price = action === "reset" ? NORMAL_PRICE : CRASH_PRICE;
  const answer = price * 10n ** 8n; // feed 8 décimales

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

    // poke : peut révoquer si appelé trop tôt (minInterval) — best-effort
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
      /* minInterval/staleness — on continue */
    }

    // refresh : le DynamicRiskModel relit l'historique et appelle le moteur Stylus
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

    return NextResponse.json({ ok: true, price: Number(price), action, tx });
  } catch (e: unknown) {
    const err = e as { shortMessage?: string; message?: string };
    return NextResponse.json(
      { error: err.shortMessage || err.message || "échec on-chain" },
      { status: 500 },
    );
  }
}
