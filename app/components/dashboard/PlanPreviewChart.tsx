"use client";

import { useState, type CSSProperties } from "react";

/** Steps drawn individually; past this the staircase is sampled and the count stated. */
const MAX_STEPS = 24;

const W = 300;
const H = 112;
const PAD_X = 6;
const PAD_TOP = 16;
const PAD_BOTTOM = 4;

const shortDate = (ms: number, span: number) =>
  span < 2 * 86_400_000
    ? new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: span > 300 * 86_400_000 ? "2-digit" : undefined });

/**
 * What the plan being typed will actually do: a staircase of cumulative spend, one step per buy,
 * on the real calendar from now to its last buy. It replaces bars that only illustrated "a plan
 * rises" — every coordinate here is the plan's own amount and cadence.
 */
export function PlanPreviewChart({
  amount,
  runs,
  cadenceSeconds,
  symbol,
}: {
  amount: number;
  runs: number;
  cadenceSeconds: number;
  symbol: string;
}) {
  // When the preview first drew — the plan would start about now.
  const [start] = useState(() => Date.now());
  const total = amount * runs;
  const steps = Math.min(runs, MAX_STEPS);
  const per = runs / steps;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (steps <= 1 ? innerW / 2 : (i / steps) * innerW);
  const y = (v: number) => PAD_TOP + innerH - (total > 0 ? (v / total) * innerH : 0);

  // Buy k (1-based, in step units) lands at x(k-1) and lifts the line to its cumulative total.
  let line = `M${PAD_X} ${y(0)}`;
  const coins: Array<{ cx: number; cy: number }> = [];
  for (let k = 1; k <= steps; k++) {
    const cum = Math.min(total, k * per * amount);
    const sx = x(k - 1);
    line += ` H${sx} V${y(cum)}`;
    coins.push({ cx: sx, cy: y(cum) });
  }
  line += ` H${W - PAD_X}`;
  const area = `${line} V${H - PAD_BOTTOM} H${PAD_X} Z`;

  const spanMs = Math.max(0, runs - 1) * cadenceSeconds * 1000;
  const finish = start + spanMs;
  // Remount on change, so the line redraws for every new plan shape rather than morphing.
  const key = `${amount}-${runs}-${cadenceSeconds}`;

  return (
    <div className="dx-pp" key={key} role="img" aria-label={`${runs} buys of $${amount} ${symbol}, $${total.toFixed(2)} in total`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="dx-pp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hero-primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--hero-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={PAD_TOP + innerH * f} y2={PAD_TOP + innerH * f} className="dx-pp-grid" />
        ))}
        <path d={area} fill="url(#dx-pp-fill)" className="dx-pp-area" />
        <path d={line} className="dx-pp-line" />
      </svg>
      {/* Coins sit in HTML over the stretched SVG, so they stay round at any width. */}
      <div className="dx-pp-coins" aria-hidden>
        {coins.map((c, i) => (
          <span
            key={i}
            style={{ left: `${(c.cx / W) * 100}%`, top: `${(c.cy / H) * 100}%`, ["--i" as string]: i } as CSSProperties}
          />
        ))}
      </div>
      <span className="dx-pp-total">${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
      {runs > MAX_STEPS && <span className="dx-pp-cap">{runs} buys</span>}
      <div className="dx-pp-axis" aria-hidden>
        <span>Now</span>
        <span>{runs > 1 ? shortDate(finish, spanMs) : "once"}</span>
      </div>
    </div>
  );
}

/**
 * Where the wallet ends up: plan, gas and what is left, on one bar scaled to the balance. A plan
 * the wallet cannot cover runs past the end of the bar, and that overhang is the shortfall.
 */
export function WalletImpactBar({
  balance,
  plan,
  gas,
  symbol,
}: {
  balance: number;
  plan: number;
  gas: number;
  symbol: string;
}) {
  const spend = plan + gas;
  const scale = Math.max(balance, spend, 1e-9);
  const left = Math.max(0, balance - spend);
  const short = Math.max(0, spend - balance);
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className={`dx-impact${short > 0 ? " is-short" : ""}`}>
      <div className="dx-impact-bar" aria-hidden>
        <i className="is-plan" style={{ width: pct(Math.min(plan, scale)) }} />
        {gas > 0 && <i className="is-gas" style={{ width: pct(gas) }} />}
        {left > 0 && <i className="is-left" style={{ width: pct(left) }} />}
        {short > 0 && <b className="dx-impact-mark" style={{ left: pct(balance) }} />}
      </div>
      <div className="dx-impact-legend">
        <span><i className="is-plan" />Plan {fmt(plan)}</span>
        {gas > 0 && <span><i className="is-gas" />Gas {fmt(gas)}</span>}
        {short > 0 ? (
          <span className="is-short"><i />Short {fmt(short)}</span>
        ) : (
          <span><i className="is-left" />Left {fmt(left)}</span>
        )}
        <span className="dx-impact-of">of {fmt(balance)} {symbol}</span>
      </div>
    </div>
  );
}
