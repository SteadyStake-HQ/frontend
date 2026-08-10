"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useAccount, useConfig } from "wagmi";
import { formatUnits } from "viem";
import { getStableDecimals } from "@/config/contracts";
import {
  useDCASchedule,
  useContracts,
  useStableSymbol,
  usePlanExecutions,
  useTokenPrice,
  formatTokenPrice,
  type PlanExecution,
} from "@/app/hooks";
import { DCA_FREQUENCY_INTERVALS, derivePlanRuns } from "@/app/hooks/useDCAHelpers";
import { Header } from "@/app/components/Header";
import { CancelScheduleButton } from "@/app/components/dca/CancelScheduleButton";
import { ExecuteSwapButton } from "@/app/components/dca/ExecuteSwapButton";
import { LoadingCard } from "@/app/components/LoadingComponents";
import { REVERSE_FREQUENCY_MAP } from "@/lib/constants";
import { getTokenLogoUrl } from "@/lib/token-logo";
import { useSupportedTokens } from "@/app/hooks/useSupportedTokens";
import type { PlanAdminControl, PlanExecutionGate } from "@/app/store/useDashboardStore";

type PlanStatus = "active" | "cancelled" | "ended";

interface PlanDetails {
  id: string;
  token: string;
  tokenDecimals: number;
  tokenLogoUrl?: string;
  amountPerRun: number;
  frequency: string;
  intervalSeconds: number;
  totalDeposited: number;
  invested: number;
  remaining: number;
  status: PlanStatus;
  createdAt: number;
  runsCount: number;
  executedCount: number;
  executionProgress: number;
  contractDueTimestamp: number;
  nextExecutionTimestamp: number;
  estimatedCompletion: number | null;
}

/**
 * What this plan's token is worth now, and what it was worth at its buys.
 *
 * The stamped figures come from `dca_plans`, written at each run (see backend/src/token-price.ts):
 * the price of a past buy is not something any feed will hand back later, so a run that happened
 * before price recording existed — or while every feed was down — simply has no price, and the page
 * says so rather than filling the gap in.
 */
interface PlanPrices {
  /** Market price right now. Null when no feed quotes this token, as on every testnet mock. */
  currentUsd: number | null;
  /** True when the live sources are failing and `currentUsd` is the last good one. */
  currentStale: boolean;
  /** Price at the plan's first priced buy — what the token cost when this plan started buying. */
  startUsd: number | null;
  /** Price at its most recent priced buy. */
  lastUsd: number | null;
  lastAt: string | null;
  /** Mean of the prices stamped on its buys so far. */
  avgUsd: number | null;
  /** Buys carrying a price. Below `executedCount` when some ran without one. */
  pricedCount: number;
}

interface BackendPlanTiming {
  chainClockOffsetSeconds: number;
  /** When the plan can next actually run: the contract cooldown plus any paused-countdown wait. */
  dueTimestamp: number;
  ready: boolean;
  executionMode: "auto" | "manual" | null;
  /** Admin hold stopping auto-execution; null when nothing is holding the plan. */
  adminControl: PlanAdminControl | null;
  /** Remainder of a paused countdown, running since the plan was resumed; null when free. */
  executionGate: PlanExecutionGate | null;
  /** Null when the backend predates price recording, or could not read the plan store. */
  prices: PlanPrices | null;
}

/* ---------- formatting ---------------------------------------------------- */

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const fullDateTime = (unix: number) =>
  new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** mm:ss under an hour, then coarser units — a countdown you can actually read. */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ready now";
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

/** Token amounts vary in scale wildly (1.2 WBTC vs 41,000 DEGEN) — pick the
 *  precision that keeps the number meaningful rather than padding zeros. */
function formatTokenAmount(raw: bigint, decimals: number): string {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return n.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
}

const shortHash = (hash: string) =>
  hash.length > 12 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash;

/* ---------- live bits ------------------------------------------------------ */

/** One clock for the whole page, so the countdown, the interval bar and the
 *  ready-state can never disagree by a tick. */
function useNow(active: boolean, clockOffsetSeconds = 0): number {
  const [now, setNow] = useState(
    () => Math.floor(Date.now() / 1000) + clockOffsetSeconds,
  );
  useEffect(() => {
    if (!active) return;
    const id = setInterval(
      () => setNow(Math.floor(Date.now() / 1000) + clockOffsetSeconds),
      1000,
    );
    return () => clearInterval(id);
  }, [active, clockOffsetSeconds]);
  return now;
}

/** Numbers land, they don't blink into place. */
function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // Snap to the value — but still on the next frame, never synchronously
      // inside the effect body.
      frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }

    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

const RING_RADIUS = 62;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  percent,
  executed,
  total,
}: {
  percent: number;
  executed: number;
  total: number;
}) {
  const [drawn, setDrawn] = useState(0);
  const shownPercent = useCountUp(percent);

  // Paint at zero, then let the CSS transition draw the arc out to its value.
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);

  return (
    <div className="pl-ring">
      <svg viewBox="0 0 150 150" aria-hidden>
        <defs>
          <linearGradient id="pl-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--hero-primary)" />
            <stop offset="55%" stopColor="var(--hero-secondary)" />
            <stop offset="100%" stopColor="var(--hero-accent)" />
          </linearGradient>
        </defs>
        <circle className="pl-ring-track" cx="75" cy="75" r={RING_RADIUS} fill="none" strokeWidth="9" />
        <circle
          className="pl-ring-value"
          cx="75"
          cy="75"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="9"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.min(100, drawn) / 100)}
        />
      </svg>
      <div className="pl-ring-core">
        <span className="pl-ring-pct">{Math.round(shownPercent)}%</span>
        <span className="pl-ring-runs">
          <strong>{executed}</strong> of {total} buys
        </span>
        <span className="pl-ring-label">Complete</span>
      </div>
    </div>
  );
}

/* ---------- derivation ----------------------------------------------------- */

function parseScheduleIdFromParams(params: ReturnType<typeof useParams>): bigint | null {
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (id == null || id === "") return null;
  try {
    const n = BigInt(id);
    return n < 0 ? null : n;
  } catch {
    return null;
  }
}

/** Inline custom properties (--i stagger index, --pl-metric-accent) need a cast:
 *  CSSProperties has no index signature for custom props. */
const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

function PlanShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="landing-pattern-bg plan-page-main min-h-screen border-t border-[var(--hero-muted)]/10 pt-[5.5rem]">
        <div className="pl-shell">
          <Link href="/dashboard" className="pl-back">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>
          {children}
        </div>
      </main>
    </>
  );
}

function PlanMessage({ message }: { message: string }) {
  return (
    <div className="pl-panel pl-rise">
      <div className="pl-empty">
        <span className="pl-empty-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </span>
        <p>{message}</p>
        <span>
          Head back to the dashboard to pick a plan, or start a new one.
        </span>
      </div>
    </div>
  );
}

export default function PlanPage() {
  const params = useParams();
  const { address, isConnected } = useAccount();
  const { chainId } = useContracts();
  const stable = useStableSymbol();
  const wagmiConfig = useConfig();
  const { tokens: supportedTokens } = useSupportedTokens(chainId);
  const scheduleId = parseScheduleIdFromParams(params);

  const { schedule, isEnrolledForAutoExecution, isLoading, refetch } = useDCASchedule(
    scheduleId ?? BigInt(0),
    address,
  );
  const executedCount = schedule ? Number(schedule.executedCount) : 0;
  const {
    executions,
    isLoading: isLoadingHistory,
    unavailable: historyUnavailable,
    partial: historyPartial,
  } = usePlanExecutions(scheduleId, address, executedCount);

  /** Live price of the token this plan buys, refreshed while the page is open. */
  const livePrice = useTokenPrice(
    chainId,
    schedule?.targetToken ? String(schedule.targetToken) : undefined,
  );

  const [logoUrlFallback, setLogoUrlFallback] = useState<string | null>(null);
  const [backendPlanTiming, setBackendPlanTiming] =
    useState<BackendPlanTiming | null>(null);

  useEffect(() => {
    if (!address || scheduleId == null) {
      setBackendPlanTiming(null);
      return;
    }

    let cancelled = false;
    const loadTiming = async () => {
      try {
        const response = await fetch(
          `/api/scheduler/dca-timing?user=${encodeURIComponent(address)}&chainId=${encodeURIComponent(chainId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          chainTime: number;
          plans?: Array<{
            scheduleId: string;
            dueTimestamp: number;
            effectiveDueTimestamp?: number;
            ready: boolean;
            executionMode: "auto" | "manual" | null;
            adminControl: PlanAdminControl | null;
            executionGate?: PlanExecutionGate | null;
            price?: {
              currentUsd?: number | null;
              currentStale?: boolean;
              startUsd?: number | null;
              lastUsd?: number | null;
              lastAt?: string | null;
              avgUsd?: number | null;
              pricedCount?: number;
            } | null;
          }>;
        };
        const timing = data.plans?.find(
          (item) => item.scheduleId === scheduleId.toString(),
        );
        if (!cancelled && timing) {
          setBackendPlanTiming({
            chainClockOffsetSeconds:
              data.chainTime - Math.floor(Date.now() / 1000),
            // Prefer the effective due time: a plan resumed from a pause is still serving the wait
            // it had left, and the contract's own cooldown elapsed during the pause.
            dueTimestamp: timing.effectiveDueTimestamp ?? timing.dueTimestamp,
            ready: timing.ready,
            executionMode: timing.executionMode,
            adminControl: timing.adminControl ?? null,
            executionGate: timing.executionGate ?? null,
            prices: timing.price
              ? {
                  currentUsd: timing.price.currentUsd ?? null,
                  currentStale: timing.price.currentStale === true,
                  startUsd: timing.price.startUsd ?? null,
                  lastUsd: timing.price.lastUsd ?? null,
                  lastAt: timing.price.lastAt ?? null,
                  avgUsd: timing.price.avgUsd ?? null,
                  pricedCount: timing.price.pricedCount ?? 0,
                }
              : null,
          });
        }
      } catch {
        // Fall back to the on-chain due timestamp when the backend is unavailable.
      }
    };

    void loadTiming();
    const id = window.setInterval(loadTiming, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [address, chainId, scheduleId]);

  const explorerUrl = useMemo(
    () => wagmiConfig.chains.find((c) => c.id === chainId)?.blockExplorers?.default,
    [wagmiConfig.chains, chainId],
  );

  const plan = useMemo<PlanDetails | null>(() => {
    if (!schedule || scheduleId == null) return null;

    const targetTokenAddress = String(schedule.targetToken).toLowerCase();
    const match = supportedTokens.find((t) => t.address.toLowerCase() === targetTokenAddress);
    const token =
      match?.symbol ??
      match?.name ??
      (targetTokenAddress.length >= 10
        ? `${targetTokenAddress.slice(0, 6)}…${targetTokenAddress.slice(-4)}`
        : targetTokenAddress);

    const logoUrl = getTokenLogoUrl(chainId, String(schedule.targetToken), match?.logo);

    const frequencyNum = Number(schedule.frequency);
    const intervalSeconds = DCA_FREQUENCY_INTERVALS[frequencyNum] ?? 86400;
    const stableDecimals = getStableDecimals(chainId);
    const amountPerRun = Number(formatUnits(schedule.amountPerInterval, stableDecimals));
    const executedCount = Number(schedule.executedCount);

    // The contract stores what's left, not what was put in: reconstruct the original deposit so
    // "how far along am I" has a denominator. Kept in raw units — see derivePlanRuns for why the
    // dollar figures can't be the ones that get divided.
    const { committed, runsCount } = derivePlanRuns(
      schedule.totalAmount,
      schedule.amountPerInterval,
      executedCount,
    );
    const remaining = Number(formatUnits(schedule.totalAmount, stableDecimals));
    const totalDeposited = Number(formatUnits(committed, stableDecimals));
    const invested = Number(
      formatUnits(schedule.amountPerInterval * schedule.executedCount, stableDecimals),
    );
    const executionProgress = runsCount > 0 ? (executedCount / runsCount) * 100 : 0;

    let status: PlanStatus = "active";
    if (executedCount >= runsCount) status = "ended";
    else if (!schedule.active) status = "cancelled";

    const contractDueTimestamp =
      backendPlanTiming?.dueTimestamp ??
      Number(schedule.lastExecutionTime) + intervalSeconds;
    const nextExecutionTimestamp = contractDueTimestamp;
    const runsLeft = Math.max(0, runsCount - executedCount);
    const estimatedCompletion =
      status === "active" && runsLeft > 0
        ? nextExecutionTimestamp + (runsLeft - 1) * intervalSeconds
        : null;

    // Creation stores its block timestamp. Later executions advance that same
    // field, so count backwards by the completed intervals for the estimate.
    const createdAt =
      Number(schedule.lastExecutionTime) - executedCount * intervalSeconds;

    return {
      id: scheduleId.toString(),
      token,
      tokenDecimals: match?.decimals ?? 18,
      tokenLogoUrl: typeof logoUrl === "string" ? logoUrl : undefined,
      amountPerRun,
      frequency: REVERSE_FREQUENCY_MAP[frequencyNum] || "Unknown",
      intervalSeconds,
      totalDeposited,
      invested,
      remaining,
      status,
      createdAt,
      runsCount,
      executedCount,
      executionProgress,
      contractDueTimestamp,
      nextExecutionTimestamp,
      estimatedCompletion,
    };
  }, [
    schedule,
    scheduleId,
    chainId,
    supportedTokens,
    backendPlanTiming,
  ]);

  const backendChainClockOffsetSeconds =
    backendPlanTiming?.chainClockOffsetSeconds ?? 0;
  // A held plan's countdown is stopped, so the page's clock stops with it rather than running a
  // per-second re-render down to a buy that cannot happen.
  const backendHold = backendPlanTiming?.adminControl ?? null;
  const chainNow = useNow(
    plan?.status === "active" && backendHold == null,
    backendChainClockOffsetSeconds,
  );
  const secondsUntilNext = plan
    ? Math.max(0, plan.nextExecutionTimestamp - chainNow)
    : 0;
  const isDue = plan?.status === "active" && secondsUntilNext === 0;
  const isContractReady =
    plan?.status === "active" &&
    (backendPlanTiming?.ready === true || plan.contractDueTimestamp <= chainNow);

  // Fallback: fetch the logo from the API when the static helper has none (testnets).
  useEffect(() => {
    if (!plan?.token || plan.tokenLogoUrl != null || !schedule?.targetToken) {
      setLogoUrlFallback(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/token-logo-url?chainId=${encodeURIComponent(chainId)}&address=${encodeURIComponent(String(schedule.targetToken))}`,
    )
      .then((r) => r.json())
      .then((data: { logoUrl?: string | null }) => {
        if (!cancelled && data.logoUrl) setLogoUrlFallback(data.logoUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [plan?.token, plan?.tokenLogoUrl, chainId, schedule?.targetToken]);

  if (!isConnected) {
    return (
      <PlanShell>
        <PlanMessage message="Connect your wallet to view this plan." />
      </PlanShell>
    );
  }

  if (scheduleId === null) {
    return (
      <PlanShell>
        <PlanMessage message="That plan doesn't exist." />
      </PlanShell>
    );
  }

  if (isLoading || (!plan && !schedule)) {
    return (
      <PlanShell>
        <LoadingCard message="Loading plan details..." />
      </PlanShell>
    );
  }

  if (!plan) {
    return (
      <PlanShell>
        <PlanMessage message="Plan not found." />
      </PlanShell>
    );
  }

  const logo = plan.tokenLogoUrl ?? logoUrlFallback;
  /**
   * What the token costs right now. The live quote is the primary — it refreshes on its own while
   * the page is open — and the copy the timing poll carries is the fallback, so the board still
   * fills in if /api/token-price cannot be reached but the backend can.
   */
  const currentPriceUsd = livePrice.usd ?? backendPlanTiming?.prices?.currentUsd ?? null;
  const currentPriceStale = livePrice.usd != null ? livePrice.stale : backendPlanTiming?.prices?.currentStale === true;
  // Only meaningful while the plan can still run; a finished plan has no automation left to hold.
  const hold = plan.status === "active" ? backendHold : null;
  // The countdown as the hold caught it — what the plan owes, and what it resumes with.
  const heldCountdownSeconds = hold?.cooldownRemainingSeconds ?? null;
  const statusLabel = hold
    ? hold.status === "paused"
      ? "Admin paused"
      : "Admin stopped"
    : plan.status === "ended"
      ? "Completed"
      : plan.status === "cancelled"
        ? "Cancelled"
        : "Active";
  const statusClass = hold
    ? "status-badge-held"
    : plan.status === "ended"
      ? "status-badge-ended"
      : plan.status === "cancelled"
        ? "status-badge-cancelled"
        : "status-badge-active";

  // How far through the current interval we are — the bar reads as "the wait".
  const intervalElapsed =
    plan.intervalSeconds > 0
      ? Math.min(100, ((plan.intervalSeconds - secondsUntilNext) / plan.intervalSeconds) * 100)
      : 100;

  const runsLeft = Math.max(0, plan.runsCount - plan.executedCount);

  return (
    <PlanShell>
      <section className="pl-hero pl-rise" style={cssVars({ "--i": 0 })}>
        <div className="pl-hero-aura" aria-hidden />

        <header className="pl-hero-head">
          <span className="pl-token">
            <span className="pl-token-ring" aria-hidden />
            {logo ? (
              <img src={logo} alt="" className="pl-token-img" width={56} height={56} />
            ) : (
              <span className="pl-token-fallback" aria-hidden>
                {plan.token.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>

          <div className="pl-title">
            <h1>{plan.token} DCA Plan</h1>
            <p className="pl-route">
              <strong>{usd(plan.amountPerRun)} {stable}</strong>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-5-5 5 5-5 5" />
              </svg>
              <em>{plan.token}</em>
              <span aria-hidden>·</span>
              <span>every {plan.frequency}</span>
            </p>
          </div>

          <div className="pl-badges">
            {isEnrolledForAutoExecution && !hold && (
              <span className="pl-badge pl-badge-auto" title="Executed automatically by the SteadyStake executor">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-exec
              </span>
            )}
            <span
              className={`pl-badge ${statusClass} ${plan.status === "active" && !hold ? "pl-badge-live" : ""}`}
            >
              <span className="pl-badge-dot" aria-hidden />
              {statusLabel}
            </span>
            <span className="pl-badge pl-badge-id">#{plan.id}</span>
          </div>
        </header>

        <div className="pl-hero-body">
          <ProgressRing
            percent={plan.executionProgress}
            executed={plan.executedCount}
            total={plan.runsCount}
          />

          <dl className="pl-metrics">
            <div className="pl-metric" style={cssVars({ "--pl-metric-accent": "var(--hero-primary)" })}>
              <dt>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.66 0-3 .9-3 2s1.34 2 3 2 3 .9 3 2-1.34 2-3 2m0-8V6m0 12v-2m0-8c1.11 0 2.08.4 2.6 1M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" />
                </svg>
                Invested
              </dt>
              <dd>
                {usd(plan.invested)} <small>of {usd(plan.totalDeposited)}</small>
              </dd>
            </div>

            <div className="pl-metric" style={cssVars({ "--pl-metric-accent": "var(--hero-secondary)" })}>
              <dt>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6" />
                </svg>
                Still to buy
              </dt>
              <dd>
                {usd(plan.remaining)} <small>{runsLeft} left</small>
              </dd>
            </div>

            <div className="pl-metric" style={cssVars({ "--pl-metric-accent": "var(--hero-accent)" })}>
              <dt>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                Per buy
              </dt>
              <dd>
                {usd(plan.amountPerRun)} <small>{stable}</small>
              </dd>
            </div>

            <div className="pl-metric" style={cssVars({ "--pl-metric-accent": "var(--hero-primary)" })}>
              <dt>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                </svg>
                Cadence
              </dt>
              <dd>
                {plan.frequency} <small>between buys</small>
              </dd>
            </div>
          </dl>
        </div>

        {/* A countdown promises the plan fires at zero. A held plan will not fire, so the counter
            stops where the hold caught it: the same strip, standing still, showing the wait the
            plan still owes rather than one running down to nothing. */}
        {plan.status === "active" && hold && (
          <div className="pl-next is-paused">
            <span className="pl-next-icon" aria-hidden>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 6.5v11M14.5 6.5v11" />
              </svg>
            </span>

            <div className="pl-next-copy">
              <p>Countdown stopped</p>
              <div className="pl-next-time">
                {heldCountdownSeconds == null
                  ? "Paused"
                  : heldCountdownSeconds > 0
                    ? `${formatCountdown(heldCountdownSeconds)} left`
                    : "Was due"}
              </div>
            </div>

            <p className="pl-next-note">
              {heldCountdownSeconds != null && heldCountdownSeconds > 0
                ? "Paused with this much of the wait to go. Nothing is counting down — if an admin resumes the plan, the next buy is this far away again."
                : "The countdown is stopped while this plan is on hold."}
            </p>
          </div>
        )}

        {plan.status === "active" && !hold && (
          <div className="pl-next">
            <span className={`pl-next-icon ${isDue ? "is-due" : ""}`} aria-hidden>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isDue ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                )}
              </svg>
            </span>

            <div className="pl-next-copy">
              <p>Next buy</p>
              <div className={`pl-next-time ${isDue ? "is-due" : ""}`}>
                {formatCountdown(secondsUntilNext)}
              </div>
            </div>

            <div className="pl-next-bar" role="presentation">
              <div className="pl-next-fill" style={{ width: `${intervalElapsed}%` }} />
            </div>
          </div>
        )}

        <div className="pl-actions">
          {plan.status === "active" && hold ? (
            <>
              <div className="pl-closed pl-closed-held" role="status">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="9" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M9.5 9.5v5M14.5 9.5v5" />
                </svg>
                <span>
                  <b>
                    {hold.status === "paused"
                      ? "An admin paused this plan."
                      : "An admin stopped automation for this plan."}
                  </b>{" "}
                  Automatic buys are on hold — please contact the admin.
                  {hold.reason ? (
                    <span className="pl-closed-reason">Reason: {hold.reason}</span>
                  ) : null}
                </span>
              </div>
              {/* The hold is off-chain and never touches the deposit, so the owner keeps the one
                  action that is unambiguously theirs: cancelling and taking their deposit back. */}
              {address && <CancelScheduleButton scheduleId={scheduleId} />}
            </>
          ) : plan.status === "active" && address ? (
            <>
              <ExecuteSwapButton
                userAddress={address}
                scheduleId={scheduleId}
                isReady={isContractReady}
                onSuccess={() => refetch?.()}
                disabled={!isContractReady}
                executionMode={backendPlanTiming?.executionMode ?? null}
              />
              <span className="pl-actions-note">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                {isEnrolledForAutoExecution
                  ? "This plan runs automatically when its on-chain countdown reaches zero."
                  : "Runs when you execute it, or enrol it for auto-execution."}
              </span>
              <CancelScheduleButton scheduleId={scheduleId} />
            </>
          ) : plan.status === "cancelled" ? (
            <div className="pl-closed pl-closed-cancelled">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
              </svg>
              This plan was cancelled. Any unspent {stable} was returned to your wallet.
            </div>
          ) : (
            <div className="pl-closed pl-closed-ended">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
              </svg>
              Plan complete — all {plan.runsCount} buys executed.
            </div>
          )}
        </div>
      </section>

      <div className="pl-facts pl-rise" style={cssVars({ "--i": 1 })}>
        <div className="pl-fact">
          <dt>Total deposited</dt>
          <dd>{usd(plan.totalDeposited)}</dd>
        </div>
        <div className="pl-fact">
          <dt>Started</dt>
          <dd>{shortDate(plan.createdAt)}</dd>
        </div>
        <div className="pl-fact">
          <dt>Buys done</dt>
          <dd>
            {plan.executedCount} / {plan.runsCount}
          </dd>
        </div>
        <div className="pl-fact">
          <dt>Est. finish</dt>
          <dd>{plan.estimatedCompletion ? shortDate(plan.estimatedCompletion) : "—"}</dd>
        </div>
      </div>

      <PlanPriceBoard
        token={plan.token}
        currentUsd={currentPriceUsd}
        currentStale={currentPriceStale}
        prices={backendPlanTiming?.prices ?? null}
        executedCount={plan.executedCount}
      />

      <section className="pl-panel pl-rise" style={cssVars({ "--i": 3 })}>
        <div className="pl-panel-head">
          <div>
            <h2>Execution history</h2>
            <p>
              {plan.executedCount === 0
                ? "Nothing has run yet."
                : `${plan.executedCount} ${plan.executedCount === 1 ? "buy" : "buys"} settled on-chain.`}
            </p>
          </div>
          {explorerUrl && address && (
            <a
              href={`${explorerUrl.url}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ss-btn ss-btn-soft ss-btn-sm"
            >
              {explorerUrl.name}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>

        <div className="pl-panel-body">
          <PlanHistory
            plan={plan}
            executions={executions}
            isLoading={isLoadingHistory}
            unavailable={historyUnavailable}
            partial={historyPartial}
            explorerBaseUrl={explorerUrl?.url}
            now={chainNow}
          />
        </div>
      </section>
    </PlanShell>
  );
}

/* ---------- prices --------------------------------------------------------- */

/** Percentage change from `from` to `to`, or null when either side is unknown. */
function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from <= 0) return null;
  return ((to - from) / from) * 100;
}

/** A signed percentage, tinted by direction. Zero is neither up nor down. */
function PriceDelta({ pct, label }: { pct: number | null; label: string }) {
  if (pct == null) return null;
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  const tone = rounded > 0 ? "is-up" : rounded < 0 ? "is-down" : "is-flat";
  const sign = rounded > 0 ? "+" : "";
  return (
    <span className={`pl-delta ${tone}`}>
      {rounded === 0 ? "unchanged" : `${sign}${rounded.toFixed(rounded > -10 && rounded < 10 ? 2 : 1)}%`}
      <em>{label}</em>
    </span>
  );
}

/**
 * What this plan's token costs now, next to what it cost at the plan's buys.
 *
 * These four numbers are the point of a DCA plan and none of them are on-chain: the price at a buy
 * is stamped when that buy runs (backend/src/token-price.ts) because no feed will report it after
 * the fact. So a plan whose runs predate price recording shows blanks here, and says why, rather
 * than back-filling numbers nobody measured.
 *
 * The average is the mean of the prices its buys were made at — the figure "am I buying this cheaper
 * than it is now" is asking about. It is not a cost basis: fees and slippage mean what the plan
 * actually paid per token is a little worse, and the execution history below is where the amounts
 * really received are listed.
 */
function PlanPriceBoard({
  token,
  currentUsd,
  currentStale,
  prices,
  executedCount,
}: {
  token: string;
  currentUsd: number | null;
  currentStale: boolean;
  prices: PlanPrices | null;
  executedCount: number;
}) {
  const startUsd = prices?.startUsd ?? null;
  const avgUsd = prices?.avgUsd ?? null;
  const lastUsd = prices?.lastUsd ?? null;
  const pricedCount = prices?.pricedCount ?? 0;
  /**
   * The plan store could not be read, so nothing is known about past buys — a different thing from
   * knowing they carry no price. "We can't see it right now" and "it was never recorded" have
   * different fixes, so they get different words.
   */
  const storeUnreadable = prices == null;
  /** Why a stamped figure is missing, in the order the reasons apply. */
  const missingReason = storeUnreadable
    ? "Can't be read right now."
    : executedCount === 0
      ? "No buys yet."
      : "Not recorded.";

  // Nothing to show and nothing to explain: a plan that has never run has no buy prices by
  // definition, and if no feed quotes the token either then the whole board would be blank.
  if (currentUsd == null && pricedCount === 0 && executedCount === 0 && !storeUnreadable) return null;

  const currentLabel = formatTokenPrice(currentUsd);
  const startLabel = formatTokenPrice(startUsd);
  const avgLabel = formatTokenPrice(avgUsd);
  const lastLabel = formatTokenPrice(lastUsd);

  return (
    <section className="pl-panel pl-prices-panel pl-rise" style={cssVars({ "--i": 2 })}>
      <div className="pl-panel-head">
        <div>
          <h2>{token} price</h2>
          <p>
            {storeUnreadable
              ? "Live price now. Recorded buy prices are unavailable while the plan store can't be reached."
              : pricedCount === 0
                ? "Live price now. Prices are recorded from the next buy onwards."
                : `Live price now, against the ${pricedCount === 1 ? "price" : "prices"} recorded at ${
                    pricedCount === 1 ? "this plan's buy" : `this plan's ${pricedCount} buys`
                  }.`}
          </p>
        </div>
      </div>

      <div className="pl-panel-body">
        <dl className="pl-prices">
          <div className="pl-price is-now">
            <dt>Price now</dt>
            <dd>
              {currentLabel ?? "—"}
              {currentLabel != null && currentStale && <small title="Live feeds are not answering; this is the last known price.">last known</small>}
            </dd>
            {currentLabel == null && <span className="pl-price-note">No feed quotes this token.</span>}
          </div>

          <div className="pl-price">
            <dt>When this plan started</dt>
            <dd>{startLabel ?? "—"}</dd>
            {startLabel != null ? (
              <PriceDelta pct={pctChange(startUsd, currentUsd)} label="since first buy" />
            ) : (
              <span className="pl-price-note">{missingReason}</span>
            )}
          </div>

          <div className="pl-price">
            <dt>Average across your buys</dt>
            <dd>{avgLabel ?? "—"}</dd>
            {avgLabel != null ? (
              // Price now against the average bought at: above the average and the position is up
              // on what it was bought for, below it and the plan is still buying the dip.
              <PriceDelta pct={pctChange(avgUsd, currentUsd)} label="vs your average" />
            ) : (
              <span className="pl-price-note">
                {storeUnreadable ? missingReason : executedCount === 0 ? "Starts with your first buy." : "No prices recorded yet."}
              </span>
            )}
          </div>

          <div className="pl-price">
            <dt>At your last buy</dt>
            <dd>{lastLabel ?? "—"}</dd>
            {lastLabel != null ? (
              <span className="pl-price-note">
                {prices?.lastAt ? fullDateTime(Math.floor(new Date(prices.lastAt).getTime() / 1000)) : "Recorded"}
              </span>
            ) : (
              <span className="pl-price-note">
                {storeUnreadable ? missingReason : executedCount === 0 ? "Nothing has run yet." : "Not recorded."}
              </span>
            )}
          </div>
        </dl>

        {/* A plan can have more buys than prices: recording started partway through its life, or a
            run happened while every feed was down. Say so — an average over 3 of 10 buys is a
            different claim from an average over all of them. */}
        {!storeUnreadable && executedCount > 0 && pricedCount < executedCount && (
          <p className="pl-note">
            {pricedCount === 0
              ? `None of this plan's ${executedCount} buys carry a recorded price — they ran before prices were recorded, or while no feed could quote ${token}.`
              : `${pricedCount} of ${executedCount} buys carry a recorded price, so the average above covers those buys only.`}
          </p>
        )}
      </div>
    </section>
  );
}

/* ---------- history -------------------------------------------------------- */

/** A settled buy. Null fields mean "we know it ran, but the RPC wouldn't tell
 *  us the details" — the row still renders, it just can't link to a tx. */
interface HistoryRow {
  index: number;
  txHash: `0x${string}` | null;
  timestamp: number | null;
  usdcAmount: bigint | null;
  tokenOut: bigint | null;
}

function PlanHistory({
  plan,
  executions,
  isLoading,
  unavailable,
  partial,
  explorerBaseUrl,
  now,
}: {
  plan: PlanDetails;
  executions: PlanExecution[];
  isLoading: boolean;
  unavailable: boolean;
  partial: boolean;
  explorerBaseUrl?: string;
  now: number;
}) {
  const stable = useStableSymbol();
  const { chainId } = useContracts();
  if (plan.executedCount === 0 && plan.status !== "active") {
    return (
      <div className="pl-empty">
        <span className="pl-empty-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 16.5A7 7 0 1 1 18.5 14M19 9v5h-5" />
          </svg>
        </span>
        <p>No buys were executed</p>
        <span>This plan closed before its first scheduled run.</span>
      </div>
    );
  }

  if (isLoading && plan.executedCount > 0 && executions.length === 0) {
    return (
      <div className="pl-empty">
        <span className="pl-empty-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="animate-spin">
            <path strokeLinecap="round" strokeWidth="1.8" d="M21 12a9 9 0 0 0-9-9" />
          </svg>
        </span>
        <p>Reading the chain…</p>
        <span>Pulling this plan&apos;s swap events from the block explorer&apos;s node.</span>
      </div>
    );
  }

  // Real logs are the truth. Whatever they don't cover — because the RPC refused
  // the query, or because the scan budget ran out before the oldest run — is
  // filled in from the schedule the contract implies: same rows, no tx links.
  const logged: HistoryRow[] = executions.map((e) => ({
    index: e.index,
    txHash: e.txHash,
    timestamp: e.timestamp,
    usdcAmount: e.usdcAmount,
    tokenOut: e.tokenOut,
  }));

  const oldestLogged = logged.length > 0 ? logged[0].index : plan.executedCount + 1;
  const derived: HistoryRow[] = Array.from({ length: oldestLogged - 1 }, (_, i) => ({
    index: i + 1,
    txHash: null,
    // Runs sit one interval apart, counted back from the most recent one.
    timestamp: plan.nextExecutionTimestamp - (plan.executedCount - i) * plan.intervalSeconds,
    usdcAmount: null,
    tokenOut: null,
  }));

  const rows = [...derived, ...logged];
  const incomplete = derived.length > 0;

  // An overdue plan has a next-run time in the past. Projecting the runs after it
  // from that stale timestamp would stamp every one of them "Due now"; they only
  // become due once the one ahead of them has actually run, so project forward
  // from the moment the next buy can realistically happen.
  const nextDue = plan.nextExecutionTimestamp <= now;
  const projectionBase = Math.max(now, plan.nextExecutionTimestamp);
  const upcoming =
    plan.status === "active" && plan.runsCount > plan.executedCount
      ? Array.from({ length: Math.min(3, plan.runsCount - plan.executedCount) }, (_, k) => ({
          index: plan.executedCount + k + 1,
          at: projectionBase + k * plan.intervalSeconds,
          due: k === 0 && nextDue,
        }))
      : [];

  return (
    <>
      <div className="pl-timeline">
        {[...rows].reverse().map((row, i) => (
          <div key={`done-${row.index}`} className="pl-row" style={cssVars({ "--i": i })}>
            <span className="pl-node" aria-hidden />
            <div className="pl-row-main">
              <div className="pl-row-title">
                Buy #{row.index}
                <span>·</span>
                {usd(
                  row.usdcAmount != null ? Number(formatUnits(row.usdcAmount, getStableDecimals(chainId))) : plan.amountPerRun,
                )}{" "}
                {stable}
                {row.tokenOut != null && row.tokenOut > 0n && (
                  <>
                    <span>→</span>
                    <em>
                      {formatTokenAmount(row.tokenOut, plan.tokenDecimals)} {plan.token}
                    </em>
                  </>
                )}
              </div>
              <p className="pl-row-meta">
                {row.timestamp ? fullDateTime(row.timestamp) : "Executed"}
              </p>
            </div>

            {row.txHash && explorerBaseUrl ? (
              <a
                href={`${explorerBaseUrl}/tx/${row.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pl-tx"
              >
                {shortHash(row.txHash)}
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span className="pl-scheduled-tag">Executed</span>
            )}
          </div>
        ))}

        {upcoming.map((run, i) => (
          <div
            key={`next-${run.index}`}
            className={`pl-row pl-row-upcoming ${i === 0 ? "pl-row-next" : ""}`}
            style={cssVars({ "--i": rows.length + i })}
          >
            <span className="pl-node" aria-hidden />
            <div className="pl-row-main">
              <div className="pl-row-title">
                Buy #{run.index}
                <span>·</span>
                {usd(plan.amountPerRun)} {stable}
              </div>
              <p className="pl-row-meta">
                {run.due ? "Due now" : `Expected ${fullDateTime(run.at)}`}
              </p>
            </div>
            <span className="pl-scheduled-tag">{i === 0 ? "Next" : "Scheduled"}</span>
          </div>
        ))}
      </div>

      {plan.executedCount > 0 && incomplete && (
        <p className="pl-note">
          {unavailable
            ? "This network's RPC won't serve historical logs, so the times above are derived from the schedule and transaction links aren't available."
            : partial
              ? `Only the most recent ${logged.length} of ${plan.executedCount} buys could be read back from this RPC — earlier rows show times derived from the schedule.`
              : "Some swap events couldn't be found on the connected RPC — those rows show times derived from the schedule."}
        </p>
      )}
    </>
  );
}
