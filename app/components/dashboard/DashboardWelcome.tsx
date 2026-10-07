"use client";

import { useMemo, type CSSProperties } from "react";
import { useAccount } from "wagmi";
import { useDashboardStore } from "@/app/store/useDashboardStore";
import { useStableSymbol } from "@/app/hooks";
import { StatusRing, WalletAvatar, RollingNumber, useChainNow } from "./DashboardVisuals";
import { STATE_META, STATE_ORDER, summarize, usd, type DashboardHealth, type PlanVisualState } from "./insights";

/** Headline and one supporting line per health reading. Short on purpose: the ring says the rest. */
const HEADLINE: Record<DashboardHealth, (n: number) => { title: string; accent: string; line: string }> = {
  empty: () => ({ title: "Your DCA.", accent: "On repeat.", line: "Pick a token, an amount, a cadence." }),
  ready: (n) => ({ title: `${n} ${n === 1 ? "buy is" : "buys are"}`, accent: "ready now.", line: "Cooldown finished — execute or let auto-run fire." }),
  running: (n) => ({ title: `${n} ${n === 1 ? "plan" : "plans"}`, accent: "on repeat.", line: "Every buy lands on schedule, keys stay yours." }),
  held: (n) => ({ title: `${n} ${n === 1 ? "plan" : "plans"}`, accent: "on hold.", line: "Paused by an admin — your deposit is untouched." }),
  idle: () => ({ title: "All plans", accent: "complete.", line: "Every scheduled buy settled. Start the next one." }),
};

const EMPTY_COUNTS: Record<PlanVisualState, number> = { ready: 0, active: 0, held: 0, ended: 0, cancelled: 0 };

const shortAddress = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function DashboardWelcome({
  onAddPlan,
  onFilter,
}: {
  onAddPlan: () => void;
  /** Jump to the plan list, filtered to one state. */
  onFilter?: (state: PlanVisualState | "all") => void;
}) {
  const { chain, address } = useAccount();
  const plans = useDashboardStore((s) => s.plans);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const stable = useStableSymbol();
  const now = useChainNow();
  const summary = useMemo(() => summarize(plans, now), [plans, now]);
  const headCount =
    summary.health === "ready"
      ? summary.counts.ready
      : summary.health === "held"
        ? summary.counts.held
        : summary.live;
  const copy = HEADLINE[summary.health](headCount);
  const progress = summary.committed > 0 ? summary.executed / summary.committed : 0;
  const autoCount = plans.filter((p) => p.isEnrolledForAutoExecution && !p.adminControl).length;

  return (
    <section
      className={`dx-hero dx-hero-${isLoading ? "loading" : summary.health}`}
      aria-labelledby="dashboard-title"
    >
      <span className="dx-hero-grid" aria-hidden />
      <span className="dx-hero-beam" aria-hidden />

      <div className="dx-hero-main">
        <div className="dx-identity">
          <WalletAvatar address={address} size={42} />
          <div className="dx-identity-copy">
            <span className="dx-identity-addr" title={address}>{shortAddress(address)}</span>
            <span className="dx-net-pill">
              <span className="dx-net-dot" aria-hidden />
              {chain?.name ?? "Unknown network"}
            </span>
          </div>
        </div>

        <h1 id="dashboard-title" className="dx-hero-title">
          {isLoading ? (
            <span className="dx-skel dx-skel-title" aria-label="Loading" />
          ) : (
            <>
              {copy.title} <span>{copy.accent}</span>
            </>
          )}
        </h1>
        <p className="dx-hero-line">{isLoading ? " " : copy.line}</p>

        {/* Deployment across every plan: how much of what was committed has already been bought. */}
        {!isLoading && summary.total > 0 && (
          <div className="dx-hero-progress" title={`${usd(summary.executed)} of ${usd(summary.committed)} ${stable} swapped — ${summary.buysDone} of ${summary.buysTotal} buys`}>
            <div className="dx-hero-progress-head">
              <span>Deployed</span>
              <b>
                <RollingNumber value={progress * 100} format={(n) => `${Math.round(n)}%`} />
              </b>
            </div>
            <span className="dx-bar" aria-hidden>
              <span className="dx-bar-fill" style={{ ["--w" as string]: `${Math.max(progress > 0 ? 2 : 0, progress * 100)}%` } as CSSProperties} />
            </span>
            <div className="dx-hero-progress-foot">
              <span>{summary.buysDone} / {summary.buysTotal} buys</span>
              <span>{usd(summary.committed, 0)} committed</span>
            </div>
          </div>
        )}

        <div className="dx-hero-actions">
          <button type="button" onClick={onAddPlan} className="ss-btn ss-btn-primary dashboard-new-plan-btn dx-cta">
            <span className="dashboard-new-plan-icon" aria-hidden>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span>{summary.total > 0 ? "New plan" : "Create a plan"}</span>
          </button>
          {summary.health === "ready" && onFilter && (
            <button type="button" className="ss-btn ss-btn-success ss-btn-bolt dx-cta-ready" onClick={() => onFilter("ready")}>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Review {summary.counts.ready} ready
            </button>
          )}
          <span className="dx-trust">
            <span className="dx-trust-chip" title="Funds sit in your own vault position; only you can withdraw them.">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z" />
              </svg>
              Non-custodial
            </span>
            {autoCount > 0 && (
              <span className="dx-trust-chip dx-trust-auto" title={`${autoCount} plan${autoCount === 1 ? "" : "s"} executed for you by the relayer`}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {autoCount} auto
              </span>
            )}
          </span>
        </div>
      </div>

      {/* The plan mix at a glance. Each legend chip filters the plan list to that state. */}
      <div className="dx-hero-visual">
        <span className="dx-hero-halo" aria-hidden />
        <StatusRing counts={isLoading ? EMPTY_COUNTS : summary.counts} size={172} stroke={11}>
          {isLoading || summary.total === 0 ? (
            <span className="dx-ring-empty" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5M6.1 8A7 7 0 0118.5 6.5L20 8M4 16l1.5 1.5A7 7 0 0017.9 16" />
              </svg>
            </span>
          ) : (
            <>
              <b className="dx-ring-num">
                <RollingNumber value={summary.live} format={(n) => String(Math.round(n))} />
              </b>
              <span className="dx-ring-cap">live</span>
              <span className="dx-ring-sub">of {summary.total}</span>
            </>
          )}
        </StatusRing>

        {isLoading ? (
          <span className="dx-skel dx-skel-legend" aria-hidden />
        ) : summary.total > 0 ? (
          <ul className="dx-legend" aria-label="Plans by state">
            {STATE_ORDER.filter((s) => summary.counts[s] > 0).map((state) => (
              <li key={state}>
                <button
                  type="button"
                  className={`dx-legend-chip dx-legend-${state}`}
                  onClick={() => onFilter?.(state)}
                  title={`Show ${STATE_META[state].label.toLowerCase()} plans`}
                >
                  <span className="dx-legend-dot" style={{ background: STATE_META[state].color }} aria-hidden />
                  {STATE_META[state].short}
                  <b>{summary.counts[state]}</b>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ol className="dx-steps-mini" aria-label="How a plan works">
            {[
              { k: "Pick", d: "M12 8v8M8 12h8M12 21a9 9 0 110-18 9 9 0 010 18z" },
              { k: "Fund", d: "M4 7.5h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2h12M16 12h5v4h-5a2 2 0 010-4z" },
              { k: "Repeat", d: "M20 7v5h-5M4 17v-5h5M6.1 8A7 7 0 0118.5 6.5L20 8M4 16l1.5 1.5A7 7 0 0017.9 16" },
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
        )}
      </div>
    </section>
  );
}
