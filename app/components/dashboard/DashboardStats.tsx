"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDashboardStats } from "./DashboardStatsContext";
import { LoadingSkeleton } from "../LoadingComponents";

const TILT_MAX = 8;
const TILT_SMOOTH = 0.15;

function StatCard3D({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rotateRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    const inner = innerRef.current;
    if (!card || !inner) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    targetRef.current = { x: -y * TILT_MAX, y: x * TILT_MAX };
  }, []);

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0 };
  }, []);

  useEffect(() => {
    const animate = () => {
      const target = targetRef.current;
      let { x, y } = rotateRef.current;
      x += (target.x - x) * TILT_SMOOTH;
      y += (target.y - y) * TILT_SMOOTH;
      if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1 && target.x === 0 && target.y === 0) {
        x = 0;
        y = 0;
      }
      rotateRef.current = { x, y };
      const inner = innerRef.current;
      if (inner) {
        const scale = target.x !== 0 || target.y !== 0 ? 1.02 : 1;
        inner.style.transform = `rotateX(${x}deg) rotateY(${y}deg) scale(${scale})`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`stat-card-3d ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={innerRef} className="stat-card-3d-inner h-full rounded-2xl">
        {children}
      </div>
    </div>
  );
}

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

function NextDCACountdown({ targetTimestamp }: { targetTimestamp: number | null }) {
  const [display, setDisplay] = useState<string>("—");

  useEffect(() => {
    if (targetTimestamp == null) {
      queueMicrotask(() => setDisplay("—"));
      return;
    }
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, targetTimestamp - now);
      setDisplay(formatCountdown(remaining));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTimestamp]);

  return <span>{display}</span>;
}

export function DashboardStats() {
  const {
    usdcBalance,
    isLoadingBalance,
    totalDeposited,
    nextExecutionTime,
    activePlanCount,
    isLoadingStats,
  } = useDashboardStats();

  const stats = [
    {
      label: "USDC balance",
      value: isLoadingBalance ? null : `${usdcBalance} USDC`,
      sub: "Available to deposit",
      icon: "💰",
      theme: "mint" as const,
    },
    {
      label: "Total deposited",
      value: isLoadingStats ? null : totalDeposited > 0 ? `$${totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
      sub: "≈ Across active plans",
      icon: "✨",
      theme: "lavender" as const,
    },
    {
      label: "Active plans",
      value: isLoadingStats ? null : activePlanCount.toString(),
      sub: "DCA schedules",
      icon: "📋",
      theme: "peach" as const,
    },
    {
      label: "Next DCA in",
      sub: "Earliest execution",
      icon: "⏱️",
      theme: "sky" as const,
      isCountdown: true as const,
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatCard3D key={stat.label} className="dashboard-stagger-item">
          <div className={`stat-card-sweet stat-card-${stat.theme} h-full rounded-2xl p-5`}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg" aria-hidden>{stat.icon}</span>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
                {stat.label}
              </p>
            </div>
            <div className="stat-card-value mt-1 text-xl font-bold tabular-nums md:text-2xl flex items-center min-h-[2rem] md:min-h-[2.25rem]">
              {stat.isCountdown ? (
                isLoadingStats ? (
                  <StatValueSkeleton />
                ) : (
                  <NextDCACountdown targetTimestamp={nextExecutionTime} />
                )
              ) : stat.value === null ? (
                <StatValueSkeleton />
              ) : (
                stat.value
              )}
            </div>
            <p className="mt-1.5 text-xs font-medium opacity-80">{stat.sub}</p>
          </div>
        </StatCard3D>
      ))}
    </div>
  );
}
