"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatUnits } from "viem";

/**
 * Shared gas tank furniture: the number, and the thing that shows how full the tank is.
 *
 * The pill in the toolbar, the top-up modal and the create-plan receipt all describe the same
 * balance, so they read it through the same two pieces — a tank that fills and a figure that
 * counts rather than snapping. When the balance changes because the user just topped up, the
 * movement is the feedback; a static number would leave them wondering whether it worked.
 */

/** True while the visitor has asked for less motion — every animation here checks it. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    queueMicrotask(apply);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/**
 * Gas is cents-scale — 0.001 per run on cheap networks. A flat 2dp renders a 0.025 balance as
 * "0.03", which reads as if nothing was ever spent, so the tank is quoted to 4dp throughout.
 * The precision used to widen only below 0.1, which meant a 12.3456 balance still lost its
 * fraction — the drain from a single run was invisible on any tank with real money in it.
 */
export function formatGasAmount(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function gasAmountFromUsdc6(raw: bigint): string {
  return formatGasAmount(Number(formatUnits(raw, 6)));
}

/** Ease-out so the count decelerates into its final value instead of stopping dead. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Animates from the value last settled on to the new one, and holds there. */
export function useCountUp(value: number, durationMs = 900): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    if (reduced) {
      fromRef.current = value;
      queueMicrotask(() => setDisplay(value));
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(from + (value - from) * easeOut(t));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        setDisplay(value);
      }
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, durationMs, reduced]);

  return display;
}

/** The balance, counting to its new value, in the caller's own type scale. */
export function AnimatedGasAmount({
  valueUsdc6,
  className,
}: {
  valueUsdc6: bigint;
  className?: string;
}) {
  const target = Number(formatUnits(valueUsdc6, 6));
  const display = useCountUp(target);
  // Snap to the exact figure once settled: an eased float must never round away a real cent.
  const shown = Math.abs(display - target) < 0.00005 ? target : display;
  return <span className={className}>{formatGasAmount(shown)}</span>;
}

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

/**
 * The tank: a ring that fills with the level and liquid that rises behind it. `level` is 0–1;
 * `tone` shifts the whole thing amber once the tank is low, so colour alone never carries the
 * warning — the liquid line does too.
 */
export function GasTankGauge({
  level,
  tone = "ok",
  size = 112,
  label,
  sublabel,
  pulse = false,
}: {
  level: number;
  tone?: "ok" | "low" | "empty";
  size?: number;
  label?: string;
  sublabel?: string;
  pulse?: boolean;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
  // Gradients are referenced by `url(#id)`, so the id has to be unique per gauge and free of
  // the punctuation useId() wraps its values in.
  const uid = `gt${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div
      className={`gt-gauge gt-gauge-${tone}${pulse ? " is-pulsing" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="gt-gauge-svg" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gt-tone-a)" />
            <stop offset="100%" stopColor="var(--gt-tone-b)" />
          </linearGradient>
          <linearGradient id={`${uid}-liquid`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gt-tone-b)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--gt-tone-a)" stopOpacity="0.75" />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <circle cx="50" cy="50" r="34" />
          </clipPath>
        </defs>

        <circle className="gt-gauge-well" cx="50" cy="50" r="34" />

        <g clipPath={`url(#${uid}-clip)`}>
          <g className="gt-gauge-level" style={{ transform: `translateY(${(1 - clamped) * 68}px)` }}>
            <path
              className="gt-gauge-wave"
              fill={`url(#${uid}-liquid)`}
              d="M-40 16 q8.5 -6 17 0 t17 0 t17 0 t17 0 t17 0 t17 0 t17 0 t17 0 v 90 h -136 z"
            />
            <path
              className="gt-gauge-wave gt-gauge-wave-back"
              fill={`url(#${uid}-liquid)`}
              d="M-40 19 q8.5 -6 17 0 t17 0 t17 0 t17 0 t17 0 t17 0 t17 0 t17 0 v 90 h -136 z"
            />
          </g>
        </g>

        <circle className="gt-gauge-track" cx="50" cy="50" r={RING_R} />
        <circle
          className="gt-gauge-arc"
          cx="50"
          cy="50"
          r={RING_R}
          stroke={`url(#${uid}-ring)`}
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - clamped)}
        />
      </svg>

      {(label || sublabel) && (
        <div className="gt-gauge-copy">
          {label && <span className="gt-gauge-label">{label}</span>}
          {sublabel && <span className="gt-gauge-sub">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

/** The pump mark. One drawing, used by the pill, the modal header and the receipt. */
export function GasTankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V6a2 2 0 012-2h6a2 2 0 012 2v15M3 21h12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 8h2.5A1.5 1.5 0 0118 9.5V16a1.5 1.5 0 003 0V9l-2.5-2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 11h4" />
    </svg>
  );
}
