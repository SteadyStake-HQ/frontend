"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useDashboardStats } from "./DashboardStatsContext";
import { Card3D } from "../Card3D";

/** Compact skeleton for stat number (single line) */
export function StatValueSkeleton() {
  return (
    <div
      className="stat-card-skeleton h-8 w-24 animate-pulse rounded md:h-9"
      aria-hidden
    />
  );
}

/** Format seconds remaining into countdown string: 2d 5h 12m 33s */
function formatCountdown(secondsTotal: number): string {
  if (secondsTotal <= 0) return "Now";
  const d = Math.floor(secondsTotal / 86400);
  const h = Math.floor((secondsTotal % 86400) / 3600);
  const m = Math.floor((secondsTotal % 3600) / 60);
  const s = secondsTotal % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function NextDCACountdown({
  targetTimestamp,
  clockOffsetSeconds,
}: {
  targetTimestamp: number | null;
  clockOffsetSeconds: number;
}) {
  const [display, setDisplay] = useState<string>("—");

  useEffect(() => {
    if (targetTimestamp == null) {
      queueMicrotask(() => setDisplay("—"));
      return;
    }
    const tick = () => {
      const now = Math.floor(Date.now() / 1000) + clockOffsetSeconds;
      const remaining = Math.max(0, targetTimestamp - now);
      setDisplay(formatCountdown(remaining));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTimestamp, clockOffsetSeconds]);

  return <span>{display}</span>;
}

export function DashboardStats() {
  const {
    usdcBalance,
    isLoadingBalance,
    totalDeposited,
    nextExecutionTime,
    backendChainClockOffsetSeconds,
    activePlanCount,
    isLoadingStats,
  } = useDashboardStats();

  const stats = [
    {
      label: "Ready to invest",
      value: isLoadingBalance ? null : `${usdcBalance} USDC`,
      sub: "Available in your wallet",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 7.5h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2h12" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 12h5v4h-5a2 2 0 010-4z" />
        </svg>
      ) as ReactNode,
      theme: "mint" as const,
    },
    {
      label: "Plan funding",
      value: isLoadingStats ? null : totalDeposited > 0 ? `$${totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
      sub: "USDC committed across plans",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 18V9m5 9V5m6 13v-7m5 7V3" />
        </svg>
      ) as ReactNode,
      theme: "lavender" as const,
    },
    {
      label: "Active plans",
      value: isLoadingStats ? null : activePlanCount.toString(),
      sub: "Recurring schedules running",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="4" y="5" width="16" height="15" rx="3" strokeWidth="1.8" />
          <path strokeLinecap="round" strokeWidth="1.8" d="M8 3v4m8-4v4M4 10h16m-11 4h6" />
        </svg>
      ) as ReactNode,
      theme: "peach" as const,
    },
    {
      label: "Next DCA in",
      sub: "Until the next scheduled buy",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="13" r="8" strokeWidth="1.8" />
          <path strokeLinecap="round" strokeWidth="1.8" d="M12 9v4l2.5 1.5M9 3h6" />
        </svg>
      ) as ReactNode,
      theme: "sky" as const,
      isCountdown: true as const,
    },
  ];

  return (
    <section className="dashboard-metrics mb-8" aria-labelledby="dashboard-metrics-title">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-section-kicker">At a glance</p>
          <h2 id="dashboard-metrics-title">Your DCA health</h2>
        </div>
        <p>Live wallet and on-chain plan data</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card3D key={stat.label} className="dashboard-stagger-item">
          <div className={`landing-card-sweet landing-card-${stat.theme} h-full p-5`}>
            <div className="mb-2 flex items-center gap-2.5">
              <span className="stat-card-tile" aria-hidden>{stat.icon}</span>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--hero-muted)]">
                {stat.label}
              </p>
            </div>
            <div className="stat-card-value mt-1 text-xl font-bold tabular-nums md:text-2xl flex items-center min-h-[2rem] md:min-h-[2.25rem]">
              {stat.isCountdown ? (
                isLoadingStats ? (
                  <StatValueSkeleton />
                ) : (
                  <NextDCACountdown
                    targetTimestamp={nextExecutionTime}
                    clockOffsetSeconds={backendChainClockOffsetSeconds}
                  />
                )
              ) : stat.value === null ? (
                <StatValueSkeleton />
              ) : (
                stat.value
              )}
            </div>
            <p className="mt-1.5 text-xs font-medium text-[var(--hero-muted)]">{stat.sub}</p>
          </div>
        </Card3D>
      ))}
      </div>
    </section>
  );
}
