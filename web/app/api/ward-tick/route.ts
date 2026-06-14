import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "@/lib/chain";
import { ADDR } from "@/lib/contracts";
import { wardVaultAbi, lendingCoreAbi } from "@/lib/abi";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Keeper Ward (serveur) : surveille la position d'un user et appelle protect()
 * si le HF passe sous le trigger. La clé keeper (= deployer, celle de la policy)
 * reste côté serveur. protect() ne peut QUE dé-risquer (invariant on-chain).
 */
export async function POST(req: Request) {
  const key = process.env.DEPLOYER_KEY;
  if (!key) return NextResponse.json({ error: "no key" }, { status: 500 });

  let user = "";
  try {
    user = (await req.json())?.user ?? "";
  } catch {
    /* */
  }
  if (!isAddress(user)) {
    return NextResponse.json({ error: "user invalide" }, { status: 400 });
  }

  const pub = createPublicClient({ chain: robinhoodTestnet, transport: http() });

  const [policy, hf] = await Promise.all([
    pub.readContract({ address: ADDR.wardVault, abi: wardVaultAbi, functionName: "policyOf", args: [user] }) as Promise<readonly [bigint, bigint, `0x${string}`, boolean]>,
    pub.readContract({ address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "healthFactor", args: [user] }) as Promise<bigint>,
  ]);

  const [trigger, , , active] = policy;
  const hfNum = hf > 10n ** 30n ? Infinity : Number(hf) / 1e18;
  const triggerNum = Number(trigger) / 1e18;

  if (!active) return NextResponse.json({ status: "inactive", hf: hfNum });
  if (hf >= trigger) return NextResponse.json({ status: "healthy", hf: hfNum, trigger: triggerNum });

  // HF < trigger -> on tente de protéger
  const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`);
  const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport: http() });

  try {
    // simulate pour récupérer une erreur lisible avant d'envoyer
    await pub.simulateContract({
      account,
      address: ADDR.wardVault,
      abi: wardVaultAbi,
      functionName: "protect",
      args: [user],
    });
    const hash = await wallet.writeContract({
      address: ADDR.wardVault,
      abi: wardVaultAbi,
      functionName: "protect",
      args: [user],
    });
    await pub.waitForTransactionReceipt({ hash });
    const newHf = (await pub.readContract({ address: ADDR.lendingCore, abi: lendingCoreAbi, functionName: "healthFactor", args: [user] })) as bigint;
    return NextResponse.json({
      status: "protected",
      hfBefore: hfNum,
      hfAfter: newHf > 10n ** 30n ? Infinity : Number(newHf) / 1e18,
      tx: hash,
    });
  } catch (e: unknown) {
    const err = e as { shortMessage?: string; message?: string };
    return NextResponse.json({
      status: "cannot_protect",
      hf: hfNum,
      reason: err.shortMessage || err.message || "protect a échoué",
    });
  }
}
