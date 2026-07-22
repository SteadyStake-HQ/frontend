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
  /** Contract timestamp when a manual execution becomes valid. */
  contractDueTimestamp: number;
  /** Contract due time displayed consistently by frontend and backend. */
  nextExecutionTimestamp: number;
  isReady: boolean;
  isEnrolledForAutoExecution: boolean;
  executionMode: "auto" | "manual" | null;
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
  backendClockOffsetSeconds: number;
  backendChainClockOffsetSeconds: number;
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

type DashboardChainId = 56 | 137 | 677 | 968 | 2222 | 8453 | 84532 | 11155111;

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
  backendClockOffsetSeconds: 0,
  backendChainClockOffsetSeconds: 0,
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

    const walletKey = `${address.toLowerCase()}-${chainId}`;
    const contracts = getContracts(chainId);
    if (!contracts) {
      set({ ...EMPTY_STATE, walletKey, error: "Unsupported network" });
      return;
    }
    const supportedChainId = chainId as DashboardChainId;

    const state = get();
    if (!force && state.walletKey === walletKey && state.isRefreshing) return;

    // A different wallet or network means everything on screen belongs to
    // somewhere else: drop it now rather than leaving it up until (or, on
    // failure, long after) the new data arrives.
    const isContextChange = state.walletKey !== walletKey;

    set((prev) => ({
      ...(isContextChange ? EMPTY_STATE : prev),
      walletKey,
      isLoading: isContextChange || prev.lastFetchedAt == null,
      isRefreshing: true,
      lastFetchedAt: isContextChange ? null : prev.lastFetchedAt,
      error: null,
    }));

    try {
      const now = Math.floor(Date.now() / 1000);
      const timingPromise = fetch(
        `/api/scheduler/dca-timing?user=${encodeURIComponent(address)}&chainId=${encodeURIComponent(chainId)}`,
        { cache: "no-store" },
      )
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as {
            ok: boolean;
            serverTime: number;
            chainTime: number;
            scheduleCount: number;
            activeScheduleIds: string[];
            enrolledCount: number;
            plans: Array<{
              scheduleId: string;
              targetToken: string;
              frequency: number;
              amountPerInterval: string;
              lastExecutionTime: number;
              totalAmount: string;
              executedCount: number;
              active: boolean;
              dueTimestamp: number;
              ready: boolean;
              isEnrolledForAutoExecution: boolean;
              executionMode: "auto" | "manual" | null;
            }>;
          };
        })
        .catch(() => null);
      const [
        usdcBalanceResult,
        scheduleCountResult,
        activeSchedulesResult,
        enrolledCountResult,
        timingSnapshot,
      ] = await Promise.all([
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
          timingPromise,
        ]);

      const scheduleCount =
        timingSnapshot?.ok && Number.isSafeInteger(timingSnapshot.scheduleCount)
          ? timingSnapshot.scheduleCount
          : Number(scheduleCountResult ?? 0n);
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
              // multicall takes chainId at the top level — the per-contract
              // chainId below is ignored, so without this the plan reads go to
              // whatever chain wagmi is currently on instead of the requested one.
              chainId: supportedChainId,
              contracts: planContracts,
            })
          : [];

      const tokenList = getTokenList(chainId);
      const timingByScheduleId = new Map(
        timingSnapshot?.plans?.map((plan) => [plan.scheduleId, plan]) ?? [],
      );

      const plans = allScheduleIds
        .map<DashboardPlanRecord | null>((scheduleId, index) => {
          const baseIndex = index * 3;
          const scheduleResult = planResults[baseIndex];
          const readyResult = planResults[baseIndex + 1];
          const enrolledResult = planResults[baseIndex + 2];

          if (
            (!scheduleResult || scheduleResult.status !== "success") &&
            !timingByScheduleId.has(scheduleId.toString())
          ) {
            return null;
          }

          const schedule = (
            scheduleResult?.status === "success" ? scheduleResult.result : null
          ) as {
            targetToken: string;
            frequency: number;
            amountPerInterval: bigint;
            lastExecutionTime: bigint;
            totalAmount: bigint;
            executedCount: bigint;
            active: boolean;
          } | null;
          const backendTiming = timingByScheduleId.get(scheduleId.toString());
          const authoritativeSchedule = backendTiming
            ? {
                targetToken: backendTiming.targetToken,
                frequency: backendTiming.frequency,
                amountPerInterval: BigInt(backendTiming.amountPerInterval),
                lastExecutionTime: BigInt(backendTiming.lastExecutionTime),
                totalAmount: BigInt(backendTiming.totalAmount),
                executedCount: BigInt(backendTiming.executedCount),
                active: backendTiming.active,
              }
            : schedule!;

          const matchedToken = tokenList.find(
            (token) =>
              token.address.toLowerCase() ===
              String(authoritativeSchedule.targetToken).toLowerCase(),
          );
          const tokenSymbol =
            matchedToken?.symbol ??
            `${String(authoritativeSchedule.targetToken).slice(0, 8)}...${String(authoritativeSchedule.targetToken).slice(-6)}`;
          const tokenName = matchedToken?.name;
          const tokenLogo = getTokenLogoUrl(
            chainId,
            String(authoritativeSchedule.targetToken),
            matchedToken?.logo,
          );

          const frequencyNum = Number(authoritativeSchedule.frequency);
          const intervalSeconds = DCA_FREQUENCY_INTERVALS[frequencyNum] ?? 86400;
          const amountNum = Number(formatUnits(authoritativeSchedule.amountPerInterval, 6));
          const remainingNum = Number(formatUnits(authoritativeSchedule.totalAmount, 6));
          const executedCount = Number(authoritativeSchedule.executedCount);
          const originalTotalNum = remainingNum + amountNum * executedCount;
          const totalSchedules = Math.max(1, Math.ceil(originalTotalNum / Math.max(amountNum, 0.000001)));
          const contractDueTimestamp =
            backendTiming?.dueTimestamp ??
            Number(authoritativeSchedule.lastExecutionTime) + intervalSeconds;
          const isEnrolledForAutoExecution =
            backendTiming?.isEnrolledForAutoExecution ??
            (enrolledResult?.status === "success"
              ? Boolean(enrolledResult.result)
              : false);
          const nextExecutionTimestamp = contractDueTimestamp;

          let status: "active" | "cancelled" | "ended" = "active";
          if (executedCount >= totalSchedules || remainingNum <= 0) status = "ended";
          else if (!authoritativeSchedule.active) status = "cancelled";

          return {
            id: scheduleId.toString(),
            scheduleId,
            targetTokenAddress: String(authoritativeSchedule.targetToken),
            targetToken: tokenSymbol,
            tokenName: tokenName ?? undefined,
            tokenLogo: tokenLogo ?? undefined,
            amountPerInterval: amountNum.toFixed(2),
            frequency: REVERSE_FREQUENCY_MAP[frequencyNum] || "Unknown",
            totalDeposited: originalTotalNum.toFixed(2),
            totalExecuted: (executedCount * amountNum).toFixed(2),
            nextRun: formatNextRun(
              nextExecutionTimestamp,
              timingSnapshot?.chainTime ?? now,
            ),
            executionProgress:
              status === "active"
                ? Math.min(100, (executedCount / totalSchedules) * 100)
                : (executedCount / totalSchedules) * 100,
            status,
            contractDueTimestamp,
            nextExecutionTimestamp,
            isReady:
              backendTiming?.ready ??
              (readyResult?.status === "success" ? Boolean(readyResult.result) : false),
            isEnrolledForAutoExecution:
              status === "active" && isEnrolledForAutoExecution,
            executionMode:
              status === "active" ? backendTiming?.executionMode ?? null : null,
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

      // The user may have switched wallet or network while this was in flight.
      // Writing now would put the old network's numbers back on screen, so drop
      // the response — the fetch for the current context is already running.
      if (get().walletKey !== walletKey) return;

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
        activePlanCount:
          timingSnapshot?.ok && Array.isArray(timingSnapshot.activeScheduleIds)
            ? timingSnapshot.activeScheduleIds.length
            : activeSchedules.length,
        scheduleCount:
          timingSnapshot?.ok && Number.isSafeInteger(timingSnapshot.scheduleCount)
            ? timingSnapshot.scheduleCount
            : scheduleCount,
        activeSchedules:
          timingSnapshot?.ok && Array.isArray(timingSnapshot.activeScheduleIds)
            ? timingSnapshot.activeScheduleIds.map((id) => BigInt(id))
            : activeSchedules,
        allScheduleIds,
        enrolledCount:
          timingSnapshot?.ok && Number.isSafeInteger(timingSnapshot.enrolledCount)
            ? timingSnapshot.enrolledCount
            : Number(enrolledCountResult ?? 0n),
        plans,
        historyPoints,
        backendClockOffsetSeconds:
          timingSnapshot?.ok && Number.isFinite(timingSnapshot.serverTime)
            ? timingSnapshot.serverTime - Math.floor(Date.now() / 1000)
            : 0,
        backendChainClockOffsetSeconds:
          timingSnapshot?.ok && Number.isFinite(timingSnapshot.chainTime)
            ? timingSnapshot.chainTime - Math.floor(Date.now() / 1000)
            : 0,
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: Date.now(),
        error: null,
      });
    } catch (error) {
      if (get().walletKey !== walletKey) return;
      set((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard data",
      }));
    }
  },
}));
