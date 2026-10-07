"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useDashboardStore } from "@/app/store/useDashboardStore";
import { InfoTip } from "./DashboardVisuals";

const DAY = 86_400;

const dateLabel = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const spanLabel = (seconds: number) =>
  seconds < 3600
    ? `${Math.max(1, Math.round(seconds / 60))}m`
    : seconds < 2 * DAY
      ? `${Math.round(seconds / 3600)}h`
      : `${Math.round(seconds / DAY)}d`;

/**
 * How long the tank lasts at the pace the user's auto plans actually spend it.
 *
 * A runs-left count answers "how much", but the question a user has is "when does a plan stop".
 * This walks every auto-executing plan's remaining buys forward in time and finds the buy the tank
 * can no longer pay for — the moment it runs dry — and sets it against the moment the plans would
 * have finished anyway. Drawn as one track: tank life in colour, the rest of the schedule beyond
 * the empty marker hatched.
 */
export function GasTankRunway({ runsLeft }: { runsLeft: number }) {
  const plans = useDashboardStore((s) => s.plans);
  const offset = useDashboardStore((s) => s.backendChainClockOffsetSeconds);
  // The modal is short-lived, so the moment it opened is "now" for the whole projection.
  const [openedAt] = useState(() => Math.floor(Date.now() / 1000));

  const model = useMemo(() => {
    const now = openedAt + offset;
    const auto = plans.filter(
      (p) => p.status === "active" && p.isEnrolledForAutoExecution && !p.adminControl && p.intervalSeconds > 0,
    );
    if (auto.length === 0) return null;

    const buys: number[] = [];
    for (const p of auto) {
      const left = Math.max(0, p.runsTotal - p.executedCount);
      const base = Math.max(now, p.nextExecutionTimestamp);
      for (let k = 0; k < Math.min(left, 2000); k++) buys.push(base + k * p.intervalSeconds);
    }
    if (buys.length === 0) return null;
    buys.sort((a, b) => a - b);

    const finish = buys[buys.length - 1];
    // The first buy the tank cannot pay for. Null when it covers every scheduled buy.
    const dryAt = runsLeft < buys.length ? buys[runsLeft] : null;
    const end = Math.max(finish, now + 60);
    return { now, auto: auto.length, total: buys.length, finish, dryAt, end };
  }, [plans, offset, runsLeft, openedAt]);

  if (!model) return null;

  const span = model.end - model.now;
  const dryPct = model.dryAt != null ? Math.min(100, ((model.dryAt - model.now) / span) * 100) : 100;
  const covered = model.dryAt == null;

  return (
    <section className={`dx-runway${covered ? " is-covered" : " is-short"}`} aria-label="Tank runway">
      <header className="dx-runway-head">
        <span className="gt-section-label">Runway</span>
        <span className={`dx-state ${covered ? "dx-state-ready" : "dx-state-held"}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d={covered ? "M5 13l4 4L19 7" : "M12 9v4m0 4h.01"} />
          </svg>
          {covered ? "Covers every buy" : `Dry in ${spanLabel((model.dryAt ?? model.now) - model.now)}`}
        </span>
        <InfoTip
          text={`${model.auto} auto plan${model.auto === 1 ? "" : "s"} · ${model.total} buys left. ${
            covered
              ? "Your tank pays for all of them at today's cost."
              : `Your tank pays for ${runsLeft}; plans stop on ${dateLabel(model.dryAt ?? model.now)} until topped up.`
          }`}
        />
      </header>

      <div className="dx-runway-track" style={{ ["--dry" as string]: `${dryPct}%` } as CSSProperties}>
        <span className="dx-runway-fuel" />
        {!covered && <span className="dx-runway-gap" />}
        {!covered && (
          <span className="dx-runway-mark" style={{ left: `${dryPct}%` }}>
            <i />
          </span>
        )}
      </div>
      <div className="dx-runway-axis">
        <span>Today</span>
        {!covered && dryPct > 18 && dryPct < 82 && (
          <span className="is-dry" style={{ left: `${dryPct}%` }}>empty {dateLabel(model.dryAt ?? model.now)}</span>
        )}
        <span>last buy {dateLabel(model.finish)}</span>
      </div>
    </section>
  );
}

/** Runs now against runs after this top-up, on one bar. */
export function TopUpPreview({ before, added }: { before: number; added: number }) {
  const after = before + added;
  const scale = Math.max(after, 1);
  const fmt = (n: number) => (n > 9999 ? "9,999+" : n.toLocaleString("en-US"));
  return (
    <div className="dx-topup" aria-label={`${fmt(before)} runs now, ${fmt(after)} after this top-up`}>
      <div className="dx-topup-bar" aria-hidden>
        <i className="is-before" style={{ width: `${(before / scale) * 100}%` }} />
        <i className="is-added" style={{ width: `${(added / scale) * 100}%` }} />
      </div>
      <div className="dx-topup-legend">
        <span><i className="is-before" />{fmt(before)} now</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-5-5 5 5-5 5" />
        </svg>
        <span><i className="is-added" /><b>{fmt(after)}</b> runs</span>
        <em>+{fmt(added)}</em>
      </div>
    </div>
  );
}
