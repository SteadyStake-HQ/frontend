"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useDashboardStats } from "./DashboardStatsContext";
import { useDashboardStore } from "@/app/store/useDashboardStore";
import { LoadingCard } from "../LoadingComponents";

interface ChartDataPoint {
  name: string;
  value: number;
  added: number | null;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--hero-muted)]/20 bg-[var(--background)] px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-[var(--hero-muted)]">{p.name}</p>
      <p
        className="mt-0.5 text-sm font-semibold tabular-nums"
        style={{ color: "var(--hero-primary)" }}
      >
        ${p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
      </p>
      {p.added != null && p.added > 0 && (
        <p className="mt-0.5 text-xs text-[var(--hero-muted)]">
          +${p.added.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this plan
        </p>
      )}
    </div>
  );
}

export function DashboardCharts() {
  const {
    totalDeposited,
    depositsPerPlan,
    isLoadingStats,
    activePlanCount,
  } = useDashboardStats();
  const historyPoints = useDashboardStore((state) => state.historyPoints);
  const isLoading = useDashboardStore((state) => state.isLoading);

  const hasPlans = activePlanCount > 0;

  const dataFromPlans = useMemo((): ChartDataPoint[] => {
    if (!hasPlans || depositsPerPlan.length === 0) return [];
    const points: ChartDataPoint[] = [
      { name: "Start", value: 0, added: null },
    ];
    let sum = 0;
    depositsPerPlan.forEach((deposit, i) => {
      sum += deposit;
      points.push({
        name: `Plan ${i + 1}`,
        value: sum,
        added: deposit,
      });
    });
    return points;
  }, [hasPlans, depositsPerPlan]);

  const dataFromHistory = useMemo((): ChartDataPoint[] => {
    if (historyPoints.length === 0) return [];
    const sorted = [...historyPoints].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
    );
    return sorted.map((p, i) => ({
      name: new Date(p.at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year:
          i === 0 || i === sorted.length - 1 ? "2-digit" : undefined,
      }),
      value: Number(p.valueUsdc6) / 1e6,
      added: null as number | null,
    }));
  }, [historyPoints]);

  const usePlanData = hasPlans && dataFromPlans.length > 0;
  const data = usePlanData ? dataFromPlans : dataFromHistory;
  const isHistoryMode = !usePlanData && dataFromHistory.length > 0;

  if (isLoadingStats && hasPlans) {
    return (
      <div className="mb-10">
        <LoadingCard message="Loading portfolio data..." />
      </div>
    );
  }

  if (!hasPlans && !isLoading && historyPoints.length === 0) {
    return (
      <div className="mb-10">
        <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[var(--background)] p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Portfolio value
          </h2>
          <div className="mt-6 flex h-48 flex-col items-center justify-center rounded-xl bg-[var(--hero-muted)]/5 text-center">
            <p className="text-sm text-[var(--hero-muted)]">
              No DCA plans yet
            </p>
            <p className="mt-1 text-xs text-[var(--hero-muted)]/80">
              Create a plan to see your portfolio value here, or connect with
              the same wallet used for automation to see historical data from the
              backend.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPlans && isLoading) {
    return (
      <div className="mb-10">
        <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[var(--background)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Portfolio value
          </h2>
          <div className="mt-4 flex h-64 items-center justify-center rounded-xl bg-[var(--hero-muted)]/5">
            <p className="text-sm text-[var(--hero-muted)]">
              Loading history from backend…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="mb-10">
        <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[var(--background)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Portfolio value
          </h2>
          <div className="mt-4 flex h-64 items-center justify-center rounded-xl bg-[var(--hero-muted)]/5">
            <p className="text-sm text-[var(--hero-muted)]">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[var(--background)] p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
            Portfolio value
          </h2>
          <p className="text-xs text-[var(--hero-muted)] sm:text-sm">
            {isHistoryMode
              ? "From backend history (total deposited over time)"
              : "Cumulative by plan"}
          </p>
        </div>

        <div className="h-64 w-full min-h-[200px] sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--hero-primary)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--hero-primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--hero-muted)"
                strokeOpacity={0.15}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--hero-muted)" }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--hero-muted)" }}
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                width={40}
                domain={[0, "auto"]}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "var(--hero-primary)",
                  strokeOpacity: 0.3,
                  strokeDasharray: "4 4",
                }}
              />
              <Area
                type="stepBefore"
                dataKey="value"
                stroke="var(--hero-primary)"
                strokeWidth={2}
                fill="url(#chartFill)"
                isAnimationActive={true}
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-3 text-xs text-[var(--hero-muted)]">
          {isHistoryMode
            ? `Total deposited over time (${data.length} points from backend)`
            : `Total: $${totalDeposited.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} USDC across ${depositsPerPlan.length} plan${depositsPerPlan.length !== 1 ? "s" : ""}`}
        </p>
      </div>
    </div>
  );
}
