"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
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

function NextRunCountdown({
  targetTimestamp,
  clockOffsetSeconds,
}: {
  targetTimestamp: number;
  clockOffsetSeconds: number;
}) {
  const [display, setDisplay] = useState(() => {
    const now = Math.floor(Date.now() / 1000) + clockOffsetSeconds;
    return formatCountdownLong(Math.max(0, targetTimestamp - now));
  });

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000) + clockOffsetSeconds;
      setDisplay(formatCountdownLong(Math.max(0, targetTimestamp - now)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTimestamp, clockOffsetSeconds]);

  return <span>{display}</span>;
}

function PlanTokenLogo({
  logo,
  symbol,
  name,
}: {
  logo?: string;
  symbol: string;
  name?: string;
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
    <span className="pc-logo">
      {showImg ? (
        <img src={logo} alt="" width={56} height={56} onError={() => setImgFailed(true)} />
      ) : (
        <span aria-hidden>{placeholder}</span>
      )}
    </span>
  );
}

const PLAN_CARD_THEMES = ["mint", "lavender", "peach", "sky"] as const;

/* The four states a card can be in. `ready` is not a contract status — it is
   an active plan whose cooldown has elapsed — but it is the state a user most
   needs to spot, so it gets its own visual treatment. */
type PlanVisualState = "ready" | "active" | "ended" | "cancelled";

const STATE_LABEL: Record<PlanVisualState, string> = {
  ready: "Ready",
  active: "Active",
  ended: "Completed",
  cancelled: "Cancelled",
};

/* The corner flag on the token: a shape per state, so it reads before the words do. */
const STATE_FLAG_PATH: Record<PlanVisualState, string> = {
  ready: "M8 5v14l11-7L8 5z",
  active: "M12 7v5l3 2",
  ended: "M5 13l4 4L19 7",
  cancelled: "M6 6l12 12M18 6L6 18",
};

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
  const backendChainClockOffsetSeconds = useDashboardStore(
    (state) => state.backendChainClockOffsetSeconds,
  );
  const [now, setNow] = useState(
    () => Math.floor(Date.now() / 1000) + backendChainClockOffsetSeconds,
  );

  useEffect(() => {
    if (plan.status !== "active" || plan.nextExecutionTimestamp <= 0) return;
    const update = () =>
      setNow(Math.floor(Date.now() / 1000) + backendChainClockOffsetSeconds);
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [plan.status, plan.nextExecutionTimestamp, backendChainClockOffsetSeconds]);

  // The contract readiness value stored on the plan is only a snapshot from
  // the last dashboard fetch. Derive time-based readiness from the live clock
  // so this button changes at the same instant as the countdown and Execute All.
  const isContractReady =
    plan.status === "active" &&
    (plan.isReady || plan.contractDueTimestamp <= now);
  const state: PlanVisualState =
    plan.status === "cancelled"
      ? "cancelled"
      : plan.status === "ended"
        ? "ended"
        : isContractReady
          ? "ready"
          : "active";
  const isDone = state === "ended" || state === "cancelled";

  const amount = Number(plan.amountPerInterval) || 0;
  const deposited = Number(plan.totalDeposited) || 0;
  const executed = Number(plan.totalExecuted) || 0;
  const remaining = Math.max(0, deposited - executed);
  const buysDone = amount > 0 ? Math.round(executed / amount) : 0;
  const buysTotal = amount > 0 ? Math.max(buysDone, Math.round(deposited / amount)) : 0;
  const progress =
    plan.status === "ended" ? 100 : Math.max(0, Math.min(100, plan.executionProgress));

  // The bar fills from empty to `progress` once the card is mounted, so a list
  // of plans fills in rather than snapping to its final state.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const shownProgress = filled ? progress : 0;

  const handlePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--mx",
      `${((event.clientX - rect.left) / rect.width) * 100}%`,
    );
    event.currentTarget.style.setProperty(
      "--my",
      `${((event.clientY - rect.top) / rect.height) * 100}%`,
    );
  };

  return (
    <div
      onMouseMove={handlePointerMove}
      className={[
        "plan-card-sweet",
        `plan-card-${theme}`,
        plan.isEnrolledForAutoExecution ? "plan-card-autoexec" : "",
        plan.status === "active" ? "pc-live" : "pc-dim",
        `pc-${state}`,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--pc-delay": `${cardIndex * 90}ms`,
          "--pc-fill": `${shownProgress}%`,
          "--pc-tick": buysTotal > 1 && buysTotal <= 40 ? `${100 / buysTotal}%` : "100%",
        } as CSSProperties
      }
    >
      <div className="pc-visual" aria-hidden>
        <span className="pc-mesh" />
        <svg className="pc-spark" viewBox="0 0 220 80" preserveAspectRatio="none">
          <path d="M0 68 C 30 66, 42 54, 62 56 S 96 40, 116 44 S 150 22, 172 26 S 204 8, 220 6" />
        </svg>
        {state === "cancelled" && <span className="pc-hatch" />}
        {isDone && (
          <span className="pc-stamp">
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d={STATE_FLAG_PATH[state]} />
            </svg>
          </span>
        )}
        <span className="pc-glow" />
        <span className="pc-sheen" />
      </div>
      <span className="pc-rail" aria-hidden />
      {plan.isEnrolledForAutoExecution && <span className="pc-edge" aria-hidden />}

      <div className="pc-body">
        <div className="pc-medallion">
          <PlanTokenLogo logo={plan.tokenLogo} symbol={plan.targetToken} name={plan.tokenName} />
          <span className="pc-flag" title={STATE_LABEL[state]}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={STATE_FLAG_PATH[state]}
                fill={state === "ready" ? "currentColor" : "none"}
              />
              {state === "active" && (
                <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
              )}
            </svg>
          </span>
        </div>

        <div className="pc-main">
          <p className="pc-route">
            <span>${plan.amountPerInterval} USDC</span>
            <svg className="pc-route-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 12h14m-5-5 5 5-5 5" />
            </svg>
            <span className="pc-route-out">{plan.targetToken}</span>
          </p>

          <div className="pc-meta">
            <span className="pc-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              Every {plan.frequency}
            </span>

            {plan.status === "active" && (
              <span
                className={`pc-chip pc-chip-time ${
                  !isContractReady ? "" : "pc-chip-now"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Next buy{" "}
                <b>
                  {!isContractReady ? (
                    <NextRunCountdown
                      targetTimestamp={plan.nextExecutionTimestamp}
                      clockOffsetSeconds={backendChainClockOffsetSeconds}
                    />
                  ) : (
                    "now"
                  )}
                </b>
              </span>
            )}

            {buysTotal > 0 && (
              <span className="pc-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {buysDone} of {buysTotal} buys
              </span>
            )}
          </div>

          <div className="pc-trackrow">
            <div className="pc-track">
              <span className="pc-track-fill" />
              {buysTotal > 1 && buysTotal <= 40 && <span className="pc-track-ticks" />}
            </div>
            <span className="pc-pct">{Math.floor(progress)}%</span>
          </div>

          <div className="pc-figures">
            <span>
              Swapped <b>${plan.totalExecuted}</b>
            </span>
            <span>
              Remaining <b>${remaining.toFixed(2)}</b>
            </span>
            <span>
              Committed <b>${plan.totalDeposited}</b>
            </span>
          </div>
        </div>

        <div className="pc-side">
          <div className="pc-badges">
            {plan.isEnrolledForAutoExecution && (
              <span
                className="pc-badge-auto"
                title="This plan is enrolled for auto-execution by the backend executor."
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-exec
              </span>
            )}
            <span className="pc-badge-state">
              <span className="pc-badge-dot" aria-hidden />
              {plan.executionMode === "auto"
                ? "Auto Executing..."
                : STATE_LABEL[state]}
            </span>
          </div>

          <div className="pc-actions">
            {userAddress && plan.status === "active" && (
              <ExecuteSwapButton
                userAddress={userAddress}
                scheduleId={plan.scheduleId}
                isReady={isContractReady}
                onSuccess={onExecuteSuccess}
                disabled={isExecutingAll || !isContractReady}
                executionMode={plan.executionMode}
              />
            )}
            <Link
              href={`/dashboard/plan/${plan.id}`}
              className="ss-btn ss-btn-soft ss-btn-sm ss-btn-gear min-w-[130px]"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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

/* Bar heights for the accumulation loop — hand-picked rather than random so
   the curve rises with a dip in it, the way a real position does. */
const CREATE_CARD_BARS = ["24%", "38%", "31%", "52%", "46%", "72%", "100%"];

function CreatePlanCard({ onAddPlan }: { onAddPlan?: () => void }) {
  return (
    <div className="pn-empty">
      <svg className="pn-dash" aria-hidden>
        <rect x="0" y="0" width="100%" height="100%" rx="16" />
      </svg>

      <div className="pn-copy">
        <span className="pn-kicker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5-2 2m-5 5-2 2m0-9 2 2m5 5 2 2" />
          </svg>
          Get started
        </span>

        <h3 className="pn-title">Start your first steady buy</h3>
        <p className="pn-body">
          Pick an asset, a USDC amount, and how often to buy. Every tick of the schedule swaps the
          same amount — so the position builds itself while you get on with your day.
        </p>

        <div className="pn-points">
          <span className="pn-point">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Review before signing
          </span>
          <span className="pn-point">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Cancel any time
          </span>
          <span className="pn-point">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Funds stay in your vault
          </span>
        </div>

        <button
          type="button"
          onClick={onAddPlan}
          className="ss-btn dashboard-new-plan-btn pn-cta"
        >
          <span className="dashboard-new-plan-icon" aria-hidden>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Create your first plan
        </button>
      </div>

      {/* One coin per tick of the schedule, one bar where it landed. Each coin
          falls into its own column, so it comes to rest on that bar's top. */}
      <div className="pn-stage" aria-hidden>
        <span className="pn-aura" />
        <span className="pn-floor" />
        <div className="pn-bars">
          {CREATE_CARD_BARS.map((height, i) => (
            <span key={height} style={{ "--i": i, "--h": height } as CSSProperties} />
          ))}
          <div className="pn-coins">
            {CREATE_CARD_BARS.map((height, i) => (
              <span
                key={height}
                className="pn-coin"
                style={{ "--i": i, "--h": height } as CSSProperties}
              >
                $
              </span>
            ))}
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
  const backendClockOffsetSeconds = useDashboardStore(
    (state) => state.backendClockOffsetSeconds,
  );
  const backendChainClockOffsetSeconds = useDashboardStore(
    (state) => state.backendChainClockOffsetSeconds,
  );

  const [executingAll, setExecutingAll] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [executeModalItems, setExecuteModalItems] = useState<ExecuteAllModalItem[]>([]);
  const [executionTimeline, setExecutionTimeline] = useState<Record<string, ExecutionStepStatus>>({});
  const [executionErrors, setExecutionErrors] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(
    () => Math.floor(Date.now() / 1000) + backendClockOffsetSeconds,
  );

  useEffect(() => {
    const id = setInterval(
      () =>
        setCurrentTime(
          Math.floor(Date.now() / 1000) + backendClockOffsetSeconds,
        ),
      1000,
    );
    return () => clearInterval(id);
  }, [backendClockOffsetSeconds]);

  const contractCurrentTime =
    currentTime + backendChainClockOffsetSeconds - backendClockOffsetSeconds;

  const refreshData = useCallback(async () => {
    await useDashboardStore.getState().fetchDashboardData({ address, chainId, force: true });
  }, [address, chainId]);

  const readyPlans = useMemo(
    () =>
      plans.filter(
        (plan) =>
          plan.status === "active" &&
          plan.executionMode == null &&
          (plan.isReady ||
            (plan.contractDueTimestamp > 0 &&
              plan.contractDueTimestamp <= contractCurrentTime)),
      ),
    [plans, contractCurrentTime],
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
      <div className="dashboard-panel p-6">
        <div className="rounded-xl border border-dashed border-[var(--hero-muted)]/30 py-12 text-center">
          <p className="text-[var(--hero-muted)]">Connect wallet to view plans</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-panel dashboard-plans-panel p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="dashboard-section-kicker">Automation</p>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Your DCA plans</h2>
            <p className="mt-1 text-sm text-[var(--hero-muted)]">Review schedules, progress, and the next action for each plan.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={isRefreshing}
              data-busy={isRefreshing ? "true" : undefined}
              title="Refresh all data"
              className="ss-btn ss-btn-ghost ss-btn-icon ss-btn-sm ss-btn-cycle"
              aria-label="Refresh all data"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </button>
            {activeSchedules.length >= 2 && (
              <button
                type="button"
                onClick={handleExecuteAll}
                disabled={executingAll || isPending || readyPlans.length === 0}
                data-loading={executingAll ? "true" : undefined}
                title={
                  readyPlans.length === 0
                    ? "No plans ready to execute (in cooldown)"
                    : `Execute ${readyPlans.length} ready plan(s)`
                }
                className="ss-btn ss-btn-success ss-btn-sm ss-btn-bolt"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {executingAll ? "Executing..." : `Execute All${readyPlans.length > 0 ? ` (${readyPlans.length})` : ""}`}
              </button>
            )}
            <button type="button" onClick={onAddPlan} className="ss-btn ss-btn-soft ss-btn-sm">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New plan
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-[var(--hero-muted)]/10 p-4">
            <LoadingSkeleton />
          </div>
        ) : scheduleCount === 0 || plans.length === 0 ? (
          <CreatePlanCard onAddPlan={onAddPlan} />
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
