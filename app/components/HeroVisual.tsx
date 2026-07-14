"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Illustrative plan preview: a volatile price line with scheduled buys landing on it,
 * the average cost settling below the spot price, and a position stack growing.
 * Purely decorative — no live data.
 */

const BUY_AMOUNT_USD = 50;
const STEP_MS = 360;
const START_DELAY_MS = 500;

// Chart geometry (SVG user units).
const X0 = 44;
const X1 = 404;
const Y_TOP = 40;
const Y_BOTTOM = 190;
const BAR_BASELINE = 262;
const BAR_MAX_H = 48;

/** Normalized price path (0 = bottom of chart, 1 = top) — volatile, drifting up. */
const PRICE_LEVELS = [
  0.42, 0.3, 0.55, 0.38, 0.26, 0.48, 0.6, 0.45, 0.62, 0.75, 0.66, 0.86,
];
const TOTAL_BUYS = PRICE_LEVELS.length;

const POINTS = PRICE_LEVELS.map((level, i) => ({
  x: X0 + (i * (X1 - X0)) / (TOTAL_BUYS - 1),
  y: Y_BOTTOM - level * (Y_BOTTOM - Y_TOP),
  price: Math.round(1800 + level * 900),
}));

const SPOT_PRICE = POINTS[POINTS.length - 1].price;

function catmullRomPath(points: Array<{ x: number; y: number }>) {
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

const LINE_PATH = catmullRomPath(POINTS);
const AREA_PATH = `${LINE_PATH} L ${X1} ${Y_BOTTOM} L ${X0} ${Y_BOTTOM} Z`;

/** DCA average is the harmonic-style mean: fixed dollars buy more units when price dips. */
function averageCost(buys: number) {
  if (buys === 0) return 0;
  const units = POINTS.slice(0, buys).reduce(
    (sum, p) => sum + BUY_AMOUNT_USD / p.price,
    0
  );
  return (buys * BUY_AMOUNT_USD) / units;
}

const FINAL_AVG = averageCost(TOTAL_BUYS);
const AVG_Y =
  Y_BOTTOM - ((FINAL_AVG - 1800) / 900) * (Y_BOTTOM - Y_TOP);

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export function HeroVisual() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(TOTAL_BUYS);
      return;
    }

    const timers: number[] = [];
    for (let i = 1; i <= TOTAL_BUYS; i++) {
      timers.push(
        window.setTimeout(() => setStep(i), START_DELAY_MS + (i - 1) * STEP_MS)
      );
    }
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const invested = step * BUY_AMOUNT_USD;
  const avg = averageCost(step);
  const units = POINTS.slice(0, step).reduce(
    (sum, p) => sum + BUY_AMOUNT_USD / p.price,
    0
  );
  const positionValue = units * SPOT_PRICE;

  const revealRatio = useMemo(() => {
    if (step === 0) return 0;
    const x = POINTS[step - 1].x + (step < TOTAL_BUYS ? 10 : 24);
    return Math.min((x - X0 + 14) / (X1 - X0 + 14), 1);
  }, [step]);

  return (
    <div className="hero-viz">
      <div className="hero-viz-card">
        <span className="hero-viz-sheen" aria-hidden="true" />

        <div className="hero-viz-head">
          <div>
            <p className="hero-viz-title">Weekly plan · ETH</p>
            <p className="hero-viz-sub">
              {usd(BUY_AMOUNT_USD)} every Monday · you stay in custody
            </p>
          </div>
          <span className="hero-viz-pill">
            <span className="hero-viz-dot" />
            {step === TOTAL_BUYS
              ? `${TOTAL_BUYS} of ${TOTAL_BUYS} executed`
              : `Buy ${step + 1} of ${TOTAL_BUYS}`}
          </span>
        </div>

        <svg
          className="hero-viz-chart"
          viewBox="0 0 448 292"
          role="img"
          aria-label="Illustration of scheduled buys landing on a volatile price line while the average cost stays below spot"
        >
          <defs>
            <linearGradient id="hero-viz-area" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--hero-primary)"
                stopOpacity="0.28"
              />
              <stop
                offset="100%"
                stopColor="var(--hero-primary)"
                stopOpacity="0"
              />
            </linearGradient>
            <linearGradient id="hero-viz-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--hero-primary)" />
              <stop offset="55%" stopColor="var(--hero-secondary)" />
              <stop offset="100%" stopColor="var(--hero-accent)" />
            </linearGradient>
            <linearGradient id="hero-viz-bar" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--hero-secondary)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--hero-accent)" stopOpacity="0.9" />
            </linearGradient>
            <clipPath id="hero-viz-reveal" clipPathUnits="userSpaceOnUse">
              <rect
                x={X0 - 14}
                y="0"
                width={X1 - X0 + 28}
                height="292"
                style={{
                  transformBox: "view-box",
                  transformOrigin: `${X0 - 14}px 0px`,
                  transform: `scaleX(${revealRatio})`,
                  transition: `transform ${STEP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                }}
              />
            </clipPath>
          </defs>

          {[0, 1, 2, 3].map((row) => (
            <line
              key={row}
              className="hero-viz-grid"
              x1={X0 - 14}
              x2={X1 + 14}
              y1={Y_TOP + row * ((Y_BOTTOM - Y_TOP) / 3)}
              y2={Y_TOP + row * ((Y_BOTTOM - Y_TOP) / 3)}
            />
          ))}

          <g clipPath="url(#hero-viz-reveal)">
            <path className="hero-viz-area" d={AREA_PATH} />
            <path className="hero-viz-path" d={LINE_PATH} />
          </g>

          {step === TOTAL_BUYS && (
            <>
              <line
                className="hero-viz-avg"
                x1={X0 - 8}
                x2={X1 + 8}
                y1={AVG_Y}
                y2={AVG_Y}
              />
              <text className="hero-viz-avg-label" x={X0 - 8} y={AVG_Y - 8}>
                Your average cost {usd(FINAL_AVG)}
              </text>
            </>
          )}

          {POINTS.slice(0, step).map((point, i) => (
            <g key={point.x} className="hero-viz-buy">
              <line
                className="hero-viz-drop"
                x1={point.x}
                x2={point.x}
                y1={Y_TOP - 12}
                y2={point.y}
              />
              <circle className="hero-viz-buy-dot" cx={point.x} cy={point.y} r="5" />
              {i === step - 1 && (
                <circle
                  className="hero-viz-buy-ring"
                  cx={point.x}
                  cy={point.y}
                  r="5"
                />
              )}
            </g>
          ))}

          <line
            className="hero-viz-baseline"
            x1={X0 - 14}
            x2={X1 + 14}
            y1={BAR_BASELINE}
            y2={BAR_BASELINE}
          />
          {POINTS.map((point, i) => {
            const filled = i < step;
            const height = ((i + 1) / TOTAL_BUYS) * BAR_MAX_H;
            return (
              <rect
                key={`bar-${point.x}`}
                className={`hero-viz-bar ${filled ? "is-filled" : ""}`}
                x={point.x - 7}
                y={BAR_BASELINE - height}
                width="14"
                height={height}
                rx="3"
              />
            );
          })}
          <text className="hero-viz-bar-label" x={X0 - 14} y={BAR_BASELINE + 18}>
            Position grows every week — never all at once
          </text>
        </svg>

        <div className="hero-viz-stats">
          <div className="hero-viz-stat">
            <span className="hero-viz-stat-label">Invested</span>
            <span className="hero-viz-stat-value tabular-nums">
              {usd(invested)}
            </span>
          </div>
          <div className="hero-viz-stat">
            <span className="hero-viz-stat-label">Avg. cost</span>
            <span className="hero-viz-stat-value tabular-nums">
              {avg > 0 ? usd(avg) : "—"}
            </span>
          </div>
          <div className="hero-viz-stat">
            <span className="hero-viz-stat-label">Position</span>
            <span className="hero-viz-stat-value tabular-nums">
              {positionValue > 0 ? usd(positionValue) : "—"}
            </span>
          </div>
        </div>

        <p className="hero-viz-note">
          Illustrative preview — not a forecast or performance claim.
        </p>
      </div>

      <span className="hero-viz-chip hero-viz-chip-a" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.8 1.8L15 10" />
        </svg>
        Keys stay yours
      </span>

      <span className="hero-viz-chip hero-viz-chip-b" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"
          />
        </svg>
        Gas prepaid
      </span>
    </div>
  );
}
