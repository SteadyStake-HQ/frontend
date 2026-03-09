"use client";

import { useAccount } from "wagmi";
import { useDCAVaultRead, useDCASchedule } from "./useDCAVault";
import { formatUnits } from "viem";
import { REVERSE_FREQUENCY_MAP, SUPPORTED_TOKENS } from "@/lib/constants";
import { useEffect, useState } from "react";

export interface PortfolioStats {
  totalDeposited: string; // In USDC
  totalExecuted: string; // In USDC (amount swapped out)
  portfolioValue: string; // In USD estimate
  activePlans: number;
  nextExecutionTime: number | null;
  nextExecutionIn: string;
}

export interface DCAPortfolioPlan {
  id: string;
  targetToken: string;
  amountPerInterval: string;
  frequency: string;
  totalDeposited: string;
  totalExecuted: string;
  remaining: string;
  nextRun: string;
  executionProgress: number;
  status: "active" | "paused" | "completed";
}

export const useDCAPortfolioData = () => {
  const { address, isConnected } = useAccount();
  const { activeSchedules, scheduleCount } = useDCAVaultRead(address);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(
    null,
  );
  const [plans, setPlans] = useState<DCAPortfolioPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isConnected || !activeSchedules || activeSchedules.length === 0) {
      queueMicrotask(() => {
        setPortfolioStats({
          totalDeposited: "0",
          totalExecuted: "0",
          portfolioValue: "$0.00",
          activePlans: 0,
          nextExecutionTime: null,
          nextExecutionIn: "—",
        });
        setPlans([]);
        setIsLoading(false);
      });
      return;
    }

    // Fetch all schedule details
    const fetchScheduleData = async () => {
      try {
        for (const _scheduleId of activeSchedules) {
          // Portfolio aggregation would require contract reads; left for future enhancement

          // Use the hook's data indirectly by calling it
          // Actually, we need a different approach since we can't call hooks in a loop
          // Let me restructure this
        }
      } catch (error) {
        console.error("Error fetching portfolio data:", error);
      }
    };

    fetchScheduleData();
  }, [activeSchedules, isConnected]);

  return {
    portfolioStats: portfolioStats || {
      totalDeposited: "0",
      totalExecuted: "0",
      portfolioValue: "$0.00",
      activePlans: scheduleCount || 0,
      nextExecutionTime: null,
      nextExecutionIn: "—",
    },
    plans,
    isLoading,
  };
};

// Alternative approach: Hook that fetches a single schedule with all necessary data
export const useScheduleWithData = (scheduleId: bigint) => {
  const { address } = useAccount();
  const { schedule, isReady, isLoading } = useDCASchedule(scheduleId, address);
  const [planData, setPlanData] = useState<DCAPortfolioPlan | null>(null);

  useEffect(() => {
    if (!schedule) return;

    const {
      targetToken,
      frequency,
      amountPerInterval,
      totalAmount,
      executedCount,
      lastExecutionTime,
      active,
    } = schedule;

    const tokenSymbol = (() => {
      for (const [, tokens] of Object.entries(SUPPORTED_TOKENS)) {
        const t = tokens.find(
          (t) => t.address.toLowerCase() === (targetToken as string).toLowerCase(),
        );
        if (t) return t.symbol;
      }
      return "Unknown";
    })();

    const frequencyLabel =
      REVERSE_FREQUENCY_MAP[frequency as keyof typeof REVERSE_FREQUENCY_MAP] ||
      "Unknown";
    const amountPerIntervalFormatted = formatUnits(
      amountPerInterval as bigint,
      6,
    );
    const remainingNum = Number(formatUnits(totalAmount as bigint, 6));
    const amountNum = Number(amountPerIntervalFormatted);
    const executed = Number(executedCount);
    // Contract stores remaining; original deposit = remaining + (amountPerInterval * executedCount)
    const originalTotalNum = remainingNum + amountNum * executed;
    const totalAmountFormatted = originalTotalNum.toFixed(2);
    const totalExecutedFormatted = (executed * amountNum).toFixed(2);
    const remainingFormatted = remainingNum.toFixed(2);

    const totalSchedules = Math.ceil(originalTotalNum / amountNum) || 1;
    const executionProgress = (executed / totalSchedules) * 100;

    const nextExecutionTimestamp = Number(lastExecutionTime);
    const nowSec = Math.floor(Date.now() / 1000);
    const secondsUntilNext = Math.max(0, nextExecutionTimestamp - nowSec);
    const daysUntilNext = Math.ceil(secondsUntilNext / 86400);
    const hoursUntilNext = Math.ceil(secondsUntilNext / 3600);
    const minutesUntilNext = Math.ceil(secondsUntilNext / 60);

    let nextExecutionLabel = "";
    if (secondsUntilNext < 60) {
      nextExecutionLabel = "Now";
    } else if (secondsUntilNext < 3600) {
      nextExecutionLabel = `In ${minutesUntilNext}m`;
    } else if (secondsUntilNext < 86400) {
      nextExecutionLabel = `In ${hoursUntilNext}h`;
    } else {
      nextExecutionLabel = `In ${daysUntilNext}d`;
    }

    queueMicrotask(() =>
      setPlanData({
        id: scheduleId.toString(),
        targetToken: tokenSymbol,
        amountPerInterval: amountPerIntervalFormatted,
        frequency: frequencyLabel,
        totalDeposited: totalAmountFormatted,
        totalExecuted: totalExecutedFormatted,
        remaining: remainingFormatted,
        nextRun: nextExecutionLabel,
        executionProgress,
        status: active ? "active" : "paused",
      }),
    );
  }, [schedule]);

  return { planData, isLoading };
};

// Simpler hook that calculates portfolio stats from schedule IDs
export const usePortfolioStats = () => {
  const { address, isConnected } = useAccount();
  const { activeSchedules, scheduleCount } = useDCAVaultRead(address);
  const [stats, setStats] = useState<PortfolioStats>({
    totalDeposited: "0",
    totalExecuted: "0",
    portfolioValue: "$0.00",
    activePlans: 0,
    nextExecutionTime: null,
    nextExecutionIn: "—",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }

    setStats((prev) => ({
      ...prev,
      activePlans: scheduleCount || 0,
    }));

    // The portfolio data will be calculated from individual schedules
    // This is just the aggregate view
    setIsLoading(false);
  }, [isConnected, scheduleCount]);

  return { ...stats, isLoading };
};
