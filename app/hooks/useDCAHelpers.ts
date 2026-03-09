"use client";

import { formatUnits } from "viem";

export const DCA_FREQUENCY_LABELS: Record<number, string> = {
  0: "1 Minute",
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

export const formatUSDC = (amount: bigint): string => {
  return formatUnits(amount, 6);
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
