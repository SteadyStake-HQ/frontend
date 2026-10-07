"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStableSymbol } from "@/app/hooks";
import { useDashboardStore, type DashboardPlanRecord } from "@/app/store/useDashboardStore";
import { InfoTip, StateBadge, TokenAvatar, useChainNow } from "./DashboardVisuals";
import {
  STATE_META,
  allocationByToken,
  buildSchedule,
  buildTrajectory,
  fullTime,
  relTime,
  summarize,
  timeTick,
  usd,
  usdCompact,
  type AllocationSlice,
  type TrajectoryPoint,
} from "./insights";

type Tab = "trajectory" | "allocation" | "schedule";

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "trajectory", label: "Trajectory", icon: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  { id: "allocation", label: "Allocation", icon: "M12 3v9l7.8 4.5M12 21a9 9 0 110-18 9 9 0 010 18z" },
  { id: "schedule", label: "Schedule", icon: "M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
];

const TAB_STORAGE_KEY = "steadystake-dashboard-insight-tab";

export function DashboardCharts({ onAddPlan }: { onAddPlan?: () => void }) {
  const plans = useDashboardStore((s) => s.plans);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const [tab, setTab] = useState<Tab>("trajectory");
  // The chart refreshes by the minute, not the second: a per-second redraw of a 140-point area is
  // work nobody sees. Countdown-precision lives in the tiles.
  const tick = useChainNow();
  const now = tick - (tick % 30);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TAB_STORAGE_KEY) as Tab | null;
      if (saved && TABS.some((t) => t.id === saved)) queueMicrotask(() => setTab(saved));
    } catch {
      // storage blocked — the default tab is fine
    }
  }, []);

  const pick = (next: Tab) => {
    setTab(next);
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const summary = useMemo(() => summarize(plans, now), [plans, now]);
  const empty = !isLoading && plans.length === 0;

  return (
    <section className="dx-panel dx-insights" aria-labelledby="dx-insights-title">
      <header className="dx-panel-head">
        <div>
          <p className="dx-kicker">Insights</p>
          <h2 id="dx-insights-title">Where your plans are heading</h2>
        </div>
        <div className="dx-tabs" role="tablist" aria-label="Insight view" style={{ ["--n" as string]: TABS.length, ["--k" as string]: TABS.findIndex((t) => t.id === tab) } as CSSProperties}>
          <span className="dx-tabs-thumb" aria-hidden />
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="dx-tab"
              onClick={() => pick(t.id)}
              disabled={empty}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <ChartSkeleton />
      ) : empty ? (
        <GhostChart onAddPlan={onAddPlan} />
      ) : (
        <div className="dx-insights-body" key={tab}>
          {tab === "trajectory" && <TrajectoryView plans={plans} now={now} />}
          {tab === "allocation" && <AllocationView plans={plans} now={now} total={summary.committed} />}
          {tab === "schedule" && <ScheduleView plans={plans} now={tick} />}
        </div>
      )}
    </section>
  );
}

/* ---------- loading / empty ------------------------------------------------ */

function ChartSkeleton() {
  return (
    <div className="dx-chart-skeleton" aria-label="Loading chart" role="status">
      <div className="dx-skel-row">
        {[0, 1, 2].map((i) => <span key={i} className="dx-skel dx-skel-stat" />)}
      </div>
      <div className="dx-skel-plot">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ height: `${22 + ((i * 37) % 60)}%`, ["--i" as string]: i } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

/** The shape a plan will draw, animated, with the one action that makes it real. */
function GhostChart({ onAddPlan }: { onAddPlan?: () => void }) {
  return (
    <div className="dx-ghost">
      <svg className="dx-ghost-plot" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="dx-ghost-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dx-active)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--dx-active)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 80, 120, 160].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} className="dx-ghost-grid" />
        ))}
        <path className="dx-ghost-area" d="M0 190 H60 V170 H120 V150 H180 V132 H240 V112 H300 V96 H360 V78 H420 V60 H480 V44 H540 V28 H600 V200 H0 Z" fill="url(#dx-ghost-fill)" />
        <path className="dx-ghost-line" d="M0 190 H60 V170 H120 V150 H180 V132 H240 V112 H300 V96 H360 V78 H420 V60 H480 V44 H540 V28 H600" />
        {[60, 120, 180, 240, 300, 360, 420, 480, 540].map((x, i) => (
          <circle key={x} className="dx-ghost-coin" cx={x} cy={[170, 150, 132, 112, 96, 78, 60, 44, 28][i]} r="4" style={{ ["--i" as string]: i } as CSSProperties} />
        ))}
      </svg>
      <div className="dx-ghost-card">
        <ol className="dx-flow" aria-label="Create a plan in three steps">
          {[
            { k: "Token", d: "M12 8v8M8 12h8M12 21a9 9 0 110-18 9 9 0 010 18z" },
            { k: "Amount", d: "M12 7v10M14.5 9.5c-.5-.9-1.4-1.5-2.5-1.5-1.4 0-2.5.9-2.5 2.1 0 2.9 5 1.6 5 4.5 0 1.2-1.1 2.1-2.5 2.1-1.1 0-2-.6-2.5-1.5" },
            { k: "Cadence", d: "M20 7v5h-5M4 17v-5h5M6.1 8A7 7 0 0118.5 6.5L20 8M4 16l1.5 1.5A7 7 0 0017.9 16" },
          ].map((s, i) => (
            <li key={s.k} style={{ ["--i" as string]: i } as CSSProperties}>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.d} />
                </svg>
              </span>
              {s.k}
            </li>
          ))}
        </ol>
        <p>Your first plan draws its curve here.</p>
        {onAddPlan && (
          <button type="button" onClick={onAddPlan} className="ss-btn ss-btn-primary ss-btn-sm ss-btn-glow">
            Create a plan
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- trajectory ----------------------------------------------------- */

/** Round an axis maximum up to a 1/2/2.5/5 step, so the top tick is a number people say. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * pow >= v) ?? 10;
  return step * pow;
}

function Stat({ label, value, tone, tip }: { label: string; value: string; tone: string; tip?: string }) {
  return (
    <div className="dx-stat" style={{ ["--dx-tone" as string]: tone } as CSSProperties}>
      <span className="dx-stat-label">
        <i aria-hidden />
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
      <b>{value}</b>
    </div>
  );
}

function TrajectoryTooltip({
  active,
  payload,
  stable,
  now,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrajectoryPoint }>;
  stable: string;
  now: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const isFuture = p.done == null;
  const value = p.done ?? p.projected ?? 0;
  return (
    <div className="dx-tooltip">
      <p className="dx-tooltip-time">{p.t === now ? "Now" : fullTime(p.t)}</p>
      <p className="dx-tooltip-row">
        <i style={{ background: isFuture ? "var(--dx-projected)" : "var(--dx-active)" }} />
        {isFuture ? "Scheduled by then" : "Swapped so far"}
        <b>{usd(value)} {stable}</b>
      </p>
    </div>
  );
}

/** Exported for the plan page, which draws a single plan with the same chart. */
export function TrajectoryView({ plans, now }: { plans: DashboardPlanRecord[]; now: number }) {
  const stable = useStableSymbol();
  const traj = useMemo(() => buildTrajectory(plans, now), [plans, now]);
  const summary = useMemo(() => summarize(plans, now), [plans, now]);
  const first = traj.points[0]?.t ?? now;
  const last = traj.points[traj.points.length - 1]?.t ?? now;
  // Keep "now" off the very edge, so the marker and its label always have room.
  const pad = Math.max(60, (last - first) * 0.03);
  const domain: [number, number] = [first - (traj.hasPast ? 0 : pad * 6), last + pad];
  const span = domain[1] - domain[0];
  const finish = traj.hasFuture ? last : null;
  const ceiling = Math.max(traj.target, traj.executed, 1);

  return (
    <>
      <div className="dx-stats">
        <Stat label="Swapped" value={usd(traj.executed)} tone="var(--dx-active)" tip="Settled buys, summed in the plan's stablecoin." />
        <Stat label="Scheduled ahead" value={usd(Math.max(0, traj.target - traj.executed))} tone="var(--dx-projected)" tip="Funded buys still to run on live plans." />
        {traj.frozen > 0 && (
          <Stat label="On hold" value={usd(traj.frozen)} tone="var(--dx-held)" tip="Funds of plans an admin has paused. Not projected until resumed." />
        )}
        <Stat
          label={finish ? "Last buy" : "Status"}
          value={finish ? new Date(finish * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : summary.counts.held > 0 ? "Paused" : "Complete"}
          tone="var(--dx-ended)"
        />
      </div>

      <div className="dx-chart" role="img" aria-label={`Cumulative ${stable} swapped: ${usd(traj.executed)} so far, ${usd(traj.target)} once scheduled buys complete.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={traj.points} margin={{ top: 18, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="dx-done-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dx-active)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--dx-active)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dx-proj-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dx-projected)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--dx-projected)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--dx-grid)" strokeDasharray="3 5" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={domain}
              tickFormatter={(t: number) => timeTick(t, span)}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--dx-ink-3)" }}
              minTickGap={42}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--dx-ink-3)" }}
              tickFormatter={usdCompact}
              width={48}
              domain={[0, niceCeil(ceiling * 1.08)]}
            />
            <Tooltip
              content={<TrajectoryTooltip stable={stable} now={now} />}
              cursor={{ stroke: "var(--dx-ink-3)", strokeOpacity: 0.4, strokeDasharray: "4 4" }}
            />
            {traj.target > 0 && (
              <ReferenceLine
                y={traj.target}
                stroke="var(--dx-ink-3)"
                strokeOpacity={0.5}
                strokeDasharray="2 6"
                label={{ value: `Funded ${usdCompact(traj.target)}`, position: "insideTopLeft", fill: "var(--dx-ink-3)", fontSize: 11 }}
              />
            )}
            <ReferenceLine
              x={now}
              stroke="var(--dx-ink-2)"
              strokeOpacity={0.35}
              label={{ value: "Now", position: "top", fill: "var(--dx-ink-2)", fontSize: 11, fontWeight: 700 }}
            />
            <Area
              type="stepAfter"
              dataKey="done"
              stroke="var(--dx-active)"
              strokeWidth={2}
              fill="url(#dx-done-fill)"
              connectNulls={false}
              isAnimationActive
              animationDuration={1100}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--dx-surface)" }}
            />
            <Area
              type="stepAfter"
              dataKey="projected"
              stroke="var(--dx-projected)"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#dx-proj-fill)"
              connectNulls={false}
              isAnimationActive
              animationBegin={500}
              animationDuration={1100}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--dx-surface)" }}
            />
            <ReferenceDot
              x={now}
              y={traj.executed}
              r={6}
              fill={summary.counts.ready > 0 ? "var(--dx-ready)" : "var(--dx-active)"}
              stroke="var(--dx-surface)"
              strokeWidth={2.5}
              className="dx-now-dot"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="dx-chart-legend">
        <span><i className="is-solid" style={{ background: "var(--dx-active)" }} />Swapped</span>
        {traj.hasFuture && <span><i className="is-dashed" style={{ borderColor: "var(--dx-projected)" }} />Scheduled</span>}
        {summary.counts.ready > 0 && <StateBadge state="ready" label={`${summary.counts.ready} ready now`} pulse />}
        {summary.counts.held > 0 && <StateBadge state="held" label={`${summary.counts.held} on hold`} />}
        {!traj.hasFuture && summary.counts.held === 0 && <StateBadge state="ended" label="Nothing left to run" />}
      </div>
    </>
  );
}

/* ---------- allocation ----------------------------------------------------- */

function AllocationTooltip({ active, payload, total }: { active?: boolean; payload?: Array<{ payload: AllocationSlice }>; total: number }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="dx-tooltip">
      <p className="dx-tooltip-time">{s.symbol}</p>
      <p className="dx-tooltip-row"><i style={{ background: s.color }} />Committed<b>{usd(s.committed)}</b></p>
      <p className="dx-tooltip-row"><i className="is-ghost" />Swapped<b>{usd(s.executed)}</b></p>
      <p className="dx-tooltip-row"><i className="is-ghost" />Share<b>{total > 0 ? ((s.committed / total) * 100).toFixed(1) : 0}%</b></p>
    </div>
  );
}

function AllocationView({ plans, now, total }: { plans: DashboardPlanRecord[]; now: number; total: number }) {
  const slices = useMemo(() => allocationByToken(plans, now), [plans, now]);
  const [hover, setHover] = useState<string | null>(null);
  const focused = slices.find((s) => s.key === hover) ?? null;

  if (slices.length === 0) {
    return <p className="dx-empty-line">No committed funds to break down yet.</p>;
  }

  return (
    <div className="dx-alloc">
      <div className="dx-donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="committed"
              nameKey="symbol"
              innerRadius="68%"
              outerRadius="94%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              cornerRadius={5}
              stroke="var(--dx-surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              animationDuration={900}
              onMouseEnter={(_, i) => setHover(slices[i]?.key ?? null)}
              onMouseLeave={() => setHover(null)}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} opacity={hover && hover !== s.key ? 0.35 : 1} />
              ))}
            </Pie>
            <Tooltip content={<AllocationTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="dx-donut-core" aria-hidden>
          {focused ? (
            <>
              <TokenAvatar logo={focused.logo} symbol={focused.symbol} size={26} ring={focused.color} />
              <b>{total > 0 ? Math.round((focused.committed / total) * 100) : 0}%</b>
              <span>{focused.symbol}</span>
            </>
          ) : (
            <>
              <span>Committed</span>
              <b>{usdCompact(total)}</b>
              <span>{slices.length} {slices.length === 1 ? "token" : "tokens"}</span>
            </>
          )}
        </div>
      </div>

      <ul className="dx-alloc-list">
        {slices.map((s, i) => {
          const share = total > 0 ? s.committed / total : 0;
          const swapped = s.committed > 0 ? s.executed / s.committed : 0;
          return (
            <li
              key={s.key}
              className={hover === s.key ? "is-focus" : hover ? "is-dim" : ""}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              style={{ ["--c" as string]: s.color, ["--i" as string]: i } as CSSProperties}
            >
              <span className="dx-alloc-swatch" aria-hidden />
              {s.key === "other" ? (
                <span className="dx-avatar dx-avatar-other" style={{ width: 26, height: 26 }} aria-hidden>+</span>
              ) : (
                <TokenAvatar logo={s.logo} symbol={s.symbol} size={26} />
              )}
              <span className="dx-alloc-name">
                {s.symbol}
                <small>{s.plans} {s.plans === 1 ? "plan" : "plans"}{s.live > 0 ? ` · ${s.live} live` : ""}</small>
              </span>
              <span className="dx-alloc-bar" title={`${Math.round(swapped * 100)}% of this token's commitment swapped`}>
                <i style={{ width: `${swapped * 100}%` }} />
              </span>
              <span className="dx-alloc-amt">
                {usd(s.committed, 0)}
                <small>{(share * 100).toFixed(share < 0.1 ? 1 : 0)}%</small>
              </span>
            </li>
          );
        })}
        <li className="dx-alloc-key" aria-hidden>
          <span><i className="is-fill" />swapped</span>
          <span><i />still to buy</span>
        </li>
      </ul>
    </div>
  );
}

/* ---------- schedule ------------------------------------------------------- */

function ScheduleView({ plans, now }: { plans: DashboardPlanRecord[]; now: number }) {
  // The window is re-sized on the minute; the lane positions slide by the second.
  const windowNow = now - (now % 60);
  const sched = useMemo(() => buildSchedule(plans, windowNow), [plans, windowNow]);
  const span = Math.max(1, sched.end - now);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => now + f * span);
  const liveTotal = plans.filter((p) => p.status === "active").length;

  if (sched.lanes.length === 0) {
    return (
      <div className="dx-sched-empty">
        <StateBadge state="ended" label="No buys ahead" />
        <p>Every plan has finished or been cancelled.</p>
      </div>
    );
  }

  return (
    <div className="dx-sched">
      <div className="dx-sched-axis" aria-hidden>
        <span className="dx-sched-axis-pad" />
        <div className="dx-sched-axis-track">
          {ticks.map((t, i) => (
            <span key={i} style={{ left: `${(i / 4) * 100}%` }}>
              {i === 0 ? "Now" : timeTick(t, span)}
            </span>
          ))}
        </div>
      </div>

      <ul className="dx-sched-lanes">
        {sched.lanes.map(({ plan, state, buys, beyond }, li) => (
          <li key={plan.id} className={`dx-lane dx-lane-${state}`} style={{ ["--i" as string]: li, ["--tone" as string]: STATE_META[state].color } as CSSProperties}>
            <div className="dx-lane-head">
              <TokenAvatar logo={plan.tokenLogo} symbol={plan.targetToken} size={26} ring={STATE_META[state].color} />
              <span className="dx-lane-name">
                {plan.targetToken}
                <small>${plan.amountPerInterval} · {plan.frequency}</small>
              </span>
            </div>
            <div className="dx-lane-track">
              <span className="dx-lane-rail" aria-hidden />
              {state === "held" ? (
                <span className="dx-lane-hold">
                  <StateBadge state="held" label={plan.adminControl?.status === "cancelled" ? "Stopped" : "Paused"} />
                </span>
              ) : (
                buys.map((t, k) => {
                  const x = Math.min(100, Math.max(0, ((t - now) / span) * 100));
                  const first = k === 0;
                  return (
                    <span
                      key={t}
                      className={`dx-lane-buy${first ? " is-next" : ""}${first && state === "ready" ? " is-ready" : ""}`}
                      style={{ left: `${x}%`, ["--k" as string]: k } as CSSProperties}
                      data-tip={`Buy #${plan.executedCount + k + 1} · ${fullTime(t)} · ${relTime(t, now)}`}
                      tabIndex={first ? 0 : -1}
                    />
                  );
                })
              )}
              {beyond > 0 && state !== "held" && <span className="dx-lane-more">+{beyond}</span>}
            </div>
          </li>
        ))}
      </ul>

      {liveTotal > sched.lanes.length && (
        <p className="dx-sched-foot">Showing {sched.lanes.length} of {liveTotal} live plans</p>
      )}
    </div>
  );
}
