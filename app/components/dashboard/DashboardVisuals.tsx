"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDashboardStore } from "@/app/store/useDashboardStore";
import { usePrefersReducedMotion } from "./GasTankVisuals";
import { STATE_META, STATE_ORDER, type PlanVisualState } from "./insights";

/**
 * The dashboard's shared drawing kit. Every surface on the connected dashboard — the hero, the
 * tiles, the insight charts, the plan list — speaks through these, so a state has one colour, one
 * glyph and one way of moving wherever it appears.
 */

/** The chain's clock, ticking once a second. One source, so countdowns and states never disagree. */
export function useChainNow(active = true): number {
  const offset = useDashboardStore((s) => s.backendChainClockOffsetSeconds);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000) + offset);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000) + offset);
    queueMicrotask(tick);
    if (!active) return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [offset, active]);
  return now;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Rolls from where it last settled (zero on first paint) to the new value. */
export function useRollingNumber(value: number, durationMs = 1100): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (reduced || from === value) {
      fromRef.current = value;
      queueMicrotask(() => setDisplay(value));
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      setDisplay(from + (value - from) * easeOutExpo(p));
      if (p < 1) frame = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = value;
    };
  }, [value, durationMs, reduced]);

  return display;
}

export function RollingNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const shown = useRollingNumber(value);
  // Snap once settled, so easing never rounds away a real cent.
  return <span className={className}>{format(Math.abs(shown - value) < 1e-6 ? value : shown)}</span>;
}

/** A token's logo over its initials — the initials are the base layer, never a broken image. */
export function TokenAvatar({
  logo,
  symbol,
  size = 28,
  ring,
  className,
}: {
  logo?: string;
  symbol: string;
  size?: number;
  /** Optional ring colour (a CSS colour) marking the token's series or state. */
  ring?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const initials = (symbol || "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  return (
    <span
      className={`dx-avatar ${className ?? ""}`}
      style={{ width: size, height: size, ["--dx-ring" as string]: ring ?? "transparent", fontSize: Math.max(9, size * 0.34) } as CSSProperties}
      aria-hidden
    >
      <span className="dx-avatar-initials">{initials}</span>
      {logo && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={logo}
          src={logo}
          alt=""
          width={size}
          height={size}
          decoding="async"
          className={loaded ? "is-loaded" : ""}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/** A deterministic identicon for a wallet: two hues and a facet pattern seeded by the address. */
export function WalletAvatar({ address, size = 44 }: { address?: string; size?: number }) {
  const seed = useMemo(() => {
    const hex = (address ?? "0x0").toLowerCase().replace(/^0x/, "").padEnd(40, "0");
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
    return {
      h1: (n(0) * 360) / 255,
      h2: (n(2) * 360) / 255,
      cells: Array.from({ length: 15 }, (_, i) => n(4 + i * 2) % 3),
    };
  }, [address]);
  const id = `wa-${(address ?? "x").slice(2, 10)}`;
  return (
    <svg className="dx-wallet-avatar" width={size} height={size} viewBox="0 0 50 50" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${seed.h1} 82% 62%)`} />
          <stop offset="100%" stopColor={`hsl(${seed.h2} 78% 52%)`} />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <rect width="50" height="50" rx="15" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <rect width="50" height="50" fill={`url(#${id})`} />
        {seed.cells.map((v, i) => {
          if (v === 0) return null;
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = 5 + col * 8;
          const y = 5 + row * 8;
          // Mirror across the vertical axis, identicon-style.
          return (
            <g key={i} fill="#fff" opacity={v === 1 ? 0.28 : 0.5}>
              <rect x={x} y={y} width="8" height="8" rx="2" />
              <rect x={42 - x} y={y} width="8" height="8" rx="2" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * A donut of plan states. One arc per state present, separated by a surface gap, in the fixed
 * state order — so "ready" always sits at twelve o'clock when there is one.
 */
export function StatusRing({
  counts,
  size = 148,
  stroke = 12,
  children,
}: {
  counts: Record<PlanVisualState, number>;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = 50 - stroke / 2 - 2;
  const c = 2 * Math.PI * r;
  const total = STATE_ORDER.reduce((sum, s) => sum + counts[s], 0);
  const present = STATE_ORDER.filter((s) => counts[s] > 0);
  const gap = present.length > 1 ? 2.2 : 0;
  let offset = 0;

  return (
    <div className="dx-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className="dx-ring-track" strokeWidth={stroke} />
        {total > 0 &&
          present.map((state, i) => {
            const len = (counts[state] / total) * c;
            const dash = Math.max(0.01, len - gap);
            const el = (
              <circle
                key={state}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={STATE_META[state].color}
                strokeWidth={stroke}
                strokeLinecap={present.length > 1 ? "butt" : "round"}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                className={`dx-ring-arc dx-ring-arc-${state}`}
                style={{ ["--i" as string]: i } as CSSProperties}
              >
                <title>{`${counts[state]} ${STATE_META[state].label.toLowerCase()}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="dx-ring-core">{children}</div>
    </div>
  );
}

/** A small radial that drains as a wait elapses. `fraction` is how much of the wait is gone. */
export function RadialProgress({
  fraction,
  size = 54,
  stroke = 5,
  tone = "var(--dx-active)",
  children,
}: {
  fraction: number;
  size?: number;
  stroke?: number;
  tone?: string;
  children?: ReactNode;
}) {
  const r = 50 - stroke * 1.2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return (
    <span className="dx-radial" style={{ width: size, height: size, ["--dx-tone" as string]: tone } as CSSProperties}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className="dx-radial-track" strokeWidth={stroke * 1.6} />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="dx-radial-arc"
          strokeWidth={stroke * 1.6}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
        />
      </svg>
      {children && <span className="dx-radial-core">{children}</span>}
    </span>
  );
}

/** The state pill: a glyph and a word, never colour alone. */
export function StateBadge({ state, label, pulse }: { state: PlanVisualState; label?: string; pulse?: boolean }) {
  const meta = STATE_META[state];
  return (
    <span className={`dx-state dx-state-${state}${pulse ? " is-pulsing" : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} fill={state === "ready" ? "currentColor" : "none"} />
      </svg>
      {label ?? meta.short}
    </span>
  );
}

/** A small "i" that carries the detail a label leaves out. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="dx-tip" tabIndex={0} aria-label={text} data-tip={text}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
      </svg>
    </span>
  );
}
