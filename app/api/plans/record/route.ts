import { NextRequest, NextResponse } from "next/server";
import { parseEventLogs } from "viem";
import { DCA_VAULT_ABI } from "@/config/abis";
import { getContracts } from "@/config/contracts";
import { getServerPublicClient } from "@/lib/server-chain";
import { isSupabaseConfigured, recordPlanCancelled, recordPlanCreated } from "@/lib/dca-plans-store";

export const runtime = "nodejs";

/**
 * POST /api/plans/record
 * Body: { chainId: number, txHash: string }
 *
 * Records the DCA plan lifecycle events contained in a confirmed transaction into `dca_plans`,
 * so the dashboard and executor can read plans from the database instead of scanning block logs
 * to rediscover them. Call it after any create/cancel transaction confirms.
 *
 * Everything stored is read back from the chain (the receipt's logs and the schedule struct), not
 * taken from the request body — the caller only supplies which transaction to look at. Logs are
 * matched against the vault address for the given chain, so an unrelated or spoofed transaction
 * records nothing. That also makes the route safe to retry: recording is idempotent.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chainId = Number(body?.chainId);
    const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";

    if (!Number.isInteger(chainId) || chainId <= 0 || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Invalid chainId or txHash" }, { status: 400 });
    }
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Plan store not configured (set SUPABASE_DB_URL)", ok: false },
        { status: 503 },
      );
    }

    const contracts = getContracts(chainId);
    const client = getServerPublicClient(chainId);
    if (!contracts || !client) {
      return NextResponse.json({ error: `Unsupported chainId ${chainId}`, ok: false }, { status: 400 });
    }
    const vault = contracts.DCAVault.toLowerCase() as `0x${string}`;

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction reverted; nothing recorded", ok: false }, { status: 400 });
    }

    // Only logs emitted by this chain's vault count. A batched create (createScheduleAndEnroll…)
    // routes through a helper contract, so match on the emitter rather than the transaction target.
    const vaultLogs = receipt.logs.filter((l) => l.address.toLowerCase() === vault);
    const events = parseEventLogs({ abi: DCA_VAULT_ABI, logs: vaultLogs });

    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const at = new Date(Number(block.timestamp) * 1000);

    const recorded: Array<{ event: string; scheduleId: string }> = [];

    for (const ev of events) {
      if (ev.eventName === "ScheduleCreated") {
        const { user, scheduleId, targetToken, frequency, amountPerInterval } = ev.args;
        // ScheduleCreated carries no total, so read the deposit from the struct — at creation it is
        // exactly the committed total, and it is the only moment that value is unambiguous.
        const schedule = (await client.readContract({
          address: vault,
          abi: DCA_VAULT_ABI,
          functionName: "getSchedule",
          args: [user, scheduleId],
        })) as { totalAmount: bigint };

        await recordPlanCreated({
          chainId,
          userAddr: user,
          scheduleId: Number(scheduleId),
          targetToken,
          frequency: Number(frequency),
          amountPerIntervalUsdc6: amountPerInterval.toString(),
          committedUsdc6: schedule.totalAmount.toString(),
          createdAt: at,
        });
        recorded.push({ event: "ScheduleCreated", scheduleId: scheduleId.toString() });
      } else if (ev.eventName === "ScheduleCancelled") {
        const { user, scheduleId, returnedAmount } = ev.args;
        await recordPlanCancelled({
          chainId,
          userAddr: user,
          scheduleId: Number(scheduleId),
          returnedUsdc6: returnedAmount.toString(),
          at,
        });
        recorded.push({ event: "ScheduleCancelled", scheduleId: scheduleId.toString() });
      }
    }

    return NextResponse.json({ ok: true, recorded });
  } catch (e) {
    console.error("[plans/record]", e);
    return NextResponse.json(
      { error: `Recording failed: ${(e as Error).message}`, ok: false },
      { status: 503 },
    );
  }
}
