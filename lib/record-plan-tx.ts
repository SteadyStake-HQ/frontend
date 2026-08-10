import type { PublicClient } from "viem";

/**
 * Report a confirmed DCA transaction to `/api/plans/record`, which reads its receipt back from the
 * chain and writes what it finds into `dca_plans`.
 *
 * The relayer records its own runs (backend/src/run-executor.ts). A run the user signs in their own
 * wallet has no server in the loop, so the browser has to say it happened — otherwise a manually-run
 * plan shows no progress, and its buy prices are lost for good: a price can only be captured while
 * it is still the current one.
 *
 * Always best-effort and always after the receipt. The swap is already settled on-chain by the time
 * this runs, so a failure costs the plan its recorded history, never the buy.
 */
export async function recordPlanTx(chainId: number, txHash: `0x${string}`): Promise<void> {
  try {
    await fetch("/api/plans/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainId, txHash }),
    });
  } catch {
    // Ignored: the vault is the source of truth for the transaction itself.
  }
}

/**
 * Wait for a transaction to mine, then record it if it succeeded. For callers that fire and forget:
 * a reverted transaction is not a buy, and the route would refuse it anyway.
 */
export async function recordPlanTxWhenMined(
  client: PublicClient | undefined,
  chainId: number,
  txHash: `0x${string}`,
): Promise<void> {
  if (!client) return;
  try {
    const receipt = await client.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") return;
  } catch {
    return;
  }
  await recordPlanTx(chainId, txHash);
}
