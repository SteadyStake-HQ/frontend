"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useDashboardStats } from "./DashboardStatsContext";
import { useStableSymbol } from "@/app/hooks/useContracts";
import { useDashboardStore } from "@/app/store/useDashboardStore";
import { RadialProgress, RollingNumber, TokenAvatar, useChainNow } from "./DashboardVisuals";
import { STATE_META, countdownParts, fullTime, planVisualState, summarize, usd } from "./insights";

/** Compact skeleton for a stat number (single line). */
export function StatValueSkeleton() {
  return <span className="dx-skel dx-skel-value" aria-hidden />;
}

function Tile({
  label,
  icon,
  tone,
  hint,
  children,
  visual,
  index,
}: {
  label: string;
  icon: ReactNode;
  tone: string;
  hint?: string;
  children: ReactNode;
  visual?: ReactNode;
  index: number;
}) {
  return (
    <article
      className="dx-tile"
      style={{ ["--dx-tone" as string]: tone, ["--i" as string]: index } as CSSProperties}
      title={hint}
    >
      <span className="dx-tile-glow" aria-hidden />
      <header className="dx-tile-head">
        <span className="dx-tile-icon" aria-hidden>{icon}</span>
        <span className="dx-tile-label">{label}</span>
      </header>
      <div className="dx-tile-body">{children}</div>
      {visual && <div className="dx-tile-visual">{visual}</div>}
    </article>
  );
}

const money = (n: number) => usd(n);

export function DashboardStats() {
  const { usdcBalance, isLoadingStats } = useDashboardStats();
  const stable = useStableSymbol();
  const plans = useDashboardStore((s) => s.plans);
  const now = useChainNow();
  const summary = useMemo(() => summarize(plans, now), [plans, now]);
  const wallet = Number(String(usdcBalance).replace(/,/g, "")) || 0;
  const inPlans = summary.remaining;
  const walletShare = wallet + inPlans > 0 ? wallet / (wallet + inPlans) : 0;
  const deployed = summary.committed > 0 ? summary.executed / summary.committed : 0;

  const next = summary.nextBuy;
  const nextPlan = next?.plan;
  const secondsLeft = next ? Math.max(0, next.at - now) : 0;
  const elapsed = nextPlan && nextPlan.intervalSeconds > 0 ? 1 - secondsLeft / nextPlan.intervalSeconds : 0;
  const isNow = next != null && secondsLeft === 0;

  /** One dot per plan, coloured by state — the plan list in miniature. */
  const dots = useMemo(
    () => plans.slice(0, 30).map((p) => ({ id: p.id, state: planVisualState(p, now), token: p.targetToken })),
    [plans, now],
  );

  return (
    <section className="dx-tiles" aria-label="Key figures">
      <Tile
        index={0}
        label="Wallet"
        tone="var(--dx-c1)"
        hint={`${stable} in your wallet, ready to fund a plan`}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2h12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 12h5v4h-5a2 2 0 010-4z" />
          </svg>
        }
        visual={
          isLoadingStats ? null : (
            <div className="dx-split" title={`${usd(wallet)} in wallet · ${usd(inPlans)} waiting in plans`}>
              <span className="dx-split-bar" aria-hidden>
                <i style={{ flexGrow: Math.max(walletShare, 0.0001) }} className="is-a" />
                <i style={{ flexGrow: Math.max(1 - walletShare, 0.0001) }} className="is-b" />
              </span>
              <span className="dx-split-legend">
                <span><i className="is-a" />wallet</span>
                <span><i className="is-b" />in plans {usd(inPlans, 0)}</span>
              </span>
            </div>
          )
        }
      >
        {isLoadingStats ? (
          <StatValueSkeleton />
        ) : (
          <p className="dx-tile-value">
            <RollingNumber value={wallet} format={money} />
            <small>{stable}</small>
          </p>
        )}
      </Tile>

      <Tile
        index={1}
        label="Deployed"
        tone="var(--dx-c3)"
        hint={`${usd(summary.executed)} swapped of ${usd(summary.committed)} committed`}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 18V9m5 9V5m6 13v-7m5 7V3" />
          </svg>
        }
        visual={
          isLoadingStats ? null : (
            <div className="dx-meter">
              <span className="dx-bar dx-bar-ticks" aria-hidden style={{ ["--ticks" as string]: Math.min(24, Math.max(1, summary.buysTotal)) } as CSSProperties}>
                <span className="dx-bar-fill" style={{ ["--w" as string]: `${deployed * 100}%` } as CSSProperties} />
              </span>
              <span className="dx-meter-foot">
                <span>{summary.buysDone}/{summary.buysTotal} buys</span>
                <b>{Math.round(deployed * 100)}%</b>
              </span>
            </div>
          )
        }
      >
        {isLoadingStats ? (
          <StatValueSkeleton />
        ) : (
          <p className="dx-tile-value">
            <RollingNumber value={summary.executed} format={money} />
            <small>of {usd(summary.committed, 0)}</small>
          </p>
        )}
      </Tile>

      <Tile
        index={2}
        label="Plans"
        tone="var(--dx-c7)"
        hint="Each dot is a plan, coloured by its state"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="5" width="16" height="15" rx="3" />
            <path strokeLinecap="round" d="M8 3v4m8-4v4M4 10h16m-11 4h6" />
          </svg>
        }
        visual={
          isLoadingStats ? null : dots.length === 0 ? (
            <span className="dx-dots dx-dots-empty" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => <i key={i} />)}
            </span>
          ) : (
            <span className="dx-dots" role="list">
              {dots.map((d, i) => (
                <i
                  key={d.id}
                  role="listitem"
                  className={`dx-dot-${d.state}`}
                  style={{ background: STATE_META[d.state].color, ["--i" as string]: i } as CSSProperties}
                  title={`#${d.id} ${d.token} — ${STATE_META[d.state].label}`}
                />
              ))}
            </span>
          )
        }
      >
        {isLoadingStats ? (
          <StatValueSkeleton />
        ) : (
          <p className="dx-tile-value">
            <RollingNumber value={summary.live} format={(n) => String(Math.round(n))} />
            <small>live · {summary.total} total</small>
          </p>
        )}
      </Tile>

      <Tile
        index={3}
        label="Next buy"
        tone={isNow ? "var(--dx-ready)" : "var(--dx-active)"}
        hint={next ? `${nextPlan?.targetToken} · ${fullTime(next.at)}` : "No buy is scheduled"}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="13" r="8" />
            <path strokeLinecap="round" d="M12 9v4l2.5 1.5M9 3h6" />
          </svg>
        }
        visual={
          isLoadingStats || !nextPlan ? null : (
            <span className="dx-next-token">
              <TokenAvatar logo={nextPlan.tokenLogo} symbol={nextPlan.targetToken} size={20} />
              ${nextPlan.amountPerInterval} → {nextPlan.targetToken}
            </span>
          )
        }
      >
        {isLoadingStats ? (
          <StatValueSkeleton />
        ) : !next ? (
          <p className="dx-tile-value dx-tile-muted">—<small>nothing scheduled</small></p>
        ) : (
          <div className="dx-next">
            <RadialProgress fraction={isNow ? 1 : elapsed} size={46} tone={isNow ? "var(--dx-ready)" : "var(--dx-active)"}>
              {isNow ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7L8 5z" /></svg>
              ) : null}
            </RadialProgress>
            {isNow ? (
              <p className="dx-tile-value dx-now">Now</p>
            ) : (
              <p className="dx-countdown" aria-live="off">
                {countdownParts(secondsLeft).map((p) => (
                  <span key={p.u}>
                    {p.v}
                    <small>{p.u}</small>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}
      </Tile>
    </section>
  );
}
