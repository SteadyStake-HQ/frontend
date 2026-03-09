"use client";

import { createContext, useContext, useMemo } from "react";
import { useDashboardStore } from "@/app/store/useDashboardStore";

export interface AggregatedStats {
  totalDeposited: number;
  nextExecutionIn: string;
  nextExecutionTime: number | null;
}

interface DashboardStatsContextValue {
  usdcBalance: string;
  isLoadingBalance: boolean;
  totalDeposited: number;
  depositsPerPlan: number[];
  nextExecutionIn: string;
  nextExecutionTime: number | null;
  activePlanCount: number;
  isLoadingStats: boolean;
  activeSchedules: readonly bigint[];
  scheduleCount: number;
}

const DashboardStatsContext = createContext<DashboardStatsContextValue | null>(null);

function formatNextExecutionIn(targetTimestamp: number | null): string {
  if (targetTimestamp == null) return "—";
  const secondsUntilNext = Math.max(0, targetTimestamp - Math.floor(Date.now() / 1000));
  if (secondsUntilNext < 60) return "1min";
  if (secondsUntilNext < 3600) return `In ${Math.ceil(secondsUntilNext / 60)}m`;
  if (secondsUntilNext < 86400) return `In ${Math.ceil(secondsUntilNext / 3600)}h`;
  return `In ${Math.ceil(secondsUntilNext / 86400)}d`;
}

export function DashboardStatsProvider({ children }: { children: React.ReactNode }) {
  const usdcBalance = useDashboardStore((state) => state.usdcBalance);
  const totalDeposited = useDashboardStore((state) => state.totalDeposited);
  const depositsPerPlan = useDashboardStore((state) => state.depositsPerPlan);
  const nextExecutionTime = useDashboardStore((state) => state.nextExecutionTime);
  const activePlanCount = useDashboardStore((state) => state.activePlanCount);
  const activeSchedules = useDashboardStore((state) => state.activeSchedules);
  const scheduleCount = useDashboardStore((state) => state.scheduleCount);
  const isLoading = useDashboardStore((state) => state.isLoading);

  const value = useMemo<DashboardStatsContextValue>(
    () => ({
      usdcBalance,
      isLoadingBalance: isLoading,
      totalDeposited,
      depositsPerPlan,
      nextExecutionIn: formatNextExecutionIn(nextExecutionTime),
      nextExecutionTime,
      activePlanCount,
      isLoadingStats: isLoading,
      activeSchedules,
      scheduleCount,
    }),
    [
      usdcBalance,
      isLoading,
      totalDeposited,
      depositsPerPlan,
      nextExecutionTime,
      activePlanCount,
      activeSchedules,
      scheduleCount,
    ],
  );

  return (
    <DashboardStatsContext.Provider value={value}>
      {children}
    </DashboardStatsContext.Provider>
  );
}

export function useDashboardStats() {
  const ctx = useContext(DashboardStatsContext);
  if (!ctx) {
    throw new Error("useDashboardStats must be used within DashboardStatsProvider");
  }
  return ctx;
}
