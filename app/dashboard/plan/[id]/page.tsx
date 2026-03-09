"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useDCASchedule, useContracts } from "@/app/hooks";
import { DCA_FREQUENCY_INTERVALS } from "@/app/hooks/useDCAHelpers";
import { Header } from "@/app/components/Header";
import { CancelScheduleButton } from "@/app/components/dca/CancelScheduleButton";
import { ExecuteSwapButton } from "@/app/components/dca/ExecuteSwapButton";
import { LoadingCard } from "@/app/components/LoadingComponents";
import { formatUnits } from "viem";
import { REVERSE_FREQUENCY_MAP } from "@/lib/constants";
import { getTokenLogoUrl } from "@/lib/token-logo";
import { useSupportedTokens } from "@/app/hooks/useSupportedTokens";
import { useEffect, useState } from "react";

function resolveTokenDisplay(
  targetTokenAddress: string,
  tokens: { address: string; symbol: string; name?: string; logo?: string }[],
): { symbol: string; logo?: string } {
  const addr = String(targetTokenAddress).toLowerCase();
  const t = tokens.find((x) => x.address.toLowerCase() === addr);
  const symbol = t?.symbol ?? t?.name ?? (addr.length >= 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr);
  return { symbol, logo: t?.logo };
}

interface PlanDetails {
  id: string;
  token: string;
  tokenLogoUrl?: string;
  amountPerRun: string;
  frequency: string;
  nextRun: string;
  totalDeposited: string;
  status: "active" | "cancelled" | "ended";
  createdAt: string;
  runsCount: number;
  executedCount: number;
  executionProgress: number;
  nextExecutionTimestamp?: number;
}

function formatCountdown(secondsTotal: number): string {
  if (secondsTotal <= 0) return "Now";
  const m = Math.floor(secondsTotal / 60);
  const s = secondsTotal % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function PlanNextRunCountdown({ targetTimestamp }: { targetTimestamp: number }) {
  const [display, setDisplay] = useState(() =>
    formatCountdown(Math.max(0, targetTimestamp - Math.floor(Date.now() / 1000))),
  );
  useEffect(() => {
    const tick = () =>
      setDisplay(formatCountdown(Math.max(0, targetTimestamp - Math.floor(Date.now() / 1000))));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTimestamp]);
  return <span>{display}</span>;
}

function parseScheduleIdFromParams(params: ReturnType<typeof useParams>): bigint | null {
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (id == null || id === "") return null;
  try {
    const n = BigInt(id);
    if (n < 0) return null;
    return n;
  } catch {
    return null;
  }
}

export default function PlanPage() {
  const params = useParams();
  const { address, isConnected } = useAccount();
  const { chainId } = useContracts();
  const { tokens: supportedTokens } = useSupportedTokens(chainId ?? undefined);
  const scheduleId = parseScheduleIdFromParams(params);

  const { schedule, isReady, isLoading, refetch } = useDCASchedule(
    scheduleId ?? BigInt(0),
    address,
  );
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const [logoUrlFallback, setLogoUrlFallback] = useState<string | null>(null);

  useEffect(() => {
    if (
      !plan?.nextExecutionTimestamp ||
      plan.status !== "active" ||
      plan.nextExecutionTimestamp <= Math.floor(Date.now() / 1000)
    )
      return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [plan?.nextExecutionTimestamp, plan?.status]);

  const now = Math.floor(Date.now() / 1000);
  const inCooldown =
    plan?.status === "active" &&
    plan.nextExecutionTimestamp != null &&
    plan.nextExecutionTimestamp > now;

  useEffect(() => {
    if (isLoading) {
      setLoading(true);
      return;
    }

    if (!schedule) {
      setLoading(false);
      return;
    }

    if (scheduleId === undefined || scheduleId === null) {
      setLoading(false);
      return;
    }

    try {
      const targetTokenAddress = schedule.targetToken as string;
      const { symbol: tokenSymbol, logo: tokenLogo } = resolveTokenDisplay(
        targetTokenAddress,
        supportedTokens,
      );
      const logoUrl =
        chainId != null ? getTokenLogoUrl(chainId, targetTokenAddress, tokenLogo) : undefined;
      const tokenLogoUrl = typeof logoUrl === "string" ? logoUrl : undefined;
      const frequencyNum = Number(schedule.frequency);
      const frequencyLabel = REVERSE_FREQUENCY_MAP[frequencyNum] || "Unknown";
      const intervalSeconds = DCA_FREQUENCY_INTERVALS[frequencyNum] ?? 86400;
      const amountPerRunFormatted = formatUnits(schedule.amountPerInterval, 6);
      const remainingFormatted = formatUnits(schedule.totalAmount, 6);
      const executedCount = Number(schedule.executedCount);
      const amountNum = Number(amountPerRunFormatted);
      const remainingNum = Number(remainingFormatted);
      // Contract stores remaining; original deposit = remaining + (amountPerInterval * executedCount)
      const originalTotalAmount = remainingNum + amountNum * executedCount;
      const totalSchedules = Math.ceil(originalTotalAmount / amountNum) || 1;
      const executionProgress = (executedCount / totalSchedules) * 100;

      let status: "active" | "cancelled" | "ended" = "active";
      if (executedCount >= totalSchedules) status = "ended";
      else if (!schedule.active) status = "cancelled";

      const nextExecutionTimestamp =
        Number(schedule.lastExecutionTime) + intervalSeconds;
      const now = Math.floor(Date.now() / 1000);
      const secondsUntilNext = Math.max(0, nextExecutionTimestamp - now);

      let nextRunLabel = "";
      if (secondsUntilNext < 60) nextRunLabel = "Now";
      else if (secondsUntilNext < 3600)
        nextRunLabel = `In ${Math.ceil(secondsUntilNext / 60)}m`;
      else if (secondsUntilNext < 86400)
        nextRunLabel = `In ${Math.ceil(secondsUntilNext / 3600)}h`;
      else nextRunLabel = `In ${Math.ceil(secondsUntilNext / 86400)}d`;

      // Estimate created timestamp: first run was at lastExecutionTime + interval (at creation, lastExecutionTime = block.timestamp - interval)
      const createdTimestamp =
        Number(schedule.lastExecutionTime) - executedCount * intervalSeconds + intervalSeconds;
      const createdDate =
        createdTimestamp > 0
          ? new Date(createdTimestamp * 1000).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "—";

      setPlan({
        id: scheduleId.toString(),
        token: tokenSymbol,
        tokenLogoUrl,
        amountPerRun: amountNum.toFixed(2),
        frequency: frequencyLabel,
        nextRun: nextRunLabel,
        totalDeposited: originalTotalAmount.toFixed(2),
        status,
        createdAt: createdDate,
        runsCount: totalSchedules,
        executedCount,
        executionProgress,
        nextExecutionTimestamp,
      });
    } catch (error) {
      console.error("Error processing schedule:", error);
    } finally {
      setLoading(false);
    }
  }, [schedule, scheduleId, chainId, supportedTokens]);

  // Fallback: fetch logo from API when static helper returns no URL (e.g. testnets)
  useEffect(() => {
    if (
      !plan?.token ||
      plan.tokenLogoUrl != null ||
      chainId == null ||
      !schedule?.targetToken
    ) {
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
      <>
        <Header />
        <main className="landing-pattern-bg plan-page-main min-h-screen border-t border-[var(--hero-muted)]/10 pt-[5.5rem]">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--hero-muted)] hover:text-[var(--foreground)]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to dashboard
            </Link>
            <div className="mt-8 rounded-2xl border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--background)_0.35,transparent)] p-8 text-center backdrop-blur-sm">
              <p className="text-[var(--hero-muted)]">
                Please connect your wallet to view plan details.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block text-sm font-semibold text-[var(--hero-primary)] hover:underline"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (scheduleId === null) {
    return (
      <>
        <Header />
        <main className="landing-pattern-bg plan-page-main min-h-screen border-t border-[var(--hero-muted)]/10 pt-[5.5rem]">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--hero-muted)] hover:text-[var(--foreground)]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to dashboard
            </Link>
            <div className="mt-8 rounded-2xl border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--background)_0.35,transparent)] p-8 text-center backdrop-blur-sm">
              <p className="text-[var(--hero-muted)]">Plan not found.</p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block text-sm font-semibold text-[var(--hero-primary)] hover:underline"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (loading || isLoading) {
    return (
      <>
        <Header />
        <main className="landing-pattern-bg plan-page-main min-h-screen border-t border-[var(--hero-muted)]/10 pt-[5.5rem]">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--hero-muted)] hover:text-[var(--foreground)] mb-8"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to dashboard
            </Link>
            <LoadingCard message="Loading plan details..." />
          </div>
        </main>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <Header />
        <main className="landing-pattern-bg plan-page-main min-h-screen border-t border-[var(--hero-muted)]/10 pt-[5.5rem]">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--hero-muted)] hover:text-[var(--foreground)]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to dashboard
            </Link>
            <div className="mt-8 rounded-2xl border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--background)_0.35,transparent)] p-8 text-center backdrop-blur-sm">
              <p className="text-[var(--hero-muted)]">Plan not found.</p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block text-sm font-semibold text-[var(--hero-primary)] hover:underline"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="landing-pattern-bg plan-page-main min-h-screen border-t border-[var(--hero-muted)]/10 pt-[5.5rem]">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg py-2 text-sm font-medium text-[var(--hero-muted)] transition-colors hover:bg-[var(--hero-muted)]/10 hover:text-[var(--foreground)]"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>

          <div className="mt-8 space-y-8">
            {/* Plan Summary */}
            <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--background)_0.35,transparent)] shadow-sm overflow-hidden backdrop-blur-sm">
              {/* Header with title and status */}
              <div className="border-b border-[var(--hero-muted)]/10 bg-transparent px-6 py-5 sm:px-8 sm:py-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                    {plan.token} DCA Plan
                  </h1>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      plan.status === "active"
                        ? "status-badge-active"
                        : plan.status === "cancelled"
                          ? "status-badge-cancelled"
                          : "status-badge-ended"
                    }`}
                  >
                    {plan.status === "ended" ? "Completed" : plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                  </span>
                </div>
              </div>

              <div className="p-6 sm:p-8">
              <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-[var(--hero-muted)]">
                    Token
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {(plan.tokenLogoUrl ?? logoUrlFallback) && (
                      <img
                        src={plan.tokenLogoUrl ?? logoUrlFallback ?? ""}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full bg-[var(--hero-muted)]/10 object-cover"
                        width={32}
                        height={32}
                      />
                    )}
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                      {plan.token}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--hero-muted)]">
                    Per Execution
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                    ${plan.amountPerRun}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--hero-muted)]">
                    Frequency
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                    {plan.frequency}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--hero-muted)]">
                    Created
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--foreground)] sm:text-2xl">
                    {plan.createdAt}
                  </p>
                </div>
                {plan.status === "active" && (
                  <div>
                    <p className="text-sm font-medium text-[var(--hero-muted)]">
                      Progress
                    </p>
                    <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                      {plan.executedCount} / {plan.runsCount}
                    </p>
                  </div>
                )}
              </div>

              {/* Execution Progress Bar */}
              {plan.status === "active" && (
                <div className="mt-8">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--hero-muted)]">
                      Execution Progress
                    </p>
                    <p className="text-sm font-semibold text-[var(--hero-primary)]">
                      {plan.executionProgress}%
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--hero-muted)]/10">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--hero-primary)] to-[var(--hero-secondary)]"
                      style={{ width: `${plan.executionProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Statistics */}
              {plan.status === "active" && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--hero-primary)_0.05)] p-4">
                    <p className="text-sm font-medium text-[var(--hero-muted)]">
                      Total Deposited
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                      ${plan.totalDeposited}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--hero-primary)_0.05)] p-4">
                    <p className="text-sm font-medium text-[var(--hero-muted)]">
                      Next Execution
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[var(--foreground)] tabular-nums">
                      {plan.nextExecutionTimestamp != null &&
                      plan.status === "active" &&
                      plan.nextExecutionTimestamp > Math.floor(Date.now() / 1000) ? (
                        <PlanNextRunCountdown targetTimestamp={plan.nextExecutionTimestamp} />
                      ) : (
                        plan.nextRun
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions: Execute left, Cancel right */}
              <div className="mt-8 pt-6 border-t border-[var(--hero-muted)]/10">
                {plan.status === "active" && scheduleId !== null && address && (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <ExecuteSwapButton
                        userAddress={address}
                        scheduleId={scheduleId}
                        isReady={isReady && !inCooldown}
                        onSuccess={() => refetch?.()}
                        disabled={inCooldown}
                      />
                    </div>
                    <div className="flex items-center">
                      <CancelScheduleButton scheduleId={scheduleId} />
                    </div>
                  </div>
                )}
                {plan.status === "cancelled" && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    This plan has been cancelled
                  </div>
                )}
                {plan.status === "ended" && (
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--hero-muted)]/20 bg-[var(--hero-muted)]/10 px-4 py-3 text-sm font-medium text-[var(--hero-muted)]">
                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    This plan has ended
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Execution History */}
            <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[color-mix(in_srgb,var(--background)_0.35,transparent)] shadow-sm overflow-hidden backdrop-blur-sm">
              <div className="border-b border-[var(--hero-muted)]/10 bg-transparent px-6 py-4 sm:px-8 sm:py-5">
                <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                  Transaction History
                </h2>
              </div>
              <div className="p-6 sm:p-8">
              {plan.executedCount > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--hero-muted)]/10">
                          <th className="pb-3 text-left text-sm font-medium text-[var(--hero-muted)]">
                            Execution #
                          </th>
                          <th className="pb-3 text-left text-sm font-medium text-[var(--hero-muted)]">
                            Amount
                          </th>
                          <th className="pb-3 text-left text-sm font-medium text-[var(--hero-muted)]">
                            Time
                          </th>
                          <th className="pb-3 text-left text-sm font-medium text-[var(--hero-muted)]">
                            Transaction
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: plan.executedCount }, (_, i) => (
                          <tr
                            key={i}
                            className="border-b border-[var(--hero-muted)]/5"
                          >
                            <td className="py-3 text-sm text-[var(--foreground)]">
                              {i + 1}
                            </td>
                            <td className="py-3 text-sm text-[var(--foreground)]">
                              ${plan.amountPerRun} USDC
                            </td>
                            <td className="py-3 text-sm text-[var(--hero-muted)]">
                              Executed
                            </td>
                            <td className="py-3">
                              <a
                                href={`https://sepolia.basescan.org/address/${address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-[var(--hero-primary)] hover:underline"
                              >
                                View on Basescan
                                <svg
                                  className="h-3 w-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-[var(--hero-muted)]">
                  No executions yet. Plan will start executing at the scheduled
                  time.
                </p>
              )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
