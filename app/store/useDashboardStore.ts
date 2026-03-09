"use client";

import { create } from "zustand";
import { getBalance, multicall, readContract } from "@wagmi/core";
import { formatUnits } from "viem";
import { config } from "@/config/wagmi";
import { DCA_VAULT_ABI } from "@/config/abis";
import { getContracts, getTokenList } from "@/config/contracts";
import { DCA_FREQUENCY_INTERVALS } from "@/app/hooks/useDCAHelpers";
import { REVERSE_FREQUENCY_MAP } from "@/lib/constants";
import { getTokenLogoUrl } from "@/lib/token-logo";

export interface DashboardPlanRecord {
  id: string;
  scheduleId: bigint;
  targetTokenAddress: string;
  targetToken: string;
  tokenName?: string;
  tokenLogo?: string;
  amountPerInterval: string;
  frequency: string;
  totalDeposited: string;
  totalExecuted: string;
  nextRun: string;
  executionProgress: number;
  status: "active" | "cancelled" | "ended";
  nextExecutionTimestamp: number;
  isReady: boolean;
  isEnrolledForAutoExecution: boolean;
}

interface DashboardHistoryPoint {
  at: string;
  valueUsdc6: string;
}

interface DashboardStoreState {
  walletKey: string | null;
  usdcBalance: string;
  totalDeposited: number;
  depositsPerPlan: number[];
  nextExecutionTime: number | null;
  activePlanCount: number;
  scheduleCount: number;
  activeSchedules: readonly bigint[];
  allScheduleIds: readonly bigint[];
  enrolledCount: number;
  plans: DashboardPlanRecord[];
  historyPoints: DashboardHistoryPoint[];
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetchedAt: number | null;
  error: string | null;
  fetchDashboardData: (params: {
    address?: string;
    chainId?: number;
    force?: boolean;
  }) => Promise<void>;
  resetDashboardData: () => void;
}

type DashboardChainId = 56 | 137 | 2222 | 8453 | 84532 | 11155111;

function formatNextRun(targetTimestamp: number, now: number): string {
  const secondsUntilNext = Math.max(0, targetTimestamp - now);
  if (secondsUntilNext < 60) return "Now";
  if (secondsUntilNext < 3600) return `In ${Math.ceil(secondsUntilNext / 60)}m`;
  if (secondsUntilNext < 86400) return `In ${Math.ceil(secondsUntilNext / 3600)}h`;
  return `In ${Math.ceil(secondsUntilNext / 86400)}d`;
}

const EMPTY_STATE = {
  walletKey: null,
  usdcBalance: "0",
  totalDeposited: 0,
  depositsPerPlan: [],
  nextExecutionTime: null,
  activePlanCount: 0,
  scheduleCount: 0,
  activeSchedules: [] as readonly bigint[],
  allScheduleIds: [] as readonly bigint[],
  enrolledCount: 0,
  plans: [] as DashboardPlanRecord[],
  historyPoints: [] as DashboardHistoryPoint[],
  isLoading: false,
  isRefreshing: false,
  lastFetchedAt: null as number | null,
  error: null as string | null,
};

export const useDashboardStore = create<DashboardStoreState>((set, get) => ({
  ...EMPTY_STATE,

  resetDashboardData: () => set({ ...EMPTY_STATE }),

  fetchDashboardData: async ({ address, chainId, force = false }) => {
    if (!address || chainId == null) {
      set({ ...EMPTY_STATE });
      return;
    }

    const contracts = getContracts(chainId);
    if (!contracts) {
      set({ ...EMPTY_STATE, error: "Unsupported network" });
      return;
    }
    const supportedChainId = chainId as DashboardChainId;

    const walletKey = `${address.toLowerCase()}-${chainId}`;
    const state = get();
    if (!force && state.walletKey === walletKey && state.isRefreshing) return;

    set((prev) => ({
      ...prev,
      walletKey,
      isLoading: prev.lastFetchedAt == null || prev.walletKey !== walletKey,
      isRefreshing: true,
      error: null,
    }));

    try {
      const now = Math.floor(Date.now() / 1000);
      const [usdcBalanceResult, scheduleCountResult, activeSchedulesResult, enrolledCountResult] =
        await Promise.all([
          getBalance(config, {
            address: address as `0x${string}`,
            token: contracts.MockUSDC as `0x${string}`,
            chainId: supportedChainId,
          }),
          readContract(config, {
            address: contracts.DCAVault as `0x${string}`,
            abi: DCA_VAULT_ABI,
            functionName: "scheduleCount",
            args: [address as `0x${string}`],
            chainId: supportedChainId,
          }),
          readContract(config, {
            address: contracts.DCAVault as `0x${string}`,
            abi: DCA_VAULT_ABI,
            functionName: "getActiveSchedules",
            args: [address as `0x${string}`],
            chainId: supportedChainId,
          }),
          readContract(config, {
            address: contracts.DCAVault as `0x${string}`,
            abi: DCA_VAULT_ABI,
            functionName: "enrolledCount",
            args: [address as `0x${string}`],
            chainId: supportedChainId,
          }),
        ]);

      const scheduleCount = Number(scheduleCountResult ?? 0n);
      const activeSchedules = (activeSchedulesResult ?? []) as bigint[];
      const allScheduleIds =
        scheduleCount > 0
          ? Array.from({ length: scheduleCount }, (_, i) => BigInt(i))
          : [];

      const planContracts = allScheduleIds.flatMap((scheduleId) => [
        {
          address: contracts.DCAVault as `0x${string}`,
          abi: DCA_VAULT_ABI,
          functionName: "getSchedule" as const,
          args: [address as `0x${string}`, scheduleId] as const,
          chainId: supportedChainId,
        },
        {
          address: contracts.DCAVault as `0x${string}`,
          abi: DCA_VAULT_ABI,
          functionName: "isScheduleReady" as const,
          args: [address as `0x${string}`, scheduleId] as const,
          chainId: supportedChainId,
        },
        {
          address: contracts.DCAVault as `0x${string}`,
          abi: DCA_VAULT_ABI,
          functionName: "enrolledForAutoExecution" as const,
          args: [address as `0x${string}`, scheduleId] as const,
          chainId: supportedChainId,
        },
      ]);

      const planResults =
        planContracts.length > 0
          ? await multicall(config, {
              allowFailure: true,
              contracts: planContracts,
            })
          : [];

      const tokenList = getTokenList(chainId);

      const plans = allScheduleIds
        .map<DashboardPlanRecord | null>((scheduleId, index) => {
          const baseIndex = index * 3;
          const scheduleResult = planResults[baseIndex];
          const readyResult = planResults[baseIndex + 1];
          const enrolledResult = planResults[baseIndex + 2];

          if (!scheduleResult || scheduleResult.status !== "success") return null;

          const schedule = scheduleResult.result as {
            targetToken: string;
            frequency: number;
            amountPerInterval: bigint;
            lastExecutionTime: bigint;
            totalAmount: bigint;
            executedCount: bigint;
            active: boolean;
          };

          const matchedToken = tokenList.find(
            (token) =>
              token.address.toLowerCase() === String(schedule.targetToken).toLowerCase(),
          );
          const tokenSymbol =
            matchedToken?.symbol ??
            `${String(schedule.targetToken).slice(0, 8)}...${String(schedule.targetToken).slice(-6)}`;
          const tokenName = matchedToken?.name;
          const tokenLogo = getTokenLogoUrl(
            chainId,
            String(schedule.targetToken),
            matchedToken?.logo,
          );

          const frequencyNum = Number(schedule.frequency);
          const intervalSeconds = DCA_FREQUENCY_INTERVALS[frequencyNum] ?? 86400;
          const amountNum = Number(formatUnits(schedule.amountPerInterval, 6));
          const remainingNum = Number(formatUnits(schedule.totalAmount, 6));
          const executedCount = Number(schedule.executedCount);
          const originalTotalNum = remainingNum + amountNum * executedCount;
          const totalSchedules = Math.max(1, Math.ceil(originalTotalNum / Math.max(amountNum, 0.000001)));
          const nextExecutionTimestamp =
            Number(schedule.lastExecutionTime) + intervalSeconds;

          let status: "active" | "cancelled" | "ended" = "active";
          if (executedCount >= totalSchedules || remainingNum <= 0) status = "ended";
          else if (!schedule.active) status = "cancelled";

          return {
            id: scheduleId.toString(),
            scheduleId,
            targetTokenAddress: String(schedule.targetToken),
            targetToken: tokenSymbol,
            tokenName: tokenName ?? undefined,
            tokenLogo: tokenLogo ?? undefined,
            amountPerInterval: amountNum.toFixed(2),
            frequency: REVERSE_FREQUENCY_MAP[frequencyNum] || "Unknown",
            totalDeposited: originalTotalNum.toFixed(2),
            totalExecuted: (executedCount * amountNum).toFixed(2),
            nextRun: formatNextRun(nextExecutionTimestamp, now),
            executionProgress:
              status === "active"
                ? Math.min(100, (executedCount / totalSchedules) * 100)
                : (executedCount / totalSchedules) * 100,
            status,
            nextExecutionTimestamp,
            isReady:
              readyResult?.status === "success" ? Boolean(readyResult.result) : false,
            isEnrolledForAutoExecution:
              enrolledResult?.status === "success"
                ? Boolean(enrolledResult.result)
                : false,
          };
        })
        .filter((plan): plan is DashboardPlanRecord => plan !== null)
        .sort((a, b) => {
          const statusOrder = { active: 0, cancelled: 1, ended: 2 };
          if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
          return Number(a.scheduleId) - Number(b.scheduleId);
        });

      const totalDeposited = plans.reduce(
        (sum, plan) => sum + Number(plan.totalDeposited),
        0,
      );
      const depositsPerPlan = plans
        .filter((plan) => plan.status === "active")
        .map((plan) => Number(plan.totalDeposited))
        .filter((value) => value > 0);

      const nextExecutionTime = plans
        .filter((plan) => plan.status === "active" && plan.nextExecutionTimestamp > 0)
        .reduce<number | null>((min, plan) => {
          if (min == null) return plan.nextExecutionTimestamp;
          return Math.min(min, plan.nextExecutionTimestamp);
        }, null);

      let historyPoints: DashboardHistoryPoint[] = [];
      try {
        const response = await fetch(
          `/api/scheduler/portfolio?user=${encodeURIComponent(address)}&chainId=${encodeURIComponent(chainId)}&limit=200`,
        );
        if (response.ok) {
          const data = (await response.json()) as {
            points?: DashboardHistoryPoint[];
          };
          historyPoints = data.points ?? [];
        }
      } catch {
        historyPoints = [];
      }

      set({
        walletKey,
        usdcBalance: usdcBalanceResult?.formatted
          ? Number(usdcBalanceResult.formatted).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })
          : "0",
        totalDeposited,
        depositsPerPlan,
        nextExecutionTime,
        activePlanCount: activeSchedules.length,
        scheduleCount,
        activeSchedules,
        allScheduleIds,
        enrolledCount: Number(enrolledCountResult ?? 0n),
        plans,
        historyPoints,
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: Date.now(),
        error: null,
      });
    } catch (error) {
      set((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard data",
      }));
    }
  },
}));
