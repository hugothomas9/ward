import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { toast } from "sonner";
import { wagmiConfig } from "@/lib/wagmi";

type WriteParams = Parameters<typeof writeContract>[1];

/** Sends a transaction, waits for the receipt, handles the toasts. Returns the hash. */
export async function sendTx(
  params: WriteParams,
  msg: { pending: string; success: string },
) {
  const id = toast.loading(msg.pending);
  try {
    const hash = await writeContract(wagmiConfig, params as never);
    await waitForTransactionReceipt(wagmiConfig, { hash });
    toast.success(msg.success, { id });
    return hash;
  } catch (e: unknown) {
    const err = e as { shortMessage?: string; message?: string };
    toast.error(err.shortMessage || err.message || "Transaction failed", {
      id,
    });
    throw e;
  }
}
