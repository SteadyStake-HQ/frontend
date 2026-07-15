"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useAccount, useConfig } from "wagmi";
import { formatUnits } from "viem";
import { useDCASchedule, useContracts, usePlanExecutions, type PlanExecution } from "@/app/hooks";
import { DCA_FREQUENCY_INTERVALS } from "@/app/hooks/useDCAHelpers";
import { Header } from "@/app/components/Header";
import { CancelScheduleButton } from "@/app/components/dca/CancelScheduleButton";
import { ExecuteSwapButton } from "@/app/components/dca/ExecuteSwapButton";
import { LoadingCard } from "@/app/components/LoadingComponents";
import { REVERSE_FREQUENCY_MAP } from "@/lib/constants";
import { getTokenLogoUrl } from "@/lib/token-logo";
import { useSupportedTokens } from "@/app/hooks/useSupportedTokens";

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
  nextExecutionTimestamp: number;
  estimatedCompletion: number | null;
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
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
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

  const [logoUrlFallback, setLogoUrlFallback] = useState<string | null>(null);

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
    const amountPerRun = Number(formatUnits(schedule.amountPerInterval, 6));
    const executedCount = Number(schedule.executedCount);

    // The contract stores what's left, not what was put in: reconstruct the
    // original deposit so "how far along am I" has a denominator.
    const remaining = Number(formatUnits(schedule.totalAmount, 6));
    const invested = amountPerRun * executedCount;
    const totalDeposited = remaining + invested;
    const runsCount = amountPerRun > 0 ? Math.ceil(totalDeposited / amountPerRun) || 1 : 1;
    const executionProgress = runsCount > 0 ? (executedCount / runsCount) * 100 : 0;

    let status: PlanStatus = "active";
    if (executedCount >= runsCount) status = "ended";
    else if (!schedule.active) status = "cancelled";

    const nextExecutionTimestamp = Number(schedule.lastExecutionTime) + intervalSeconds;
    const runsLeft = Math.max(0, runsCount - executedCount);
    const estimatedCompletion =
      status === "active" && runsLeft > 0
        ? nextExecutionTimestamp + (runsLeft - 1) * intervalSeconds
        : null;

    // At creation the contract backdates lastExecutionTime by one interval, so
    // the first buy is immediately due. Unwind that to recover the start date.
    const createdAt =
      Number(schedule.lastExecutionTime) - executedCount * intervalSeconds + intervalSeconds;

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
      nextExecutionTimestamp,
      estimatedCompletion,
    };
  }, [schedule, scheduleId, chainId, supportedTokens]);

  const now = useNow(plan?.status === "active");
  const secondsUntilNext = plan ? Math.max(0, plan.nextExecutionTimestamp - now) : 0;
  const isDue = plan?.status === "active" && secondsUntilNext === 0;
  const inCooldown = plan?.status === "active" && secondsUntilNext > 0;

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
  const statusLabel =
    plan.status === "ended" ? "Completed" : plan.status === "cancelled" ? "Cancelled" : "Active";
  const statusClass =
    plan.status === "ended"
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
              <strong>{usd(plan.amountPerRun)} USDC</strong>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-5-5 5 5-5 5" />
              </svg>
              <em>{plan.token}</em>
              <span aria-hidden>·</span>
              <span>every {plan.frequency}</span>
            </p>
          </div>

          <div className="pl-badges">
            {isEnrolledForAutoExecution && (
              <span className="pl-badge pl-badge-auto" title="Executed automatically by the SteadyStake executor">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-exec
              </span>
            )}
            <span
              className={`pl-badge ${statusClass} ${plan.status === "active" ? "pl-badge-live" : ""}`}
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
                {usd(plan.amountPerRun)} <small>USDC</small>
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

        {plan.status === "active" && (
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
          {plan.status === "active" && address ? (
            <>
              <ExecuteSwapButton
                userAddress={address}
                scheduleId={scheduleId}
                isReady={isDue}
                onSuccess={() => refetch?.()}
                disabled={inCooldown}
              />
              <span className="pl-actions-note">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                {isEnrolledForAutoExecution
                  ? "This plan runs itself — executing manually just runs it sooner."
                  : "Runs when you execute it, or enrol it for auto-execution."}
              </span>
              <CancelScheduleButton scheduleId={scheduleId} />
            </>
          ) : plan.status === "cancelled" ? (
            <div className="pl-closed pl-closed-cancelled">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
              </svg>
              This plan was cancelled. Any unspent USDC was returned to your wallet.
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

      <section className="pl-panel pl-rise" style={cssVars({ "--i": 2 })}>
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
            now={now}
          />
        </div>
      </section>
    </PlanShell>
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
                  row.usdcAmount != null ? Number(formatUnits(row.usdcAmount, 6)) : plan.amountPerRun,
                )}{" "}
                USDC
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
                {usd(plan.amountPerRun)} USDC
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
