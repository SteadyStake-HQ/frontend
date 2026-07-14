"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { DCA_VAULT_ABI } from "@/config/abis";
import { useContracts } from "./useContracts";

export interface PlanExecution {
  /** 1-based position in the plan's run order */
  index: number;
  txHash: `0x${string}`;
  blockNumber: bigint;
  /** Unix seconds. Null when the block lookup failed — the row still renders. */
  timestamp: number | null;
  usdcAmount: bigint;
  tokenOut: bigint;
  fee: bigint;
}

export interface PlanExecutionHistory {
  executions: PlanExecution[];
  isLoading: boolean;
  /** The RPC refused every log query — we know nothing, fall back to the schedule. */
  unavailable: boolean;
  /** We found some runs but ran out of scan budget before reaching the oldest. */
  partial: boolean;
}

/**
 * Log-range windows, widest first. Providers cap `eth_getLogs` and the cap varies
 * a lot — Base's public Sepolia node allows only 2000 blocks, while a paid node
 * will happily serve the whole chain. `null` means "ask for everything at once";
 * we fall back through the list until one is accepted, then page with that size.
 */
const WINDOW_CANDIDATES: (bigint | null)[] = [null, 100_000n, 10_000n, 2_000n, 1_000n];

/** Paging budget. Bounds the worst case when an RPC only grants tiny windows. */
const MAX_WINDOWS = 24;

/** Blocks we resolve timestamps for. A 1-minute plan racks up runs fast, and the
 *  timeline only ever shows the recent ones. */
const MAX_TIMESTAMP_LOOKUPS = 60;

type ExecutedLog = {
  transactionHash: `0x${string}` | null;
  blockNumber: bigint | null;
  args: { usdcAmount?: bigint; tokenOut?: bigint; fee?: bigint };
};

async function fetchExecutionLogs(
  client: PublicClient,
  vault: `0x${string}`,
  user: `0x${string}`,
  scheduleId: bigint,
  expectedCount: number,
): Promise<{ logs: ExecutedLog[]; partial: boolean }> {
  const latest = await client.getBlockNumber();

  const getLogs = (fromBlock: bigint, toBlock: bigint | "latest") =>
    client.getContractEvents({
      address: vault,
      abi: DCA_VAULT_ABI,
      eventName: "ScheduleExecuted",
      args: { user, scheduleId },
      fromBlock,
      toBlock,
    }) as unknown as Promise<ExecutedLog[]>;

  let lastError: unknown;

  for (const window of WINDOW_CANDIDATES) {
    // Whole chain in one call — the happy path on a well-provisioned RPC.
    if (window === null) {
      try {
        return { logs: await getLogs(0n, "latest"), partial: false };
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    // Otherwise page backwards from the tip, newest window first, and stop as
    // soon as we've seen every run the contract says exists.
    const collected: ExecutedLog[] = [];
    let toBlock = latest;
    let accepted = false;

    for (let i = 0; i < MAX_WINDOWS; i++) {
      const fromBlock = toBlock >= window ? toBlock - window + 1n : 0n;
      let batch: ExecutedLog[];
      try {
        batch = await getLogs(fromBlock, toBlock);
      } catch (err) {
        lastError = err;
        break; // this window size is rejected — try a smaller one
      }
      accepted = true;
      collected.unshift(...batch);

      if (collected.length >= expectedCount || fromBlock === 0n) {
        return { logs: collected, partial: false };
      }
      toBlock = fromBlock - 1n;
    }

    if (accepted) {
      // Budget ran out before we reached the plan's first run.
      return { logs: collected, partial: collected.length < expectedCount };
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not read execution history");
}

async function resolveTimestamps(
  client: PublicClient,
  blockNumbers: bigint[],
): Promise<Map<bigint, number>> {
  const unique = [...new Set(blockNumbers)].slice(-MAX_TIMESTAMP_LOOKUPS);
  const entries = await Promise.all(
    unique.map(async (blockNumber) => {
      try {
        const block = await client.getBlock({ blockNumber });
        return [blockNumber, Number(block.timestamp)] as const;
      } catch {
        return null;
      }
    }),
  );
  return new Map(entries.filter((e): e is readonly [bigint, number] => e !== null));
}

/**
 * Real on-chain execution history for one DCA schedule, from the vault's
 * `ScheduleExecuted` events. Nothing is stored off-chain, so these logs are the
 * only source of true swap times, amounts received, and transaction hashes.
 *
 * `expectedCount` is the contract's `executedCount`: it tells us when to stop
 * paging backwards, and it anchors run numbering when a partial scan means the
 * oldest runs weren't reached.
 */
export function usePlanExecutions(
  scheduleId: bigint | null,
  userAddress: `0x${string}` | undefined,
  expectedCount: number,
): PlanExecutionHistory {
  const { chainId, contracts, isSupported } = useContracts();
  const client = usePublicClient({ chainId });
  const vault = contracts.DCAVault as `0x${string}` | undefined;

  // Nothing has run yet — don't spend a single RPC call proving it.
  const enabled =
    !!client && !!vault && !!userAddress && scheduleId !== null && isSupported && expectedCount > 0;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "plan-executions",
      chainId,
      vault,
      userAddress,
      scheduleId?.toString(),
      expectedCount,
    ],
    enabled,
    staleTime: 15_000,
    retry: false,
    queryFn: async (): Promise<{ executions: PlanExecution[]; partial: boolean }> => {
      const { logs, partial } = await fetchExecutionLogs(
        client as PublicClient,
        vault as `0x${string}`,
        userAddress as `0x${string}`,
        scheduleId as bigint,
        expectedCount,
      );

      const blockNumbers = logs
        .map((l) => l.blockNumber)
        .filter((b): b is bigint => b !== null);
      const times = await resolveTimestamps(client as PublicClient, blockNumbers);

      // Number from the newest run backwards: a partial scan still labels the
      // runs it did find correctly, because the newest is always #expectedCount.
      const firstIndex = Math.max(1, expectedCount - logs.length + 1);

      return {
        partial,
        executions: logs.map((log, i) => ({
          index: firstIndex + i,
          txHash: (log.transactionHash ?? "0x") as `0x${string}`,
          blockNumber: log.blockNumber ?? 0n,
          timestamp: log.blockNumber != null ? (times.get(log.blockNumber) ?? null) : null,
          usdcAmount: log.args.usdcAmount ?? 0n,
          tokenOut: log.args.tokenOut ?? 0n,
          fee: log.args.fee ?? 0n,
        })),
      };
    },
  });

  return {
    executions: data?.executions ?? [],
    isLoading: enabled && isLoading,
    unavailable: isError,
    partial: data?.partial ?? false,
  };
}
