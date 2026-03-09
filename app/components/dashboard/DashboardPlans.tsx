"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { useContracts } from "@/app/hooks";
import { useDashboardStore, type DashboardPlanRecord } from "@/app/store/useDashboardStore";
import { ExecuteSwapButton } from "../dca/ExecuteSwapButton";
import {
  ExecuteAllModal,
  type ExecuteAllModalItem,
  type ExecutionStepStatus,
} from "./ExecuteAllModal";
import { LoadingSkeleton } from "../LoadingComponents";
import { DCA_VAULT_ABI } from "@/config/abis";

interface DashboardPlansProps {
  onAddPlan?: () => void;
}

function formatCountdownLong(secondsTotal: number): string {
  if (secondsTotal <= 0) return "Now";
  const SEC = 1;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;

  const months = Math.floor(secondsTotal / MONTH);
  let r = secondsTotal % MONTH;
  const days = Math.floor(r / DAY);
  r %= DAY;
  const hours = Math.floor(r / HOUR);
  r %= HOUR;
  const minutes = Math.floor(r / MIN);
  const seconds = Math.floor(r % MIN);

  const parts: string[] = [];
  if (months > 0) parts.push(`${months}M`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.length > 0 ? parts.join(" ") : "Now";
}

function NextRunCountdown({ targetTimestamp }: { targetTimestamp: number }) {
  const [display, setDisplay] = useState(() => {
    const now = Math.floor(Date.now() / 1000);
    return formatCountdownLong(Math.max(0, targetTimestamp - now));
  });

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      setDisplay(formatCountdownLong(Math.max(0, targetTimestamp - now)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTimestamp]);

  return <span>{display}</span>;
}

function PlanTokenLogo({
  logo,
  symbol,
  name,
  className = "h-12 w-12",
}: {
  logo?: string;
  symbol: string;
  name?: string;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = logo && !imgFailed;
  const fallbackLabel = (name || symbol || "").trim();
  const placeholder =
    fallbackLabel.length >= 2
      ? fallbackLabel.slice(0, 2).toUpperCase()
      : fallbackLabel
        ? fallbackLabel.toUpperCase()
        : "?";

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--hero-primary)] text-lg font-bold text-white ${className}`}
    >
      {showImg ? (
        <img
          src={logo}
          alt=""
          className="h-full w-full object-cover"
          width={48}
          height={48}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span aria-hidden>{placeholder}</span>
      )}
    </span>
  );
}

const PLAN_CARD_THEMES = ["mint", "lavender", "peach", "sky"] as const;

function SchedulePlanCard({
  plan,
  userAddress,
  isExecutingAll,
  onExecuteSuccess,
  cardIndex,
}: {
  plan: DashboardPlanRecord;
  userAddress?: string;
  isExecutingAll?: boolean;
  onExecuteSuccess: () => void;
  cardIndex: number;
}) {
  const theme = PLAN_CARD_THEMES[cardIndex % PLAN_CARD_THEMES.length];
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (plan.status !== "active" || plan.nextExecutionTimestamp <= 0) return;
    const update = () => setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [plan.status, plan.nextExecutionTimestamp]);

  const inCooldown = plan.status === "active" && plan.nextExecutionTimestamp > now;
  const statusLabel =
    plan.status === "cancelled"
      ? "Cancelled"
      : plan.status === "ended"
        ? "Completed"
        : "Active";

  return (
    <div
      className={`plan-card-sweet plan-card-${theme} relative p-4 ${plan.isEnrolledForAutoExecution ? "plan-card-autoexec" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <PlanTokenLogo
            logo={plan.tokenLogo}
            symbol={plan.targetToken}
            name={plan.tokenName}
            className="h-12 w-12"
          />
          <div>
            <p className="font-semibold text-[var(--foreground)]">
              ${plan.amountPerInterval} {plan.targetToken} / {plan.frequency}
            </p>
            <p className="text-sm text-[var(--hero-muted)]">
              Next:{" "}
              {inCooldown ? (
                <NextRunCountdown targetTimestamp={plan.nextExecutionTimestamp} />
              ) : (
                plan.nextRun
              )}{" "}
              · Total deposited: ${plan.totalDeposited}
            </p>

            <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-[var(--hero-muted)]/20">
              <div
                className="h-full bg-gradient-to-r"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, var(--hero-primary), var(--hero-secondary))",
                  width: `${Math.min(100, plan.executionProgress)}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--hero-muted)]">
              {plan.status === "active" && `${Math.floor(plan.executionProgress)}% executed / `}
              {`$${plan.totalExecuted} swapped`}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            {plan.isEnrolledForAutoExecution && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hero-primary)]/30 bg-gradient-to-r from-[var(--hero-primary)]/20 to-[var(--hero-primary)]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--hero-primary)] shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                title="This plan is enrolled for auto-execution by the backend executor."
              >
                <span aria-hidden className="text-sm">⚡</span>
                Auto-exec
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                plan.status === "cancelled"
                  ? "status-badge-cancelled"
                  : plan.status === "ended"
                    ? "status-badge-ended"
                    : "status-badge-active"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  plan.status === "cancelled"
                    ? "bg-red-500"
                    : plan.status === "ended"
                      ? "bg-indigo-500"
                      : "bg-emerald-500"
                }`}
              />
              {statusLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {userAddress && plan.status === "active" && (
              <ExecuteSwapButton
                userAddress={userAddress}
                scheduleId={plan.scheduleId}
                isReady={plan.isReady && !inCooldown}
                onSuccess={onExecuteSuccess}
                disabled={isExecutingAll || inCooldown}
              />
            )}
            <Link
              href={`/dashboard/plan/${plan.id}`}
              className="inline-flex min-w-[130px] items-center justify-center gap-1.5 rounded-lg border border-[var(--hero-muted)]/20 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hero-muted)]/10"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Manage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPlans({ onAddPlan }: DashboardPlansProps) {
  const { address, isConnected } = useAccount();
  const { chainId, contracts } = useContracts();
  const { writeContract, isPending } = useWriteContract();
  const plans = useDashboardStore((state) => state.plans);
  const activeSchedules = useDashboardStore((state) => state.activeSchedules);
  const scheduleCount = useDashboardStore((state) => state.scheduleCount);
  const isLoading = useDashboardStore((state) => state.isLoading);
  const isRefreshing = useDashboardStore((state) => state.isRefreshing);

  const [executingAll, setExecutingAll] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [executeModalItems, setExecuteModalItems] = useState<ExecuteAllModalItem[]>([]);
  const [executionTimeline, setExecutionTimeline] = useState<Record<string, ExecutionStepStatus>>({});
  const [executionErrors, setExecutionErrors] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshData = useCallback(async () => {
    await useDashboardStore.getState().fetchDashboardData({ address, chainId, force: true });
  }, [address, chainId]);

  const readyPlans = useMemo(
    () =>
      plans.filter(
        (plan) =>
          plan.status === "active" &&
          plan.nextExecutionTimestamp > 0 &&
          plan.nextExecutionTimestamp <= currentTime,
      ),
    [plans, currentTime],
  );

  const handleExecuteSuccess = useCallback(() => {
    void refreshData();
  }, [refreshData]);

  const handleExecuteAll = async () => {
    if (!address || readyPlans.length === 0) return;

    const items: ExecuteAllModalItem[] = readyPlans.map((plan) => ({
      scheduleId: plan.id,
      plan: {
        targetToken: plan.targetToken,
        amountPerInterval: plan.amountPerInterval,
        frequency: plan.frequency,
      },
    }));

    const initialTimeline: Record<string, ExecutionStepStatus> = {};
    readyPlans.forEach((plan) => {
      initialTimeline[plan.id] = "pending";
    });

    setExecuteModalItems(items);
    setExecutionTimeline(initialTimeline);
    setExecutionErrors({});
    setShowExecuteModal(true);
    setExecutingAll(true);

    for (const plan of readyPlans) {
      const idStr = plan.id;
      setExecutionTimeline((prev) => ({ ...prev, [idStr]: "executing" }));

      try {
        await new Promise<void>((resolve, reject) => {
          writeContract(
            {
              address: contracts.DCAVault as `0x${string}`,
              abi: DCA_VAULT_ABI,
              functionName: "executeSwap",
              args: [address as `0x${string}`, plan.scheduleId, "0x"],
              chainId,
            },
            {
              onSuccess: () => {
                setExecutionTimeline((prev) => ({ ...prev, [idStr]: "success" }));
                setTimeout(resolve, 1500);
              },
              onError: (err) => {
                const msg = err?.message ?? "Execution failed";
                setExecutionTimeline((prev) => ({ ...prev, [idStr]: "error" }));
                setExecutionErrors((prev) => ({ ...prev, [idStr]: msg }));
                reject(err);
              },
            },
          );
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Execution failed";
        setExecutionTimeline((prev) => ({ ...prev, [idStr]: "error" }));
        setExecutionErrors((prev) => ({ ...prev, [idStr]: msg }));
      }
    }

    setExecutingAll(false);
    await refreshData();
  };

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--background)_0.35,transparent)] p-6 shadow-sm backdrop-blur-xs">
        <div className="rounded-xl border border-dashed border-[var(--hero-muted)]/30 py-12 text-center">
          <p className="text-[var(--hero-muted)]">Connect wallet to view plans</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--background)_0.35,transparent)] p-6 shadow-sm backdrop-blur-xs">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Your DCA plans</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={isRefreshing}
              title="Refresh all data"
              className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--hero-muted)] transition-colors hover:bg-[var(--hero-muted)]/10 hover:text-[var(--hero-primary)] disabled:opacity-50"
              aria-label="Refresh all data"
            >
              <svg className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </button>
            {activeSchedules.length >= 2 && (
              <button
                type="button"
                onClick={handleExecuteAll}
                disabled={executingAll || isPending || readyPlans.length === 0}
                title={
                  readyPlans.length === 0
                    ? "No plans ready to execute (in cooldown)"
                    : `Execute ${readyPlans.length} ready plan(s)`
                }
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {executingAll ? "Executing..." : `Execute All${readyPlans.length > 0 ? ` (${readyPlans.length})` : ""}`}
              </button>
            )}
            <button
              type="button"
              onClick={onAddPlan}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--hero-primary)] hover:underline"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add plan
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-[var(--hero-muted)]/10 p-4">
            <LoadingSkeleton />
          </div>
        ) : scheduleCount === 0 || plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--hero-muted)]/30 py-12 text-center">
            <p className="text-[var(--hero-muted)]">No DCA plans yet</p>
            <button
              type="button"
              onClick={onAddPlan}
              className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--hero-primary)" }}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create your first plan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan, i) => (
              <SchedulePlanCard
                key={`${chainId}-${plan.id}`}
                plan={plan}
                userAddress={address}
                isExecutingAll={executingAll}
                onExecuteSuccess={handleExecuteSuccess}
                cardIndex={i}
              />
            ))}
          </div>
        )}
      </div>

      <ExecuteAllModal
        open={showExecuteModal}
        onClose={() => setShowExecuteModal(false)}
        items={executeModalItems}
        statusMap={executionTimeline}
        errorBySchedule={executionErrors}
        isRunning={executingAll}
      />
    </>
  );
}
