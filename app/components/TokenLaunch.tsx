"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { RevealOnScroll } from "./RevealOnScroll";

/** Planned token generation event. UTC, so the countdown agrees everywhere. */
const LAUNCH_AT = Date.UTC(2026, 8, 1, 0, 0, 0);

const UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Mins" },
  { key: "seconds", label: "Secs" },
] as const;

type Remaining = Record<(typeof UNITS)[number]["key"], number>;

function split(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  };
}

/**
 * Ticks only after mount: the server has no clock the client agrees with to the
 * second, so the first paint shows placeholders rather than a value React would
 * immediately have to correct.
 */
function useCountdown() {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = LAUNCH_AT - Date.now();
      setLaunched(diff <= 0);
      setRemaining(split(diff));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { remaining, launched };
}

/** Signals converge on the token, and the position it drives keeps climbing. */
function AiBloom() {
  const HUB = { x: 392, y: 150 };
  const NODES = [
    { x: 62, y: 58 },
    { x: 40, y: 152 },
    { x: 84, y: 244 },
    { x: 176, y: 100 },
    { x: 168, y: 206 },
    { x: 262, y: 54 },
    { x: 254, y: 250 },
  ];
  const CURVE = "M436 148 C500 148 520 116 560 104 C606 90 636 62 692 40";

  return (
    <svg
      className="tk-bloom"
      viewBox="0 0 720 300"
      role="img"
      aria-label="AI signals converging on the token, driving a position that keeps climbing."
    >
      <defs>
        <linearGradient id="tk-curve" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--hero-secondary)" />
          <stop offset="100%" stopColor="var(--hero-primary)" />
        </linearGradient>
        <radialGradient id="tk-hub-glow">
          <stop offset="0%" stopColor="var(--hero-primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--hero-primary)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Signals in */}
      {NODES.map((n, i) => (
        <g key={`${n.x}-${n.y}`} style={{ "--tk-i": i } as CSSProperties}>
          <path className="tk-edge" d={`M${n.x} ${n.y} L${HUB.x} ${HUB.y}`} />
          <circle className="tk-node-halo" cx={n.x} cy={n.y} r="12" />
          <circle className="tk-node" cx={n.x} cy={n.y} r="5" />
        </g>
      ))}

      {/* The token itself */}
      <circle className="tk-hub-glow" cx={HUB.x} cy={HUB.y} r="96" fill="url(#tk-hub-glow)" />
      {[0, 1].map((n) => (
        <circle
          key={n}
          className="tk-hub-ring"
          cx={HUB.x}
          cy={HUB.y}
          r="42"
          style={{ animationDelay: `${n * 1.8}s` }}
        />
      ))}
      <circle className="tk-hub" cx={HUB.x} cy={HUB.y} r="38" />
      <circle className="tk-hub-edge" cx={HUB.x} cy={HUB.y} r="38" />
      <g transform={`translate(${HUB.x} ${HUB.y})`}>
        <path
          className="tk-hub-mark"
          d="M0-17 4.7-4.7 17 0 4.7 4.7 0 17-4.7 4.7-17 0-4.7-4.7Z"
        />
      </g>

      {/* Position out */}
      <path className="tk-curve-ghost" d={CURVE} />
      <path className="tk-curve" d={CURVE} pathLength={100} />
      <circle
        className="tk-curve-head"
        r="6"
        style={{ offsetPath: `path("${CURVE}")` } as CSSProperties}
      />
    </svg>
  );
}

const UNLOCKS = [
  {
    key: "assist",
    title: "AI strategy assistants",
    body: "Plans that adapt allocation and cadence to you.",
    path: "M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 1 0 12 8.5Z",
  },
  {
    key: "gas",
    title: "Discounted gas",
    body: "Holders pay less on every scheduled run.",
    path: "M13 2 4 14h6l-1 8 9-12h-6l1-8z",
  },
  {
    key: "tickets",
    title: "Free auto tickets",
    body: "Extra automated plans, no monthly fee.",
    path: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4Z",
  },
  {
    key: "play",
    title: "Points that count",
    body: "Arcade Steady Points start gating real perks.",
    path: "M12 3 14.5 9.2 21 9.6l-5 4.2 1.6 6.2L12 16.6 6.4 20l1.6-6.2-5-4.2 6.5-.4z",
  },
] as const;

export function TokenLaunch() {
  const { remaining, launched } = useCountdown();

  return (
    <section
      id="token"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">Token &amp; AI</p>
          <h2 className="section-title mb-4 text-center">
            The token switches the AI layer on.
          </h2>
          <p className="section-title-sub mx-auto mb-10 text-center">
            Planned launch 1 September. DCA keeps running either way.
          </p>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="tk-panel">
            <div className="tk-panel-glow" aria-hidden />

            <div className="tk-clock">
              <span className="tk-clock-label">
                {launched ? "Token is live" : "Countdown to launch"}
              </span>

              <div className="tk-units" role="timer" aria-live="off">
                {UNITS.map((unit) => {
                  const value = remaining?.[unit.key];
                  return (
                    <div key={unit.key} className={`tk-unit tk-unit-${unit.key}`}>
                      <span className="tk-unit-value tabular-nums">
                        {value === undefined
                          ? "--"
                          : String(value).padStart(2, "0")}
                      </span>
                      <span className="tk-unit-label">{unit.label}</span>
                    </div>
                  );
                })}
              </div>

              <span className="tk-date">
                <span className="tk-date-dot" aria-hidden />
                01 Sep 2026 · 00:00 UTC
              </span>
            </div>

            <AiBloom />
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <ul className="tk-unlocks">
            {UNLOCKS.map((u, i) => (
              <li
                key={u.key}
                className="reveal-stagger-item tk-unlock"
                style={{ "--tk-i": i } as CSSProperties}
              >
                <span className="tk-unlock-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={u.path} />
                  </svg>
                </span>
                <span className="tk-unlock-title">{u.title}</span>
                <span className="tk-unlock-body">{u.body}</span>
              </li>
            ))}
          </ul>
        </RevealOnScroll>
      </div>
    </section>
  );
}
