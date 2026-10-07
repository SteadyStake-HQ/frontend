import type { DashboardPlanRecord } from "@/app/store/useDashboardStore";

/**
 * Everything the connected dashboard draws, derived in one place.
 *
 * The hero, the KPI tiles, the insight charts and the plan filters all describe the same handful of
 * plans. Deriving each from the store on its own was how a plan could read "ready" in its card and
 * "active" in a count beside it, so they all read from here, against the same clock.
 */

/* The states a plan can be shown in. `ready` and `held` are not contract statuses — see
   DashboardPlans for why each outranks the plain on-chain one. */
export type PlanVisualState = "ready" | "active" | "held" | "ended" | "cancelled";

export const STATE_ORDER: PlanVisualState[] = ["ready", "active", "held", "ended", "cancelled"];

export const STATE_META: Record<PlanVisualState, { label: string; short: string; color: string; icon: string }> = {
  ready: { label: "Ready to buy", short: "Ready", color: "var(--dx-ready)", icon: "M8 5v14l11-7L8 5z" },
  active: { label: "Running", short: "Running", color: "var(--dx-active)", icon: "M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z" },
  held: { label: "On hold", short: "On hold", color: "var(--dx-held)", icon: "M9 6v12M15 6v12" },
  ended: { label: "Completed", short: "Done", color: "var(--dx-ended)", icon: "M5 13l4 4L19 7" },
  cancelled: { label: "Cancelled", short: "Cancelled", color: "var(--dx-cancelled)", icon: "M6 6l12 12M18 6L6 18" },
};

export function planVisualState(plan: DashboardPlanRecord, now: number): PlanVisualState {
  if (plan.status === "cancelled") return "cancelled";
  if (plan.status === "ended") return "ended";
  if (plan.adminControl) return "held";
  if (plan.isReady || (plan.contractDueTimestamp > 0 && plan.contractDueTimestamp <= now)) return "ready";
  return "active";
}

/** The one-word reading of the whole dashboard, which drives the hero's tone and copy. */
export type DashboardHealth = "empty" | "ready" | "running" | "held" | "idle";

export interface DashboardSummary {
  counts: Record<PlanVisualState, number>;
  total: number;
  live: number;
  committed: number;
  executed: number;
  remaining: number;
  buysDone: number;
  buysTotal: number;
  /** Earliest upcoming buy across running plans, or null when none is scheduled. */
  nextBuy: { at: number; plan: DashboardPlanRecord } | null;
  health: DashboardHealth;
}

export function summarize(plans: DashboardPlanRecord[], now: number): DashboardSummary {
  const counts: Record<PlanVisualState, number> = { ready: 0, active: 0, held: 0, ended: 0, cancelled: 0 };
  let committed = 0;
  let executed = 0;
  let remaining = 0;
  let buysDone = 0;
  let buysTotal = 0;
  let nextBuy: DashboardSummary["nextBuy"] = null;

  for (const plan of plans) {
    const state = planVisualState(plan, now);
    counts[state] += 1;
    const amount = Number(plan.amountPerInterval) || 0;
    const done = Number(plan.totalExecuted) || 0;
    executed += done;
    buysDone += plan.executedCount;
    // A cancelled plan's unspent funds went back to the wallet: only what it bought was committed.
    if (state === "cancelled") {
      committed += done;
      buysTotal += plan.executedCount;
    } else {
      const deposited = Number(plan.totalDeposited) || 0;
      committed += deposited;
      buysTotal += plan.runsTotal;
      remaining += Math.max(0, deposited - done);
    }
    if ((state === "active" || state === "ready") && plan.nextExecutionTimestamp > 0 && amount > 0) {
      if (!nextBuy || plan.nextExecutionTimestamp < nextBuy.at) {
        nextBuy = { at: plan.nextExecutionTimestamp, plan };
      }
    }
  }

  const live = counts.ready + counts.active + counts.held;
  const health: DashboardHealth =
    plans.length === 0
      ? "empty"
      : counts.ready > 0
        ? "ready"
        : counts.active > 0
          ? "running"
          : counts.held > 0
            ? "held"
            : "idle";

  return { counts, total: plans.length, live, committed, executed, remaining, buysDone, buysTotal, nextBuy, health };
}

/* ---------- allocation ----------------------------------------------------- */

/** Categorical slots, in fixed order (validated set — see globals: --dx-c1…c8). */
export const SERIES_COLORS = [
  "var(--dx-c1)",
  "var(--dx-c2)",
  "var(--dx-c3)",
  "var(--dx-c4)",
  "var(--dx-c5)",
  "var(--dx-c6)",
  "var(--dx-c7)",
];
export const OTHER_COLOR = "var(--dx-other)";

export interface AllocationSlice {
  key: string;
  symbol: string;
  name?: string;
  logo?: string;
  committed: number;
  executed: number;
  plans: number;
  live: number;
  color: string;
}

/**
 * Committed capital per token, largest first. A token keeps its colour by its rank in the full
 * list, which is stable for a given set of plans; past seven tokens the tail folds into "Other"
 * rather than inventing an eighth hue.
 */
export function allocationByToken(plans: DashboardPlanRecord[], now: number): AllocationSlice[] {
  const byToken = new Map<string, Omit<AllocationSlice, "color">>();
  for (const plan of plans) {
    const state = planVisualState(plan, now);
    const key = plan.targetTokenAddress.toLowerCase();
    const done = Number(plan.totalExecuted) || 0;
    const committed = state === "cancelled" ? done : Number(plan.totalDeposited) || 0;
    const entry = byToken.get(key) ?? {
      key,
      symbol: plan.targetToken,
      name: plan.tokenName,
      logo: plan.tokenLogo,
      committed: 0,
      executed: 0,
      plans: 0,
      live: 0,
    };
    entry.committed += committed;
    entry.executed += done;
    entry.plans += 1;
    if (state === "active" || state === "ready" || state === "held") entry.live += 1;
    byToken.set(key, entry);
  }

  const sorted = [...byToken.values()]
    .filter((s) => s.committed > 0)
    .sort((a, b) => b.committed - a.committed || a.symbol.localeCompare(b.symbol));

  const head = sorted.slice(0, SERIES_COLORS.length).map((s, i) => ({ ...s, color: SERIES_COLORS[i] }));
  const tail = sorted.slice(SERIES_COLORS.length);
  if (tail.length === 0) return head;
  return [
    ...head,
    tail.reduce<AllocationSlice>(
      (acc, s) => ({
        ...acc,
        committed: acc.committed + s.committed,
        executed: acc.executed + s.executed,
        plans: acc.plans + s.plans,
        live: acc.live + s.live,
      }),
      { key: "other", symbol: `${tail.length} more`, committed: 0, executed: 0, plans: 0, live: 0, color: OTHER_COLOR },
    ),
  ];
}

/* ---------- buys over time ------------------------------------------------- */

/** Most buys any one plan contributes to a chart; older ones fold into the starting baseline. */
const MAX_EVENTS_PER_PLAN = 400;
/** Points a chart series is thinned to — enough for a smooth line, few enough to stay light. */
const MAX_POINTS = 140;

export interface TrajectoryPoint {
  t: number;
  /** Cumulative stablecoin swapped up to t; null on the projected side. */
  done: number | null;
  /** Cumulative stablecoin the schedule will have swapped by t; null on the past side. */
  projected: number | null;
}

export interface Trajectory {
  points: TrajectoryPoint[];
  executed: number;
  /** Where the projection lands: everything the running plans are funded to buy. */
  target: number;
  /** Remaining funds a hold has frozen — committed, but not on any schedule right now. */
  frozen: number;
  hasPast: boolean;
  hasFuture: boolean;
}

/** Timestamps of a plan's settled buys, spaced one interval apart back from its latest. */
function pastBuyTimes(plan: DashboardPlanRecord): { times: number[]; folded: number } {
  const n = plan.executedCount;
  if (n <= 0 || plan.intervalSeconds <= 0) return { times: [], folded: 0 };
  // contractDueTimestamp is the last buy plus one interval (plus any paused remainder, which only
  // nudges the estimate); the plan page reconstructs history the same way.
  const last = plan.contractDueTimestamp - plan.intervalSeconds;
  const shown = Math.min(n, MAX_EVENTS_PER_PLAN);
  const times = Array.from({ length: shown }, (_, k) => last - (shown - 1 - k) * plan.intervalSeconds);
  return { times, folded: n - shown };
}

function futureBuyTimes(plan: DashboardPlanRecord, now: number): number[] {
  const left = Math.max(0, plan.runsTotal - plan.executedCount);
  if (left === 0 || plan.intervalSeconds <= 0) return [];
  const base = Math.max(now, plan.nextExecutionTimestamp);
  return Array.from({ length: Math.min(left, MAX_EVENTS_PER_PLAN) }, (_, k) => base + k * plan.intervalSeconds);
}

/** Thin a sorted series to at most `max` points, always keeping the first and last. */
function thin<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)]);
}

export function buildTrajectory(plans: DashboardPlanRecord[], now: number): Trajectory {
  const past: Array<{ t: number; amount: number }> = [];
  const future: Array<{ t: number; amount: number }> = [];
  let baseline = 0;
  let frozen = 0;

  for (const plan of plans) {
    const amount = Number(plan.amountPerInterval) || 0;
    if (amount <= 0) continue;
    const state = planVisualState(plan, now);
    const { times, folded } = pastBuyTimes(plan);
    baseline += folded * amount;
    for (const t of times) past.push({ t, amount });

    if (state === "held") {
      frozen += Math.max(0, plan.runsTotal - plan.executedCount) * amount;
    } else if (state === "active" || state === "ready") {
      for (const t of futureBuyTimes(plan, now)) future.push({ t, amount });
    }
  }

  past.sort((a, b) => a.t - b.t);
  future.sort((a, b) => a.t - b.t);

  const pastPoints: TrajectoryPoint[] = [];
  let running = baseline;
  if (past.length > 0) {
    pastPoints.push({ t: past[0].t - 1, done: baseline, projected: null });
  }
  for (const e of past) {
    running += e.amount;
    pastPoints.push({ t: e.t, done: running, projected: null });
  }
  const executed = running;

  // "Now" is shared by both series, so the dashed projection grows out of the solid line.
  const nowPoint: TrajectoryPoint = { t: now, done: executed, projected: future.length > 0 ? executed : null };

  const futurePoints: TrajectoryPoint[] = [];
  let projected = executed;
  for (const e of future) {
    projected += e.amount;
    futurePoints.push({ t: Math.max(e.t, now + 1), done: null, projected });
  }

  const points = [
    ...thin(pastPoints.filter((p) => p.t < now), MAX_POINTS / 2),
    nowPoint,
    ...thin(futurePoints, MAX_POINTS / 2),
  ];

  return {
    points,
    executed,
    target: projected,
    frozen,
    hasPast: past.length > 0 || baseline > 0,
    hasFuture: future.length > 0,
  };
}

/* ---------- upcoming schedule ---------------------------------------------- */

export interface ScheduleLane {
  plan: DashboardPlanRecord;
  state: PlanVisualState;
  /** Upcoming buy times inside the window. Empty for a held plan — its clock is stopped. */
  buys: number[];
  /** Buys beyond the window still owed. */
  beyond: number;
}

export interface ScheduleWindow {
  start: number;
  end: number;
  lanes: ScheduleLane[];
  /** Total buys drawn across every lane. */
  drawn: number;
}

/** Window lengths the schedule snaps to, so the axis always reads in round units. */
const WINDOWS = [3600, 6 * 3600, 86_400, 3 * 86_400, 7 * 86_400, 14 * 86_400, 30 * 86_400, 90 * 86_400, 180 * 86_400, 365 * 86_400];

/**
 * The next stretch of time, sized so the first few buys of the busiest plan are visible: wide
 * enough that a monthly plan shows its next buy, narrow enough that a daily one isn't a smear.
 */
export function buildSchedule(plans: DashboardPlanRecord[], now: number, maxLanes = 6): ScheduleWindow {
  const live = plans
    .map((plan) => ({ plan, state: planVisualState(plan, now) }))
    .filter(({ state }) => state === "active" || state === "ready" || state === "held")
    .sort((a, b) => {
      const order = STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
      return order || a.plan.nextExecutionTimestamp - b.plan.nextExecutionTimestamp;
    })
    .slice(0, maxLanes);

  const horizons = live
    .filter(({ state }) => state !== "held")
    .map(({ plan }) => {
      const first = Math.max(now, plan.nextExecutionTimestamp) - now;
      const left = Math.max(0, plan.runsTotal - plan.executedCount);
      // Long enough to show up to four buys of this plan.
      return first + Math.min(3, Math.max(0, left - 1)) * plan.intervalSeconds;
    });
  const need = horizons.length > 0 ? Math.max(...horizons) : 86_400;
  const span = WINDOWS.find((w) => w >= need * 1.08) ?? WINDOWS[WINDOWS.length - 1];
  const end = now + span;

  let drawn = 0;
  const lanes = live.map(({ plan, state }) => {
    if (state === "held") return { plan, state, buys: [], beyond: Math.max(0, plan.runsTotal - plan.executedCount) };
    const all = futureBuyTimes(plan, now);
    const buys = all.filter((t) => t <= end).slice(0, 48);
    drawn += buys.length;
    return { plan, state, buys, beyond: Math.max(0, plan.runsTotal - plan.executedCount - buys.length) };
  });

  return { start: now, end, lanes, drawn };
}

/* ---------- formatting ----------------------------------------------------- */

export const usd = (n: number, dp = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

/** $1.2k / $3.4M on axes and in tight spots; full figures belong in tooltips. */
export function usdCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  if (abs >= 100) return `$${n.toFixed(0)}`;
  if (abs === 0) return "$0";
  return `$${n.toFixed(abs < 1 ? 2 : 1).replace(/\.0$/, "")}`;
}

/** Short relative time: "in 3h", "in 12m", "now". */
export function relTime(target: number, now: number): string {
  const s = target - now;
  if (s <= 0) return "now";
  if (s < 60) return `in ${s}s`;
  if (s < 3600) return `in ${Math.ceil(s / 60)}m`;
  if (s < 86_400) return `in ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `in ${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
}

/** Countdown split into parts, for the large tile readout. */
export function countdownParts(seconds: number): Array<{ v: string; u: string }> {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return [{ v: String(d), u: "d" }, { v: String(h).padStart(2, "0"), u: "h" }, { v: String(m).padStart(2, "0"), u: "m" }];
  if (h > 0) return [{ v: String(h), u: "h" }, { v: String(m).padStart(2, "0"), u: "m" }, { v: String(sec).padStart(2, "0"), u: "s" }];
  return [{ v: String(m), u: "m" }, { v: String(sec).padStart(2, "0"), u: "s" }];
}

/** Axis tick label for a timestamp, at a granularity that fits the visible span. */
export function timeTick(t: number, span: number): string {
  const d = new Date(t * 1000);
  if (span <= 2 * 86_400) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (span <= 120 * 86_400) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function fullTime(t: number): string {
  return new Date(t * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
