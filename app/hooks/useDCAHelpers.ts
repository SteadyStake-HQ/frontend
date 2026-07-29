"use client";

import { formatUnits } from "viem";
import { getStableDecimals } from "@/config/contracts";

export const DCA_FREQUENCY_LABELS: Record<number, string> = {
  0: "1 Minute (Test)",
  1: "Daily",
  2: "Weekly",
  3: "Bi-weekly",
  4: "Monthly",
};

export const DCA_FREQUENCY_INTERVALS: Record<number, number> = {
  0: 60, // 1 minute in seconds
  1: 86400, // 1 day
  2: 604800, // 1 week
  3: 1209600, // 2 weeks
  4: 2592000, // 1 month (30 days)
};

export interface Schedule {
  targetToken: `0x${string}`;
  frequency: number;
  amountPerInterval: bigint;
  lastExecutionTime: bigint;
  totalAmount: bigint;
  executedCount: bigint;
  active: boolean;
}

export const calculateRemainingAmount = (
  totalAmount: bigint,
  amountPerInterval: bigint,
  executedCount: number,
): bigint => {
  const totalExecuted = amountPerInterval * BigInt(executedCount);
  return totalAmount - totalExecuted;
};

/**
 * Reconstruct a plan's original commitment and its planned run count.
 *
 * The contract stores what is *left* (`totalAmount` shrinks with every swap and is zeroed when the
 * plan closes), so the denominator for "how far along am I" has to be rebuilt as
 * `remaining + amountPerInterval × executedCount`.
 *
 * This must stay in raw token units. Rebuilding it in float dollars puts 0.2 × 3 at
 * 0.6000000000000001, and `Math.ceil(0.6000000000000001 / 0.2)` is 4 — inventing a run that was
 * never funded. That fake run then breaks the `executedCount >= runsCount` test, which is the only
 * signal separating a completed plan from a cancelled one (the contract zeroes `totalAmount` and
 * clears `active` for both), so a finished plan renders as "Cancelled".
 */
export const derivePlanRuns = (
  /** `schedule.totalAmount` — remaining, raw units */
  totalAmount: bigint,
  /** `schedule.amountPerInterval` — per run, raw units */
  amountPerInterval: bigint,
  executedCount: number,
): { committed: bigint; runsCount: number } => {
  if (amountPerInterval <= BigInt(0)) {
    return { committed: totalAmount, runsCount: Math.max(1, executedCount) };
  }
  const committed = totalAmount + amountPerInterval * BigInt(executedCount);
  // Integer ceil: a final run funded with less than a full interval still counts as a run.
  const runs = Number(
    (committed + amountPerInterval - BigInt(1)) / amountPerInterval,
  );
  return { committed, runsCount: Math.max(executedCount, runs, 1) };
};

export const calculateCancelFee = (remainingAmount: bigint): bigint => {
  const EARLY_CANCEL_FEE = BigInt(300); // 3%
  const EARLY_CANCEL_THRESHOLD = BigInt(5000); // 50%
  const FEE_PRECISION = BigInt(10000);

  const originalTotal =
    remainingAmount / ((BigInt(100) - BigInt(3)) / BigInt(100)); // Approximation

  // Check if remaining > 50%
  if (
    remainingAmount >
    (originalTotal * EARLY_CANCEL_THRESHOLD) / FEE_PRECISION
  ) {
    return (remainingAmount * EARLY_CANCEL_FEE) / FEE_PRECISION;
  }

  return BigInt(0);
};

/**
 * Format a settlement-stablecoin amount for display. `chainId` is required because the token is
 * 18-decimal on BNB Chain and 6-decimal everywhere else — a fixed 6 here would misread BSC
 * balances by a factor of 10^12.
 */
export const formatUSDC = (amount: bigint, chainId: number): string => {
  return formatUnits(amount, getStableDecimals(chainId));
};

export const calculateExecutionProgress = (
  totalAmount: bigint,
  amountPerInterval: bigint,
  executedCount: number,
): number => {
  if (totalAmount === BigInt(0)) return 0;
  const totalExecuted = amountPerInterval * BigInt(executedCount);
  return Number((totalExecuted * BigInt(100)) / totalAmount);
};

export const getNextExecutionTime = (
  lastExecutionTime: number,
  frequency: number,
): number => {
  const interval = DCA_FREQUENCY_INTERVALS[frequency] || 86400;
  return lastExecutionTime + interval;
};

export type ScheduleLike = {
  targetToken: `0x${string}`;
  frequency: number;
  amountPerInterval: bigint;
  lastExecutionTime: bigint;
  totalAmount: bigint;
  executedCount: bigint;
  active: boolean;
};

export const formatScheduleData = (schedule: ScheduleLike): Schedule => {
  return {
    targetToken: schedule.targetToken,
    frequency: schedule.frequency,
    amountPerInterval: schedule.amountPerInterval,
    lastExecutionTime: schedule.lastExecutionTime,
    totalAmount: schedule.totalAmount,
    executedCount: schedule.executedCount,
    active: schedule.active,
  };
};
